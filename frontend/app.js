import * as THREE from '/vendor/three/three.module.js';
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
    for(const d of ['left','center','right']) $(d).textContent=state.sensors?.distances[d]?.toFixed(2) ?? '—';
    document.body.dataset.level=state.alert.level;
    $('level').textContent=({danger:'Close obstacle',warning:'Approaching obstacle',clear:'No close return',unknown:'Sensor data unknown'})[state.alert.level];
    $('warning').textContent=state.alert.message;
    $('broker').textContent=`MQTT ${state.mqttConnected ? 'connected' : 'disconnected'} · active: ${state.activeSource}`;
    $('ai-mode').textContent=state.aiMode === 'gemma' ? 'GEMMA · LIVE API' : 'SCRIPTED DEMO';
    $('detections').textContent='Camera: '+(state.vision?.detections.map(d=>`${d.label} ${Math.round(d.confidence*100)}% (${d.direction})`).join(', ') || 'no recent observations');
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

try {
  const host=$('scene');
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#1b2c2b');scene.fog=new THREE.Fog('#1b2c2b',13,28);
  const camera=new THREE.PerspectiveCamera(52,1,0.05,100);
  scene.add(new THREE.HemisphereLight(0xddecc5,0x263c30,3));
  const light=new THREE.DirectionalLight(0xfff1d0,4);light.position.set(4,9,3);scene.add(light);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,40),new THREE.MeshStandardMaterial({color:0x263b36,roughness:0.9}));floor.rotation.x=-Math.PI/2;scene.add(floor);
  const grid=new THREE.GridHelper(30,30,0x59765b,0x344c41);grid.position.y=.01;scene.add(grid);
  const obstacles=[];
  function box(label,x,z,w,h,d,color) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.65}));mesh.position.set(x,h/2,z);mesh.userData.label=label;scene.add(mesh);obstacles.push(mesh);return mesh;
  }
  const block=box('center obstacle',0,-3,1.1,1.8,1,0xc4cc9e);
  box('left pillar',-2.2,-6,1,2.5,1,0x7f9a83);box('right block',2.2,-4,1.3,1.5,1,0xb28a65);
  box('back wall',0,-12,9,3,.25,0x46604d);box('left wall',-4.5,-3,.2,3,18,0x3c5547);box('right wall',4.5,-3,.2,3,18,0x3c5547);
  const person=new THREE.Group();
  const head=new THREE.Mesh(new THREE.SphereGeometry(.18,20,16),new THREE.MeshStandardMaterial({color:0xd8e8b4}));head.position.y=1.65;person.add(head);
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.17,.25,1.2,12),new THREE.MeshStandardMaterial({color:0x84a87b}));body.position.y=.8;person.add(body);scene.add(person);
  const glasses=new THREE.Mesh(new THREE.BoxGeometry(.42,.08,.15),new THREE.MeshStandardMaterial({color:0x102621}));glasses.position.set(0,1.68,-.15);person.add(glasses);
  const position=new THREE.Vector3(0,0,0);let heading=0, firstPerson=false;
  const lines=['left','center','right'].map(()=>{const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xc0ed94}));scene.add(line);return line;});
  const raycaster=new THREE.Raycaster();const keys=new Set();
  window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement.tagName))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','q','e'].includes(e.key)){e.preventDefault();keys.add(e.key);}});
  window.addEventListener('keyup',e=>keys.delete(e.key));window.addEventListener('blur',()=>keys.clear());
  function move(forward,side,dt) {position.x+=(-Math.sin(heading)*forward+Math.cos(heading)*side)*dt;position.z+=(-Math.cos(heading)*forward-Math.sin(heading)*side)*dt;position.x=THREE.MathUtils.clamp(position.x,-4,4);position.z=THREE.MathUtils.clamp(position.z,-10,5);}
  function place(distance) {block.position.set(position.x-Math.sin(heading)*(distance+.5),.9,position.z-Math.cos(heading)*(distance+.5));block.rotation.y=heading;$('distance').value=distance;$('distance-value').textContent=distance.toFixed(2)+' m';}
  $('distance').oninput=()=>place(Number($('distance').value));
  document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{position.set(0,0,0);heading=0;place({clear:5,warning:1.1,danger:.4}[b.dataset.preset]);});
  document.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>{const d=b.dataset.move;move(d==='forward'?1:d==='back'?-1:0,d==='right'?1:d==='left'?-1:0,.25);});
  $('reset').onclick=()=>{position.set(0,0,0);heading=0;place(2.5);};
  $('view').onclick=()=>{firstPerson=!firstPerson;$('view').textContent=firstPerson?'Overview camera':'First-person view';};
  const resize=new ResizeObserver(()=>{const width=host.clientWidth,height=host.clientHeight;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();});resize.observe(host);
  let last=performance.now(),lastSend=0,posting=false;
  async function send(distances) {if(posting)return;posting=true;try{await post('telemetry',{source:'simulator',distances});}catch{}finally{posting=false;}}
  renderer.setAnimationLoop(now=>{
    const dt=Math.min((now-last)/1000,.05);last=now;
    if(keys.has('q'))heading+=dt;if(keys.has('e'))heading-=dt;
    move((keys.has('w')||keys.has('ArrowUp')?1:0)-(keys.has('s')||keys.has('ArrowDown')?1:0),(keys.has('d')||keys.has('ArrowRight')?1:0)-(keys.has('a')||keys.has('ArrowLeft')?1:0),dt*1.8);
    person.position.copy(position);person.rotation.y=heading;person.visible=!firstPerson;
    if(firstPerson){camera.position.set(position.x,1.65,position.z);camera.lookAt(position.x-Math.sin(heading)*5,1.5,position.z-Math.cos(heading)*5);}
    else {camera.position.set(position.x+6,7,position.z+7);camera.lookAt(position.x,0,position.z-3);}
    scene.updateMatrixWorld(true);
    const distances={};
    ['left','center','right'].forEach((direction,i)=>{
      const angle=heading+([Math.PI/6,0,-Math.PI/6][i]);const origin=new THREE.Vector3(position.x,1.25,position.z);const vector=new THREE.Vector3(-Math.sin(angle),0,-Math.cos(angle));
      raycaster.set(origin,vector);raycaster.far=6;const hit=raycaster.intersectObjects(obstacles,false)[0];const distance=hit?Math.max(.02,hit.distance):null;distances[direction]=distance;
      const end=origin.clone().addScaledVector(vector,distance??6);lines[i].geometry.setFromPoints([origin,end]);lines[i].material.color.set(distance!==null && distance<.7?0xff8d71:distance!==null && distance<1.5?0xf1d78d:0xb5e48d);lines[i].visible=!firstPerson;
    });
    if(now-lastSend>200){lastSend=now;send(distances);}
    const pulse=state?.alert.pulseMs || 0;$('haptic').classList.toggle('pulse',pulse>0 && now%pulse<90);
    renderer.render(scene,camera);
  });
} catch(e) {$('scene-error').textContent=`3D view unavailable: ${e.message}. Use a browser with WebGL enabled or select Wokwi for sensor input.`;}
