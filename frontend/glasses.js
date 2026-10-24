import * as THREE from 'three';
import {OrbitControls} from '/vendor/addons/controls/OrbitControls.js';
import {RoomEnvironment} from '/vendor/addons/environments/RoomEnvironment.js';

function roundedPath(width,height,radius,Path=THREE.Shape) {
  const p=new Path(),x=-width/2,y=-height/2;
  p.moveTo(x+radius,y);p.lineTo(x+width-radius,y);p.quadraticCurveTo(x+width,y,x+width,y+radius);p.lineTo(x+width,y+height-radius);p.quadraticCurveTo(x+width,y+height,x+width-radius,y+height);p.lineTo(x+radius,y+height);p.quadraticCurveTo(x,y+height,x,y+height-radius);p.lineTo(x,y+radius);p.quadraticCurveTo(x,y,x+radius,y);return p;
}

export class GlassesViewer {
  constructor(host) {
    this.host=host;this.channels=null;this.receivedAt=0;
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setClearColor(0x000000,0);
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.3;host.appendChild(this.renderer.domElement);
    this.scene=new THREE.Scene();
    const pmrem=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.environment=pmrem.fromScene(room,.03).texture;this.scene.environment=this.environment;room.dispose();pmrem.dispose();
    this.camera=new THREE.PerspectiveCamera(33,1,.01,50);this.camera.position.set(3.6,3.1,5.8);this.camera.zoom=1.35;this.camera.updateProjectionMatrix();
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(0,0,-.4);this.controls.enableDamping=true;this.controls.enableZoom=false;this.controls.enablePan=false;this.controls.minPolarAngle=.45;this.controls.maxPolarAngle=Math.PI*.66;
    const frameMat=new THREE.MeshPhysicalMaterial({color:'#20282b',roughness:.24,metalness:.35,clearcoat:1,clearcoatRoughness:.16});
    const trimMat=new THREE.MeshStandardMaterial({color:'#b5a98f',metalness:.9,roughness:.22});
    const lensMat=new THREE.MeshPhysicalMaterial({color:'#a7cbc7',metalness:.2,roughness:.04,transparent:true,opacity:.26,side:THREE.DoubleSide,clearcoat:1});
    this.glasses=new THREE.Group();this.glasses.rotation.set(-.08,-.12,.05);this.scene.add(this.glasses);
    for(const side of [-1,1]) {
      const shape=roundedPath(1.38,.92,.25);shape.holes.push(roundedPath(1.13,.66,.18,THREE.Path));
      const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.105,bevelEnabled:true,bevelSize:.026,bevelThickness:.025,bevelSegments:3,curveSegments:24}),frameMat);mesh.position.set(side*.77,0,0);mesh.rotation.z=side*.03;this.glasses.add(mesh);
      const lens=new THREE.Mesh(new THREE.ShapeGeometry(roundedPath(1.15,.68,.18),32),lensMat);lens.position.set(side*.77,0,.065);this.glasses.add(lens);
      const accent=new THREE.Mesh(new THREE.BoxGeometry(.15,.06,.05),trimMat);accent.position.set(side*1.39,.17,.13);this.glasses.add(accent);
      for(const sy of [-.21,.21]){const screw=new THREE.Mesh(new THREE.SphereGeometry(.023,10,8),trimMat);screw.position.set(side*1.4,sy,.12);this.glasses.add(screw);}
    }
    const bridge=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-.18,.06,.03),new THREE.Vector3(0,.18,.03),new THREE.Vector3(.18,.06,.03)]),16,.065,10,false),frameMat);this.glasses.add(bridge);
    const cameraBody=new THREE.Mesh(new THREE.BoxGeometry(.22,.14,.12),frameMat);cameraBody.position.set(0,.29,.07);this.glasses.add(cameraBody);
    const cameraLens=new THREE.Mesh(new THREE.CylinderGeometry(.042,.042,.025,24),new THREE.MeshPhysicalMaterial({color:'#142c34',roughness:.02,metalness:.65}));cameraLens.rotation.x=Math.PI/2;cameraLens.position.set(0,.29,.145);this.glasses.add(cameraLens);
    this.temples={};
    for(const [name,side] of [['left',-1],['right',1]]) {
      const group=new THREE.Group();group.position.set(side*1.47,.23,0);this.glasses.add(group);
      const path=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(side*.12,-.02,-.55),new THREE.Vector3(side*.08,-.06,-1.65),new THREE.Vector3(side*.02,-.30,-2.08)]);
      group.add(new THREE.Mesh(new THREE.TubeGeometry(path,32,.065,12,false),frameMat));
      const motor=new THREE.Mesh(new THREE.BoxGeometry(.16,.20,.56),frameMat);motor.position.set(side*.1,-.025,-.72);group.add(motor);
      const seam=new THREE.Mesh(new THREE.BoxGeometry(.17,.025,.20),trimMat);seam.position.set(side*.1,-.02,-.72);group.add(seam);
      const ledMat=new THREE.MeshStandardMaterial({color:'#2e8c76',emissive:'#2e8c76',emissiveIntensity:.3});
      const led=new THREE.Mesh(new THREE.SphereGeometry(.035,12,10),ledMat);led.position.set(side*.19,.01,-.5);group.add(led);
      const waves=[];
      for(let i=0;i<3;i++){const wave=new THREE.Mesh(new THREE.TorusGeometry(.19,.009,6,44),new THREE.MeshBasicMaterial({color:'#ed9663',transparent:true,opacity:0,depthWrite:false}));wave.rotation.y=Math.PI/2;wave.position.set(side*.2,-.03,-.72);group.add(wave);waves.push(wave);}
      this.temples[name]={group,origin:side*1.47,ledMat,waves};
    }
    new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}).observe(host);
    this.lastRender=0;
    this.visible=true;new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;}).observe(host);
  }
  update(channels){this.channels=channels;this.receivedAt=performance.now();}
  tick(now) {
    if(now-this.lastRender<32)return;this.lastRender=now;
    const fresh=now-this.receivedAt<2500;
    for(const name of ['left','right']) {
      const channel=fresh?this.channels?.[name]:null,temple=this.temples[name];
      const intensity=channel?.intensity || 0,period=channel?.pulseMs || 600;
      const active=intensity>0,pulse=active && now%period<period*.36;
      temple.group.position.x=temple.origin+(pulse?Math.sin(now*.18)*.035*intensity:0);
      temple.group.rotation.z=pulse?Math.sin(now*.14)*.035*intensity:0;
      const color=channel?.level==='danger'?'#f06b4e':active?'#e8ad68':'#4e9c88';temple.ledMat.color.set(color);temple.ledMat.emissive.set(color);temple.ledMat.emissiveIntensity=pulse?3:.3;
      temple.waves.forEach((wave,i)=>{const phase=(now/period+i/3)%1;wave.scale.setScalar(1+phase*2.3);wave.material.color.set(color);wave.material.opacity=active?(1-phase)*intensity*.75:0;});
      const label=document.getElementById(`temple-${name}`),bar=document.getElementById(`temple-${name}-bar`);
      if(label){label.textContent=active?`${channel.level==='danger'?'Strong':'Gentle'} pulse`:(channel?.level==='unknown' || !channel?'No signal':'Idle');label.dataset.level=channel?.level || 'unknown';}
      if(bar)bar.style.width=`${intensity*100}%`;
    }
    if(this.visible){this.controls.update();this.renderer.render(this.scene,this.camera);}
  }
}
