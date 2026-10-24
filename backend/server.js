import 'dotenv/config';
import express from 'express';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {WebSocketServer, WebSocket} from 'ws';
import mqtt from 'mqtt';
import {validateTelemetry, evaluate, STALE_MS} from './policy.js';
import {answerQuestion} from './assistant.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = express();
app.use(express.json({limit:'64kb'}));
// Local-only by default. No cross-origin browser writes or API keys in the frontend.
app.use('/api', (req,res,next) => {
  const origin = req.headers.origin;
  if (origin && origin !== `http://${req.headers.host}` && origin !== `https://${req.headers.host}`) return res.status(403).json({error:'Cross-origin requests are disabled'});
  next();
});
let activeSource = 'simulator';
const samples = {};
let broker = null;
let mqttConnected = false;
let previousCommand = '';
let commandSentAt = 0;
const topic = `openpilot/${process.env.MQTT_SESSION || 'um6p-change-me-2026'}`;
function snapshot() {
  const now = Date.now();
  return {activeSource, sensors:samples[activeSource] && now - samples[activeSource].receivedAt <= STALE_MS ? samples[activeSource] : null,
    vision:samples.vision && now - samples.vision.receivedAt <= STALE_MS ? samples.vision : null,
    alert:evaluate(samples, activeSource, now), aiMode:process.env.AI_MODE || 'demo', mqttConnected, timestamp:now};
}
function ingest(body) {
  const data = validateTelemetry(body);
  samples[data.source] = {...data, receivedAt:Date.now()};
}
app.get('/api/state', (req,res) => res.json(snapshot()));
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
app.use(express.static(resolve(root,'frontend')));
app.use((err,req,res,next) => res.status(400).json({error:'Invalid request body'}));
const server = createServer(app);
const wss = new WebSocketServer({server, path:'/ws'});
wss.on('connection', socket => socket.send(JSON.stringify(snapshot())));
if (process.env.MQTT_ENABLED === 'true') {
  broker = mqtt.connect(process.env.MQTT_URL || 'mqtt://broker.hivemq.com:1883', {clientId:`openpilot-backend-${crypto.randomUUID()}`, reconnectPeriod:3000});
  broker.on('connect', () => {mqttConnected = true; broker.subscribe(`${topic}/telemetry`); previousCommand = '';});
  broker.on('close', () => {mqttConnected = false;});
  broker.on('error', e => console.error('MQTT:', e.message));
  broker.on('message', (name,payload,packet) => {
    if (packet.retain) return;
    try {const body = JSON.parse(payload.toString()); if(body.source !== 'wokwi') return; ingest(body);} catch {console.error('Ignored invalid MQTT telemetry');}
  });
}
const timer = setInterval(() => {
  const state = snapshot();
  for (const client of wss.clients) if(client.readyState === WebSocket.OPEN && client.bufferedAmount < 65536) client.send(JSON.stringify(state));
  const command = JSON.stringify(activeSource === 'wokwi' ? {level:state.alert.level,pulseMs:state.alert.pulseMs} : {level:'unknown',pulseMs:0});
  if (broker?.connected && (command !== previousCommand || Date.now()-commandSentAt>1000)) {broker.publish(`${topic}/haptic`,command,{retain:false}); previousCommand = command; commandSentAt=Date.now();}
}, 100);
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log(`OpenPilot Glasses: http://${process.env.HOST || '127.0.0.1'}:${server.address().port}`));
function close() { clearInterval(timer); broker?.end(true); for(const c of wss.clients) c.terminate(); wss.close(); server.close(() => process.exit(0)); }
process.on('SIGINT',close); process.on('SIGTERM',close);
