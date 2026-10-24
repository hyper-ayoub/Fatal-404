import 'dotenv/config';
import express from 'express';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {WebSocketServer, WebSocket} from 'ws';
import {validateTelemetry, evaluate, STALE_MS} from './policy.js';
import {answerQuestion} from './assistant.js';
import {createFrameStore} from './frames.js';
import {createMqttBridge} from './mqtt-bridge.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = express();
app.use(express.json({limit:'768kb'}));
// Local-only by default. No cross-origin browser writes or API keys in the frontend.
app.use('/api', (req,res,next) => {
  const origin = req.headers.origin;
  if (origin && origin !== `http://${req.headers.host}` && origin !== `https://${req.headers.host}`) return res.status(403).json({error:'Cross-origin requests are disabled'});
  next();
});
let activeSource = 'simulator';
const samples = {};
const frames = createFrameStore();
const streamClients = new Set();
const mqttBridge=createMqttBridge({onTelemetry:ingest});
function snapshot() {
  const now = Date.now();
  return {activeSource, sensors:samples[activeSource] && now - samples[activeSource].receivedAt <= STALE_MS ? samples[activeSource] : null,
    vision:samples.vision && now - samples.vision.receivedAt <= STALE_MS && now-(samples.vision.capturedAt ?? samples.vision.receivedAt)<=STALE_MS ? samples.vision : null,
    camera:frames.metadata(now), alert:evaluate(samples, activeSource, now), aiMode:process.env.AI_MODE || 'demo', mqttConnected:mqttBridge.status().connected, mqtt:mqttBridge.status(), timestamp:now};
}
function ingest(body) {
  const data = validateTelemetry(body);
  samples[data.source] = {...data, receivedAt:Date.now()};
}
app.get('/api/state', (req,res) => res.json(snapshot()));
app.get('/api/mqtt', (req,res) => res.set('Cache-Control','no-store').json(mqttBridge.status()));
app.post('/api/simulator/observation', (req,res) => {
  try {
    const frame=frames.put(req.body);
    samples.simulator={source:'simulator',distances:frame.distances,receivedAt:frame.receivedAt,frameId:frame.frameId,sessionId:frame.sessionId};
    mqttBridge.publishObservation(frame,evaluate(samples,'simulator'));
    res.json({ok:true,frameId:frame.frameId,receivedAt:frame.receivedAt});
  } catch(e) {res.status(400).json({error:e.message});}
});
app.get('/api/observation', (req,res) => res.set('Cache-Control','no-store').json(snapshot()));
app.get('/api/camera/frame', (req,res) => {
  const frame=frames.current();
  if(!frame)return res.status(404).json({error:'No fresh simulator camera frame'});
  res.set('Cache-Control','no-store').json({...frames.metadata(),image:frame.bytes.toString('base64')});
});
app.get('/api/camera/latest.jpg', (req,res) => {
  const frame=frames.current();
  if(!frame)return res.status(404).json({error:'No fresh simulator camera frame'});
  res.set({'Cache-Control':'no-store','X-Frame-Id':String(frame.frameId),'X-Session-Id':frame.sessionId,'X-Captured-At':String(frame.capturedAt),'X-Received-At':String(frame.receivedAt)}).type('image/jpeg').send(frame.bytes);
});
app.get('/api/camera/stream.mjpg', (req,res) => {
  streamClients.add(res);
  res.set({'Content-Type':'multipart/x-mixed-replace; boundary=frame','Cache-Control':'no-store','Connection':'keep-alive'});
  res.flushHeaders();let previous='';
  const timer=setInterval(()=>{
    const frame=frames.current();const id=frame && `${frame.sessionId}:${frame.frameId}`;
    if(!frame || id===previous || res.writableLength>512000)return;
    previous=id;
    res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.bytes.length}\r\nX-Frame-Id: ${frame.frameId}\r\n\r\n`);
    res.write(frame.bytes);res.write('\r\n');
  },100);
  req.on('close',()=>{clearInterval(timer);streamClients.delete(res);});
});
app.post('/api/telemetry', (req,res) => {
  try { ingest(req.body); res.json({ok:true}); } catch(e) {res.status(400).json({error:e.message});}
});
app.post('/api/source', (req,res) => {
  if (!['simulator','wokwi'].includes(req.body.source)) return res.status(400).json({error:'Choose simulator or wokwi'});
  activeSource = req.body.source; res.json(snapshot());
});
let asking = false;
app.post('/api/ask', async (req,res) => {
  const question = req.body.question;
  if (typeof question !== 'string' || !question.trim() || question.length > 1000) return res.status(400).json({error:'Question must contain 1–1000 characters'});
  if (asking) return res.status(429).json({error:'An answer is already being generated'});
  asking = true;
  try {res.json(await answerQuestion(question, snapshot()));}
  catch(e) {res.status(502).json({error:e.message});}
  finally {asking = false;}
});
app.post('/api/speech', async (req,res) => {
  if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID) return res.status(503).json({error:'ElevenLabs is not configured; use browser speech'});
  if (typeof req.body.text !== 'string' || !req.body.text.trim() || req.body.text.length > 2000) return res.status(400).json({error:'Invalid speech text'});
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(process.env.ELEVENLABS_VOICE_ID)}`, {method:'POST', headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY,'Content-Type':'application/json'}, body:JSON.stringify({text:req.body.text,model_id:'eleven_multilingual_v2'}),signal:AbortSignal.timeout(25000)});
    if (!response.ok) throw new Error(`Speech request failed (${response.status})`);
    res.type('audio/mpeg').send(Buffer.from(await response.arrayBuffer()));
  } catch(e) {res.status(502).json({error:e.message});}
});
app.use('/vendor/three', express.static(resolve(root,'node_modules/three/build')));
app.use('/vendor/addons', express.static(resolve(root,'node_modules/three/examples/jsm')));
app.use(express.static(resolve(root,'frontend')));
app.use((err,req,res,next) => res.status(400).json({error:'Invalid request body'}));
const server = createServer(app);
const wss = new WebSocketServer({server, path:'/ws'});
wss.on('connection', socket => socket.send(JSON.stringify(snapshot())));
const timer = setInterval(() => {
  const state = snapshot();
  for (const client of wss.clients) if(client.readyState === WebSocket.OPEN && client.bufferedAmount < 65536) client.send(JSON.stringify(state));
  mqttBridge.publishHaptic(state.alert,activeSource);
}, 100);
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log(`OpenPilot Glasses: http://${process.env.HOST || '127.0.0.1'}:${server.address().port}`));
function close() { clearInterval(timer); mqttBridge.close(); for(const response of streamClients)response.end(); for(const c of wss.clients) c.terminate(); wss.close(); server.close(() => process.exit(0)); }
process.on('SIGINT',close); process.on('SIGTERM',close);
