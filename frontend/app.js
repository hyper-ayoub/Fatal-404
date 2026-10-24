import {startSimulator} from './simulator.js';
const $ = id => document.getElementById(id);
async function post(path, body) {
  const response = await fetch(`/api/${path}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Request failed'); return data;
}
let state, lastAnswer = '', lastWarning = '', lastSpoken = 0;
let audioUrl;
async function speak(text) {
  if (!text) return;
  if ($('eleven').checked) {
    try {
      const r = await fetch('/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
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
    state=JSON.parse(e.data); $('source').value=state.activeSource;
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
    $('ai-mode').textContent=state.aiMode === 'gemma' ? 'GEMMA · LIVE API' : 'SCRIPTED DEMO';
    $('detections').textContent='Object detections: '+(state.vision?.detections.map(d=>`${d.label} ${Math.round(d.confidence*100)}% (${d.direction})`).join(', ') || 'no recent observations · start the vision worker');
    if(state.activeSource==='wokwi')$('stream-note').textContent='Camera: rendered simulator · distance warning: Wokwi. These sources are independent.';
    else if(state.camera)$('stream-note').textContent=`Rendered camera + simulator metrics · frame ${state.camera.frameId} · ${Math.max(0,Date.now()-state.camera.receivedAt)} ms old`;
    if ($('voice-warnings').checked && ['warning','danger'].includes(state.alert.level) && (state.alert.level !== lastWarning || Date.now()-lastSpoken>8000)) {speak(state.alert.message);lastSpoken=Date.now();}
    lastWarning=state.alert.level;
  };
}
connect();
$('source').onchange=()=>post('source',{source:$('source').value}).catch(e=>$('warning').textContent=e.message);
$('ask-form').onsubmit=async e=>{e.preventDefault();$('ask').disabled=true;$('answer').textContent='Combining recent observations…';try{const data=await post('ask',{question:$('question').value});lastAnswer=data.text;$('answer').textContent=data.text;}catch(e){$('answer').textContent=e.message;}finally{$('ask').disabled=false;}};
$('speak').onclick=()=>speak(lastAnswer);
const Recognition=window.SpeechRecognition || window.webkitSpeechRecognition;
$('microphone').onclick=()=>{if(!Recognition){$('answer').textContent='Dictation is unavailable here. Please type your question.';return;}const recognition=new Recognition();recognition.lang=navigator.language;recognition.onresult=e=>{$('question').value=e.results[0][0].transcript;};recognition.onerror=e=>{$('answer').textContent=`Microphone: ${e.error}. You can type your question.`;};recognition.start();};

startSimulator(now=>{
  const pulse=state?.alert.pulseMs || 0;
  $('haptic').classList.toggle('pulse',pulse>0 && now%pulse<90);
}).catch(e=>{
  $('loading').hidden=true;
  $('scene-error').textContent=`Environment could not load: ${e.message}. Check WebGL support and asset availability.`;
  $('stream-status').textContent='UNAVAILABLE';
});
