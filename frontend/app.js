import {startSimulator} from './simulator.js';
import {VoiceAssistant} from './voice-assistant.js';
import {GlassesViewer} from './glasses.js';
import {setupImmersiveMode} from './immersive.js';
const $ = id => document.getElementById(id);
async function post(path, body) {
  const response = await fetch(`/api/${path}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Request failed'); return data;
}
let state, lastWarning = '', lastSpoken = 0;
let audioUrl;
const voiceAssistant=new VoiceAssistant();
setupImmersiveMode();
const glasses=new GlassesViewer($('glasses'));
async function speak(text) {
  if (!text) return;
  if ($('eleven').checked) {
    try {
      const r = await fetch('/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,voice:$('voice-profile').value})});
      if (!r.ok) throw new Error((await r.json()).error);
      if(audioUrl) URL.revokeObjectURL(audioUrl);
      audioUrl = URL.createObjectURL(await r.blob()); await new Audio(audioUrl).play(); return;
    } catch(e) { $('answer').textContent = `${e.message}. Using browser speech. ${text}`; }
  }
  if ('speechSynthesis' in window) {speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(text));}
  else $('answer').textContent = 'Speech synthesis unavailable in this browser. ' + text;
}
function connect() {
  const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  socket.onopen = () => {$('connection').textContent='Live connection';};
  socket.onclose = () => { $('connection').textContent='Reconnecting…'; state=null; for(const d of ['left','center','right']) $(d).textContent='—'; $('level').textContent='Disconnected'; $('warning').textContent='Backend unavailable. Sensor state is unknown.'; document.body.dataset.level='unknown'; $('haptic').classList.remove('pulse'); setTimeout(connect,1500); };
  socket.onmessage = e => {
    state=JSON.parse(e.data); glasses.update(state.haptics); $('source').value=state.activeSource;
    for(const d of ['left','center','right']) {
      const distance=state.sensors?.distances[d];
      $(d).textContent=distance?.toFixed(2) ?? '—';
      $(d+'-bar').style.width=distance==null?'0%':`${Math.max(3,100-distance/8*100)}%`;
      $(d+'-bar').style.background=distance!=null && distance<.7?'#f5ad91':distance!=null && distance<1.5?'#edd394':'#7be1be';
    }
    document.body.dataset.level=state.alert.level;
    $('level').textContent=({danger:'Close obstacle',warning:'Approaching obstacle',clear:'No close return',unknown:'Sensor data unknown'})[state.alert.level];
    $('warning').textContent=state.alert.message;
    $('broker').textContent=`MQTT ${state.mqttConnected ? 'connected' : 'disconnected'} · ${state.mqtt?.publishedMessages || 0} sent`;
    if($('mqtt-feed'))$('mqtt-feed').textContent=state.mqttConnected?`${state.mqtt.broker} · ${state.mqtt.topicPrefix}`:state.mqtt?.lastError || 'MQTT disconnected';
    $('detections').textContent=state.vision?.detections.length?'Objects: '+state.vision.detections.map(d=>`${d.label} (${d.direction})`).join(', '):'Image + sensor context ready when you ask.';
    if(state.activeSource==='wokwi')$('stream-note').textContent='Camera: rendered simulator · distance warning: Wokwi. These sources are independent.';
    else if(state.camera)$('stream-note').textContent=`Rendered camera + simulator metrics · frame ${state.camera.frameId} · ${Math.max(0,Date.now()-state.camera.receivedAt)} ms old`;
    if ($('voice-warnings').checked && !voiceAssistant.voiceMode && !voiceAssistant.busy && !voiceAssistant.listening && !voiceAssistant.speaking && ['warning','danger'].includes(state.alert.level) && (state.alert.level !== lastWarning || Date.now()-lastSpoken>8000)) {speak(state.alert.message);lastSpoken=Date.now();}
    lastWarning=state.alert.level;
  };
}
connect();
$('source').onchange=()=>post('source',{source:$('source').value}).catch(e=>$('warning').textContent=e.message);

startSimulator(now=>{
  glasses.tick(now);
  const pulse=state?.alert.pulseMs || 0;
  $('haptic').classList.toggle('pulse',pulse>0 && now%pulse<90);
}).catch(e=>{
  $('loading').hidden=true;
  $('scene-error').textContent=`Environment could not load: ${e.message}. Check WebGL support and asset availability.`;
  $('stream-status').textContent='UNAVAILABLE';
});
