import * as THREE from 'three';
import {OrbitControls} from '/vendor/addons/controls/OrbitControls.js';
import {createNeighborhood} from './world.js';
import {moveWithCollisions} from './movement.js';

const $=id=>document.getElementById(id);
export async function startSimulator(onTick) {
  const world=await createNeighborhood(ratio=>$('loading-progress').textContent=`Loading neighborhood models · ${Math.round(ratio*100)}%`);
  const {scene,obstacles,colliders,avatar,placeCrate}=world;
  const position=new THREE.Vector3(5.7,.15,14);
  let yaw=0,pitch=0,mapMode=false,publishing=false,frameId=0;
  const sessionId=crypto.randomUUID();
  // A focused studio owns the camera so an older tab cannot overwrite its pixels or metrics.
  async function claimCamera(force=false){const response=await fetch('/api/simulator/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,force})});if(!response.ok)throw new Error('Unable to connect this camera session');}
  await claimCamera(true);window.addEventListener('focus',()=>claimCamera().catch(()=>{}));
  document.addEventListener('immersivechange',event=>{if(event.detail.active)claimCamera(true).catch(()=>{});});
  function renderer(host,width,height) {
    const r=new THREE.WebGLRenderer({antialias:true});r.setPixelRatio(1);
    r.setSize(width,height,false);r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;r.shadowMap.autoUpdate=false;r.shadowMap.needsUpdate=true;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.03;host.appendChild(r.domElement);return r;
  }
  const overview=renderer($('scene'),800,500),fp=renderer($('first-person'),640,360);
  function sizeCamera(){const width=document.body.classList.contains('immersive')?($('quality').value==='high'?1280:960):640;fp.setSize(width,width*9/16,false);}
  document.addEventListener('immersivechange',sizeCamera);
  let overviewVisible=true,fpVisible=true;
  new IntersectionObserver(entries=>{for(const entry of entries){if(entry.target===$('scene'))overviewVisible=entry.isIntersecting;else fpVisible=entry.isIntersecting;}}).observe($('scene'));
  new IntersectionObserver(entries=>{fpVisible=entries[0].isIntersecting;}).observe($('first-person'));
  const camera=new THREE.PerspectiveCamera(48,1,.1,250);camera.layers.enable(1);camera.position.set(24,26,33);
  const first=new THREE.PerspectiveCamera(78,640/360,.08,200);first.rotation.order='YXZ';
  const orbit=new OrbitControls(camera,overview.domElement);orbit.target.set(position.x,0,position.z-4);orbit.enableDamping=true;orbit.enablePan=false;orbit.minDistance=9;orbit.maxDistance=62;orbit.maxPolarAngle=Math.PI/2-.12;
  const previousTarget=orbit.target.clone();
  new ResizeObserver(()=>{const w=$('scene').clientWidth,h=$('scene').clientHeight;overview.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe($('scene'));
  const lines=['left','center','right'].map(()=>{
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:'#77ffcb',transparent:true,opacity:.85,depthTest:false}));line.layers.set(1);line.renderOrder=5;scene.add(line);return line;
  });
  const keys=new Set();const walkingKeys=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','q','e','shift'];
  window.addEventListener('keydown',e=>{
    if(e.ctrlKey||e.metaKey||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;
    const key=e.key.toLowerCase();if(walkingKeys.includes(key)){e.preventDefault();keys.add(key);}
  });
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>keys.clear());
  const touch={forward:0,side:0,turn:0};
  function bindHeld(button,down,up) {
    let started=0,releaseTimer;
    button.onpointerdown=e=>{e.preventDefault();clearTimeout(releaseTimer);started=performance.now();button.setPointerCapture(e.pointerId);down();};
    const release=()=>{clearTimeout(releaseTimer);releaseTimer=setTimeout(up,Math.max(0,180-(performance.now()-started)));};
    button.onpointerup=release;button.onpointercancel=()=>{clearTimeout(releaseTimer);up();};button.onlostpointercapture=release;
    // Keyboard activation and browser accessibility click need a discrete step.
    button.onclick=e=>{if(e.detail===0){down();setTimeout(up,180);}};
  }
  document.querySelectorAll('[data-move]').forEach(button=>{
    const direction=button.dataset.move;
    bindHeld(button,()=>{touch.forward=direction==='forward'?1:direction==='back'?-1:0;touch.side=direction==='right'?1:direction==='left'?-1:0;},()=>{touch.forward=0;touch.side=0;});
  });
  document.querySelectorAll('[data-turn]').forEach(button=>bindHeld(button,()=>touch.turn=button.dataset.turn==='left'?1:-1,()=>touch.turn=0));
  let dragging=false,lastPointer={x:0,y:0};
  const fpHost=$('first-person');
  const look=(dx,dy)=>{yaw-=dx*.003;pitch=THREE.MathUtils.clamp(pitch-dy*.003,-.8,.8);};
  fpHost.onpointerdown=e=>{dragging=true;lastPointer={x:e.clientX,y:e.clientY};fpHost.setPointerCapture(e.pointerId);fpHost.focus();};
  fpHost.onpointermove=e=>{if(dragging && document.pointerLockElement!==fpHost){look(e.clientX-lastPointer.x,e.clientY-lastPointer.y);lastPointer={x:e.clientX,y:e.clientY};}};
  fpHost.onpointerup=()=>dragging=false;fpHost.onpointercancel=()=>dragging=false;
  document.addEventListener('mousemove',e=>{if(document.pointerLockElement===fpHost)look(e.movementX,e.movementY);});
  $('mouse-look').onclick=async()=>{try{if(document.pointerLockElement)document.exitPointerLock();else await fpHost.requestPointerLock();}catch{$('stream-note').textContent='Mouse capture unavailable here. Drag in the camera and use W A S D to walk.';fpHost.focus();}};
  document.addEventListener('pointerlockchange',()=>{$('mouse-look').textContent=document.pointerLockElement?'Exit walk mode · Esc':'Enter walk mode ↗';keys.clear();});
  let obstacleDirection='center';
  $('hero-walk').onclick=()=>$('mouse-look').click();
  $('lighting').onchange=()=>{world.setLighting($('lighting').value);overview.shadowMap.needsUpdate=true;fp.shadowMap.needsUpdate=true;};
  $('quality').onchange=()=>{overview.setPixelRatio($('quality').value==='high'?Math.min(devicePixelRatio,1.5):1);sizeCamera();};
  function reset(distance=2.5,direction='center') {position.set(5.7,.15,14);yaw=0;pitch=0;obstacleDirection=direction;place(distance);}
  function place(distance){placeCrate(position,yaw,distance,obstacleDirection);overview.shadowMap.needsUpdate=true;fp.shadowMap.needsUpdate=true;$('distance').value=distance;$('distance-value').textContent=distance.toFixed(2)+' m';}
  $('reset').onclick=()=>reset();$('distance').oninput=()=>place(Number($('distance').value));
  document.querySelectorAll('[data-preset]').forEach(button=>button.onclick=()=>{const preset=button.dataset.preset;reset({clear:6,warning:1.1,danger:.4,left:1.1,right:1.1}[preset],['left','right'].includes(preset)?preset:'center');});
  function setView(map) {mapMode=map;orbit.enabled=!map;$('view').classList.toggle('selected',!map);$('map-view').classList.toggle('selected',map);if(!map){camera.position.set(position.x+18,22,position.z+19);orbit.target.set(position.x,0,position.z-4);previousTarget.copy(orbit.target);}}
  $('view').onclick=()=>setView(false);$('map-view').onclick=()=>setView(true);
  const capture=document.createElement('canvas');capture.width=640;capture.height=360;const ctx=capture.getContext('2d',{alpha:false});
  $('snapshot').onclick=()=>{const a=document.createElement('a');a.download=`sensepath-${frameId}.jpg`;a.href=capture.toDataURL('image/jpeg',.9);a.click();};
  const raycaster=new THREE.Raycaster();raycaster.far=8;raycaster.layers.enable(2);
  const toBase64=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
  let publishedAt=0,previousPublish=0;
  async function publish(observation) {
    if(publishing)return;publishing=true;
    // Copy immediately while the render buffer and the measured pose match.
    ctx.drawImage(fp.domElement,0,0);
    try {
      const blob=await new Promise(resolve=>capture.toBlob(resolve,'image/jpeg',.77));
      if(!blob)throw new Error('Unable to capture camera');
      const image=await toBase64(blob);
      const response=await fetch('/api/simulator/observation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...observation,image}),signal:AbortSignal.timeout(3000)});
      if(!response.ok)throw new Error('Frame upload failed');
      publishedAt=performance.now();
      $('camera-frame').textContent=`FRAME ${String(observation.frameId).padStart(6,'0')}`;
      $('camera-rate').textContent=`${previousPublish?(1000/(observation.capturedAt-previousPublish)).toFixed(1):'—'} fps · JPEG`;
      previousPublish=observation.capturedAt;$('stream-status').textContent='STREAMING';
    }catch(e){$('stream-status').textContent='OFFLINE';$('stream-note').textContent=e.message;}
    finally{publishing=false;}
  }
  let last=performance.now(),lastUpload=0;
  reset();$('loading').hidden=true;
  overview.setAnimationLoop(now=>{
    const dt=Math.min((now-last)/1000,.05);last=now;
    yaw+=((keys.has('q')?1:0)-(keys.has('e')?1:0)+touch.turn)*dt*1.5;
    yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));
    const f=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0)+touch.forward;
    const s=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+touch.side;
    const speed=(keys.has('shift')?4.6:2.2)*dt/Math.max(1,Math.hypot(f,s));
    moveWithCollisions(position,(-Math.sin(yaw)*f+Math.cos(yaw)*s)*speed,(-Math.cos(yaw)*f-Math.sin(yaw)*s)*speed,colliders);
    avatar.position.copy(position);avatar.rotation.y=yaw;
    if(mapMode){camera.position.set(position.x,48,position.z+.01);camera.lookAt(position.x,0,position.z);}
    else {
      const target=new THREE.Vector3(position.x,0,position.z-4);orbit.target.lerp(target,.08);
      camera.position.add(orbit.target.clone().sub(previousTarget));previousTarget.copy(orbit.target);orbit.update();
    }
    first.position.set(position.x,position.y+1.57,position.z);first.rotation.set(pitch,yaw,0);
    world.update(now);scene.updateMatrixWorld(true);const distances={};
    ['left','center','right'].forEach((direction,i)=>{
      const angle=yaw+[Math.PI/6,0,-Math.PI/6][i],origin=new THREE.Vector3(position.x,1.25,position.z),vector=new THREE.Vector3(-Math.sin(angle),0,-Math.cos(angle));
      raycaster.set(origin,vector);const hit=raycaster.intersectObjects(obstacles,true)[0];const d=hit?Math.max(.02,hit.distance):null;distances[direction]=d;
      lines[i].geometry.setFromPoints([origin,origin.clone().addScaledVector(vector,d??8)]);
      lines[i].visible=$('sensor-rays').checked;
      lines[i].material.color.set(d!==null && d<.7?'#ff9e7d':d!==null && d<1.5?'#f8db8e':'#77ffcb');
    });
    if(overviewVisible)overview.render(scene,camera);
    if(fpVisible || (now-lastUpload>=200 && !publishing))fp.render(scene,first);
    $('pose').textContent=`${position.x.toFixed(2)}, ${position.z.toFixed(2)} m`;
    $('heading').textContent=`${String(Math.round((THREE.MathUtils.radToDeg(-yaw)%360+360)%360)%360).padStart(3,'0')}°`;
    $('compass-arrow').style.transform=`rotate(${THREE.MathUtils.radToDeg(yaw)}deg)`;
    onTick(now);
    if(now-lastUpload>=200 && !publishing){lastUpload=now;publish({sessionId,frameId:++frameId,capturedAt:Date.now(),width:640,height:360,distances,pose:{x:position.x,y:1.72,z:position.z,yaw,pitch}});}
  });
  return {world};
}
