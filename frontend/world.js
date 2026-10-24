import * as THREE from 'three';
import {GLTFLoader} from '/vendor/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from '/vendor/addons/utils/BufferGeometryUtils.js';

export async function createNeighborhood(onProgress=()=>{}) {
  const scene=new THREE.Scene();scene.background=new THREE.Color('#c7dfe9');scene.fog=new THREE.Fog('#c7dfe9',55,140);
  const obstacles=[],colliders=[];
  const material=(color,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness});
  const grass=material('#82996a'), stone=material('#d9d2bf'), curb=material('#c1bdad'), road=material('#4a5355'), wood=material('#a16b47'),metal=material('#344940');
  scene.add(new THREE.HemisphereLight('#e7f4ff','#7c8159',2.5));
  const sun=new THREE.DirectionalLight('#fff0cd',3.4);sun.position.set(-24,38,16);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,near:1,far:110});sun.shadow.normalBias=.06;sun.shadow.bias=-.0002;scene.add(sun);
  function footprint(object,padding=0) {
    object.updateWorldMatrix(true,true);const b=new THREE.Box3().setFromObject(object);
    const c={minX:b.min.x-padding,maxX:b.max.x+padding,minZ:b.min.z-padding,maxZ:b.max.z+padding};colliders.push(c);return c;
  }
  function solid(object,label,collision=true) {
    object.userData.label=label;object.traverse(child=>{if(child.isMesh){child.castShadow=true;child.receiveShadow=true;child.userData.label=label;}});
    scene.add(object);obstacles.push(object);if(collision)footprint(object);return object;
  }
  function box(x,y,z,w,h,d,mat,cast=true) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y+h/2,z);mesh.receiveShadow=true;mesh.castShadow=cast;scene.add(mesh);return mesh;
  }
  const ground=box(0,-.35,-4,200,.3,200,grass,false);
  box(0,-.04,-4,8,.07,92,road,false);
  for(const x of [-6,6]) {
    box(x,0,-4,4,.15,92,stone,false);box(Math.sign(x)*4.06,-.01,-4,.16,.19,92,curb,false);
    for(let z=-48;z<43;z+=2)box(x,.151,z,3.96,.003,.018,curb,false);
  }
  const stripe=material('#f3efd9');
  for(let z=-45;z<40;z+=5)box(0,.04,z,.12,.012,2.2,stripe,false);
  for(const x of [-3.5,3.5])box(x,.04,-4,.08,.012,92,stripe,false);
  for(const z of [7,-23])for(let x=-3.5;x<4;x+=1)box(x,.045,z,.58,.014,2.5,stripe,false);
  // A small tiled square opens off the east sidewalk.
  for(let x=8;x<=22;x+=2)for(let z=-13;z<=-3;z+=2)box(x,.02,z,1.96,.13,1.96,material((x+z)%4===1?'#ccc9b5':'#d9d5bf'),false);
  function cylinder(x,y,z,r,h,mat,rTop=r) {const m=new THREE.Mesh(new THREE.CylinderGeometry(rTop,r,h,10),mat);m.position.set(x,y+h/2,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
  function sign(text,x,z,rotation=0) {
    cylinder(x,.15,z,.04,2.4,metal);const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#234c43';ctx.fillRect(0,0,512,160);ctx.strokeStyle='#d6dec6';ctx.lineWidth=8;ctx.strokeRect(8,8,496,144);ctx.font='500 52px sans-serif';ctx.fillStyle='#f4f1df';ctx.textAlign='center';ctx.fillText(text,256,100);
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(2.6,.8,.08),new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(canvas)}));mesh.position.set(x,2.35,z);mesh.rotation.y=rotation;solid(mesh,'street sign',false);
  }
  sign('JARDIN DES SENS',9,-2);sign('AVENUE DES OLIVIERS',-5,21);
  for(const side of [-1,1])for(const z of [-35,-18,0,18,33]) {
    const x=side*7.35;const lamp=new THREE.Group();
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.045,.085,4.2,10),metal);pole.position.y=2.25;lamp.add(pole);
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(.3,.15,.12,12),metal);cap.position.y=4.4;lamp.add(cap);
    const bulb=new THREE.Mesh(new THREE.CylinderGeometry(.16,.12,.32,10),new THREE.MeshStandardMaterial({color:'#fff1c8',emissive:'#ffe7a0',emissiveIntensity:.45}));bulb.position.y=4.2;lamp.add(bulb);lamp.position.set(x,0,z);solid(lamp,'lamp post');
  }
  function bench(x,z,rotation=0) {
    const group=new THREE.Group();
    for(let i=0;i<5;i++){const slat=new THREE.Mesh(new THREE.BoxGeometry(1.9,.07,.11),wood);slat.position.set(0,.62,-.25+i*.13);group.add(slat);}
    for(let i=0;i<3;i++){const slat=new THREE.Mesh(new THREE.BoxGeometry(1.9,.13,.065),wood);slat.position.set(0,.9+i*.16,.35);group.add(slat);}
    for(const x of [-.7,.7]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.07,.6,.62),metal);leg.position.set(x,.33,0);group.add(leg);}
    group.position.set(x,.15,z);group.rotation.y=rotation;return solid(group,'bench');
  }
  bench(8.3,-6,-Math.PI/2);bench(17,-13,0);bench(-7,10,Math.PI/2);bench(7.8,24,-Math.PI/2);
  for(const [x,z] of [[6.6,10],[-7,-7],[8.5,-19]]){
    const bin=cylinder(x,.15,z,.3,.95,metal);solid(bin,'waste bin');cylinder(x,1.10,z,.33,.08,material('#526959'));
  }
  // Low fountain in the garden, with water and a raised rim.
  const fountain=cylinder(17,.15,-8,2.1,.6,stone);solid(fountain,'fountain');
  cylinder(17,.75,-8,1.85,.025,new THREE.MeshStandardMaterial({color:'#5faaa5',metalness:.3,roughness:.2}));
  cylinder(17,.78,-8,.23,1.15,curb);cylinder(17,1.93,-8,.6,.12,stone);
  const loader=new GLTFLoader();
  const names=['building-type-a','building-type-b','building-type-d','building-type-f','building-type-j','building-type-m','building-type-r','tree-large','tree-small','planter','fence-low'];
  let loaded=0;const models={};
  await Promise.all(names.map(async name=>{models[name]=(await loader.loadAsync(`/assets/kenney/${name}.glb`)).scene;onProgress(++loaded/names.length);}));
  function model(name,x,z,width,rotation=0,label=name,collision=true) {
    const mesh=models[name].clone(true);const bounds=new THREE.Box3().setFromObject(mesh);const size=bounds.getSize(new THREE.Vector3());const scale=width/size.x;
    mesh.scale.setScalar(scale);const center=bounds.getCenter(new THREE.Vector3());
    const wrapper=new THREE.Group();mesh.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);wrapper.add(mesh);wrapper.position.set(x,.15,z);wrapper.rotation.y=rotation;return solid(wrapper,label,collision);
  }
  const buildings=['building-type-a','building-type-d','building-type-f','building-type-b','building-type-j','building-type-m','building-type-r'];
  for(const side of [-1,1])for(let i=0;i<5;i++) {
    const x=side*14.7,z=28-i*16; if(side===1 && i===2)continue;
    model(buildings[(i+(side===1?2:0))%buildings.length],x,z,8.7,side===1?-Math.PI/2:Math.PI/2,'house');
    box(side*10.1,.03,z,4,.12,1.6,stone,false);
    for(const dz of [-5.5,5.5])model('fence-low',side*12.2,z+dz,6.3,0,'garden fence');
  }
  for(const side of [-1,1])for(let i=0;i<9;i++) {
    const x=side*(i%2===0?8.8:23.5),z=31-i*8.5;
    if(side===1 && z<-2 && z>-16)continue;
    model(i%2?'tree-large':'tree-small',x,z,3.4+i%3*.4,0,'tree',false);
    colliders.push({minX:x-.22,maxX:x+.22,minZ:z-.22,maxZ:z+.22});
  }
  for(const [x,z] of [[11,-14],[23,-5],[23,-13],[-8,28],[8,3]])model('planter',x,z,1.4,0,'planter');
  // Distant backdrop: a softly colored, low-poly hill line.
  for(let i=0;i<11;i++) {
    const hill=new THREE.Mesh(new THREE.ConeGeometry(20+(i%3)*5,15+(i%4)*5,5),material(['#97ae9e','#9bb4aa','#a9bcb0'][i%3]));hill.position.set(-110+i*22,2,-85-Math.abs(i-5)*3);scene.add(hill);
  }
  // Batch static architecture by material. Original meshes stay on a raycast-only
  // layer, preserving detailed sensor intersections without hundreds of draw calls.
  scene.updateMatrixWorld(true);
  const batches=new Map();
  scene.traverse(object=>{
    if(!object.isMesh || Array.isArray(object.material))return;
    const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);
    const converted=geometry.index?geometry.toNonIndexed():geometry;
    for(const key of Object.keys(converted.attributes))if(!['position','normal','uv'].includes(key))converted.deleteAttribute(key);
    if(!converted.attributes.uv)converted.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(converted.attributes.position.count*2),2));
    if(!converted.attributes.normal)converted.computeVertexNormals();
    const batch=batches.get(object.material.uuid)||{material:object.material,geometries:[]};
    batch.geometries.push(converted);batches.set(object.material.uuid,batch);object.layers.set(2);
  });
  for(const {material,geometries} of batches.values()){
    const mesh=new THREE.Mesh(mergeGeometries(geometries),material);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
    for(const geometry of geometries)geometry.dispose();
  }
  const crate=new THREE.Group();const crateMat=material('#c49153');
  const cube=new THREE.Mesh(new THREE.BoxGeometry(.9,1.5,.9),crateMat);cube.position.y=.75;crate.add(cube);
  for(const x of [-.33,.33]){const band=new THREE.Mesh(new THREE.BoxGeometry(.075,1.52,.92),wood);band.position.set(x,.75,0);crate.add(band);}
  crate.position.set(5.7,.15,5.8);solid(crate,'demo obstacle crate');const crateCollider=colliders.at(-1);
  function placeCrate(position,yaw,distance) {
    crate.position.set(position.x-Math.sin(yaw)*(distance+.45),.15,position.z-Math.cos(yaw)*(distance+.45));
    // Axis alignment keeps collision footprints precise at every angle.
    crate.updateWorldMatrix(true,true);const b=new THREE.Box3().setFromObject(crate);
    Object.assign(crateCollider,{minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z});
  }
  // Survey marker is hidden from the first-person image by the rendering layer.
  const avatar=new THREE.Group();avatar.layers.set(1);
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(.18,.23,1.05,12),material('#203e3c'));torso.position.y=.8;avatar.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.18,16,12),material('#d6b895'));head.position.y=1.52;avatar.add(head);
  const glasses=new THREE.Mesh(new THREE.BoxGeometry(.39,.075,.14),metal);glasses.position.set(0,1.55,-.14);avatar.add(glasses);
  const halo=new THREE.Mesh(new THREE.RingGeometry(.45,.52,40),new THREE.MeshBasicMaterial({color:'#63edbc',side:THREE.DoubleSide}));halo.rotation.x=-Math.PI/2;halo.position.y=.04;avatar.add(halo);
  avatar.traverse(o=>o.layers.set(1));scene.add(avatar);
  return {scene,obstacles,colliders,avatar,placeCrate};
}
