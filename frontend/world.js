import * as THREE from 'three';
import {HDRLoader} from '/vendor/addons/loaders/HDRLoader.js';
import {mergeGeometries} from '/vendor/addons/utils/BufferGeometryUtils.js';

// Deterministic geometry keeps the visual world, collisions and exported images coherent.
function random(seed=41){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
export async function createNeighborhood(onProgress=()=>{}) {
  const rng=random(),scene=new THREE.Scene(),obstacles=[],colliders=[],dynamic=[];
  scene.background=new THREE.Color('#d7e0df');scene.fog=new THREE.Fog('#d7e0df',48,150);
  const loader=new THREE.TextureLoader();let count=0;
  async function texture(file,color=false,repeat=[1,1]) {
    const t=await loader.loadAsync('/assets/materials/'+file);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat);t.anisotropy=4;if(color)t.colorSpace=THREE.SRGBColorSpace;onProgress(++count/10);return t;
  }
  const [asphaltMap,asphaltNormal,asphaltRough,pavingMap,pavingNormal,pavingRough,wallMap,wallNormal,wallRough,sky]=await Promise.all([
    texture('asphalt_02-color.jpg',true,[3,32]),texture('asphalt_02-normal.jpg',false,[3,32]),texture('asphalt_02-roughness.jpg',false,[3,32]),
    texture('pavement_03-color.jpg',true,[2,34]),texture('pavement_03-normal.jpg',false,[2,34]),texture('pavement_03-roughness.jpg',false,[2,34]),
    texture('plastered_wall_02-color.jpg',true,[3,3]),texture('plastered_wall_02-normal.jpg',false,[3,3]),texture('plastered_wall_02-roughness.jpg',false,[3,3]),
    new HDRLoader().loadAsync('/assets/materials/neighborhood-sky.hdr').then(t=>{onProgress(++count/10);return t;})
  ]);
  sky.mapping=THREE.EquirectangularReflectionMapping;scene.environment=sky;scene.background=sky;scene.environmentIntensity=.65;scene.backgroundRotation.y=.75;scene.backgroundBlurriness=.08;
  const materials=new Map();
  const mat=(color,roughness=.8,metalness=0)=>{
    const key=`${color}:${roughness}:${metalness}`;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness,metalness}));return materials.get(key);
  };
  const road=new THREE.MeshStandardMaterial({map:asphaltMap,normalMap:asphaltNormal,roughnessMap:asphaltRough,normalScale:new THREE.Vector2(.3,.3),color:'#b9bec0'});
  const paving=new THREE.MeshStandardMaterial({map:pavingMap,normalMap:pavingNormal,roughnessMap:pavingRough,normalScale:new THREE.Vector2(.35,.35),color:'#e1d8c8'});
  const wall=(color)=>new THREE.MeshStandardMaterial({map:wallMap,normalMap:wallNormal,roughnessMap:wallRough,normalScale:new THREE.Vector2(.2,.2),color});
  const plaster=['#d2c9b8','#c6b49b','#c8c8bb','#c1b3a4','#d5d0c3'].map(wall);
  const sandstone=mat('#bcae94'),trim=mat('#e7decb'),metal=mat('#323d3d',.35,.7),wood=mat('#79533b',.75),stripe=mat('#e1dbc7');
  const windowMat=new THREE.MeshPhysicalMaterial({color:'#6f8c8d',metalness:.72,roughness:.12,clearcoat:1,envMapIntensity:1.25});
  const hemi=new THREE.HemisphereLight('#e5edf2','#8b8064',.65);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#fff1d5',3.1);sun.position.set(-28,32,22);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-43,right:43,top:43,bottom:-43,near:1,far:120});sun.shadow.normalBias=.045;sun.shadow.bias=-.00015;scene.add(sun);
  function cube(parent,x,y,z,w,h,d,material,cast=true) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y+h/2,z);mesh.castShadow=cast;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function cylinder(parent,x,y,z,r,h,material,top=r,segments=12) {
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,r,h,segments),material);mesh.position.set(x,y+h/2,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function solid(object,label,collision=true) {
    object.userData.label=label;object.traverse(o=>{if(o.isMesh)o.userData.label=label;});obstacles.push(object);object.updateWorldMatrix(true,true);
    if(collision){const b=new THREE.Box3().setFromObject(object);colliders.push({minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z});}
    return object;
  }
  const groundCanvas=document.createElement('canvas');groundCanvas.width=groundCanvas.height=256;const gc=groundCanvas.getContext('2d');
  gc.fillStyle='#71816a';gc.fillRect(0,0,256,256);for(let i=0;i<18000;i++){gc.fillStyle=`rgba(${70+rng()*65},${80+rng()*70},${45+rng()*50},.3)`;gc.fillRect(rng()*256,rng()*256,1+rng()*2,1+rng()*3);}
  const grassTexture=new THREE.CanvasTexture(groundCanvas);grassTexture.colorSpace=THREE.SRGBColorSpace;grassTexture.wrapS=grassTexture.wrapT=THREE.RepeatWrapping;grassTexture.repeat.set(45,45);
  cube(scene,0,-.4,-4,220,.35,220,new THREE.MeshStandardMaterial({map:grassTexture,roughness:1}),false);
  cube(scene,0,-.045,-5,8,.06,94,road,false);
  for(const side of [-1,1]){
    cube(scene,side*6,0,-5,4,.15,94,paving,false);cube(scene,side*4.04,-.01,-5,.14,.20,94,sandstone,false);
    for(let z=-51;z<42;z+=1.5)cube(scene,side*4.05,.192,z,.15,.006,.02,mat('#857e71'),false);
  }
  for(let z=-49;z<42;z+=5)cube(scene,0,.025,z,.10,.008,2.1,stripe,false);
  for(const x of [-3.55,3.55])cube(scene,x,.026,-5,.075,.008,94,stripe,false);
  for(const z of [7,-22])for(let x=-3.4;x<4;x+=1)cube(scene,x,.028,z,.55,.01,2.4,stripe,false);
  // Street lettering and signs are generated locally, with no remote fonts in camera frames.
  function textBoard(text,w,h,bg='#254f48',fg='#eee8d9') {
    const c=document.createElement('canvas');c.width=1024;c.height=256;const context=c.getContext('2d');context.fillStyle=bg;context.fillRect(0,0,1024,256);context.fillStyle=fg;context.font='500 90px Georgia';context.textAlign='center';context.textBaseline='middle';context.fillText(text,512,128);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,roughness:.8}));
  }
  function building(x,z,index,side) {
    const g=new THREE.Group();g.position.set(x,.15,z);g.rotation.y=side===1?-Math.PI/2:Math.PI/2;scene.add(g);
    const width=11.4,depth=9,height=8.8+(index%2)*.6,facade=depth/2;
    cube(g,0,0,0,width,height,depth,plaster[index%plaster.length]);
    cube(g,0,0,facade+.03,width,.45,.14,sandstone);cube(g,0,height-.3,0,width+.35,.28,depth+.35,trim);
    for(const floor of [2.9,5.75])cube(g,0,floor,facade+.08,width,.13,.24,trim);
    for(const x of [-4.0,-1.35,1.35,4.0])for(const y of [3.45,6.25]) {
      cube(g,x,y,facade+.08,1.58,1.92,.16,trim);cube(g,x,y+.09,facade+.18,1.36,1.71,.025,windowMat);
      cube(g,x,y+.07,facade+.21,.055,1.76,.055,metal);cube(g,x,y+.93,facade+.21,1.40,.045,.055,metal);
      if(index%2===0){
        for(const sx of [-1,1]){cube(g,x+sx*.93,y+.04,facade+.16,.30,1.82,.08,mat(index%3===0?'#536d61':'#7b7767'));for(let n=0;n<9;n++)cube(g,x+sx*.93,y+.12+n*.18,facade+.22,.29,.025,.04,mat('#b1ac90'));}
      }
      if(y<4){
        cube(g,x,y-.15,facade+.35,1.9,.14,.85,sandstone);
        for(const sx of [-.85,0,.85])cylinder(g,x+sx,y,facade+.72,.018,.72,metal);
        cube(g,x,y+.67,facade+.72,1.85,.035,.035,metal);
      }
    }
    // Ground-floor storefronts: timber frames, reflective glass and fabric awnings.
    const shopNames=['OLIVE & OAK','ATELIER 06','MAISON DU PAIN','LE PETIT JARDIN','LIBRAIRIE'];
    for(const x of [-3.4,0,3.4]){
      cube(g,x,.25,facade+.06,2.7,2.3,.16,wood);cube(g,x,.39,facade+.16,2.45,2.0,.02,windowMat);cube(g,x,.37,facade+.20,.07,2.05,.04,wood);
    }
    const board=textBoard(shopNames[index%shopNames.length],6.8,.55,index%2?'#665047':'#294d43');board.position.set(0,2.55,facade+.16);g.add(board);
    const canopy=cube(g,0,2.25,facade+.9,7.2,.09,1.8,mat(index%2?'#c2a785':'#657f6b'));canopy.rotation.x=-.12;
    for(let i=0;i<9;i++)cube(g,-3.2+i*.8,2.1,facade+1.79,.39,.22,.035,mat('#e6d7b9'));
    // Rooftop planters, vents and small architectural details.
    cube(g,0,height,-depth/2,width,.55,.18,plaster[index%plaster.length]);
    for(const px of [-4,4]){cube(g,px,height,.5,.9,.5,.9,mat('#9b8063'));cylinder(g,px,height+.5,.5,.48,.6,mat('#526f4d'),.34);}
    cube(g,-2,height,0,1.1,.55,.7,mat('#a8aaa1'));cube(g,2,height,-2,1.4,.35,1.2,mat('#49585c',.3,.5));
    solid(g,'building');
  }
  for(const side of [-1,1])for(let i=0;i<5;i++){if(side===1 && i===3)continue;building(side*14,30-i*15,i+(side===1?0:2),side);}
  // Garden plaza: cut stone, circular water, planted borders and cafe furniture.
  const plazaMat=paving.clone();plazaMat.map=pavingMap.clone();plazaMat.map.repeat.set(7,6);
  cube(scene,15,.01,-15,14,.14,13,plazaMat,false);
  const basin=cylinder(scene,16,.15,-15,2.1,.46,sandstone,2.1,48);solid(basin,'fountain basin');
  cylinder(scene,16,.62,-15,1.88,.02,new THREE.MeshPhysicalMaterial({color:'#598c85',metalness:.35,roughness:.10,clearcoat:1,envMapIntensity:1.5}),1.88,48);
  cylinder(scene,16,.64,-15,.22,.95,trim);cylinder(scene,16,1.55,-15,.58,.10,sandstone,.58,32);
  const jet=new THREE.Mesh(new THREE.CylinderGeometry(.018,.03,.9,8),new THREE.MeshBasicMaterial({color:'#d7f3ee',transparent:true,opacity:.5}));jet.position.set(16,2,-15);scene.add(jet);
  function bench(x,z,rotation=0) {
    const g=new THREE.Group();g.position.set(x,.15,z);g.rotation.y=rotation;scene.add(g);
    for(let i=0;i<5;i++)cube(g,0,.48,-.24+i*.12,1.9,.06,.09,wood);
    for(let i=0;i<4;i++)cube(g,0,.70+i*.13,.30,1.9,.09,.055,wood);
    for(const x of [-.72,.72]){cube(g,x,0,0,.07,.49,.55,metal);cube(g,x,.48,.28,.05,.7,.05,metal);}
    solid(g,'bench');
  }
  bench(8.4,-11,-Math.PI/2);bench(18,-20,0);bench(-7,9,Math.PI/2);bench(7.5,25,-Math.PI/2);
  for(const [x,z] of [[6.9,9],[-7,-5],[8.5,-21]]){
    const g=new THREE.Group();g.position.set(x,.15,z);scene.add(g);cylinder(g,0,0,0,.25,.84,metal,.29,20);cylinder(g,0,.84,0,.31,.08,mat('#566a61'),.29,20);solid(g,'waste bin');
  }
  for(const side of [-1,1])for(const z of [-35,-18,1,18,34]){
    const g=new THREE.Group();g.position.set(side*7.65,.15,z);scene.add(g);
    cylinder(g,0,0,0,.075,4.1,metal,.045);cube(g,-side*.28,4.05,0,.65,.06,.08,metal);
    cube(g,-side*.53,3.98,0,.33,.05,.27,new THREE.MeshStandardMaterial({color:'#f4e6bf',emissive:'#f1d19a',emissiveIntensity:.2}));solid(g,'lamp post');
  }
  // Plane-leaf trees use instancing: natural silhouettes without oversized cone foliage.
  const leafCanvas=document.createElement('canvas');leafCanvas.width=64;leafCanvas.height=128;const lc=leafCanvas.getContext('2d');
  lc.fillStyle='#d9e5ca';lc.beginPath();lc.moveTo(32,0);lc.bezierCurveTo(69,44,62,91,32,127);lc.bezierCurveTo(4,89,-2,42,32,0);lc.fill();lc.strokeStyle='#a1b691';lc.lineWidth=2;lc.beginPath();lc.moveTo(32,8);lc.lineTo(32,122);lc.stroke();
  const leafTexture=new THREE.CanvasTexture(leafCanvas);leafTexture.colorSpace=THREE.SRGBColorSpace;
  const leafMaterial=new THREE.MeshStandardMaterial({map:leafTexture,alphaTest:.45,side:THREE.DoubleSide,roughness:.8,color:'#7e9a65'});
  const trees=[];for(const side of [-1,1])for(let i=0;i<8;i++){const z=33-i*11;if(side===1 && z<-6 && z>-25)continue;trees.push([side*8.7,z]);}
  trees.push([22,-10],[22,-21],[24,24],[-25,-15],[-24,22]);
  const leafCount=trees.length*210,leaves=new THREE.InstancedMesh(new THREE.PlaneGeometry(.43,.83),leafMaterial,leafCount);leaves.castShadow=true;leaves.receiveShadow=true;scene.add(leaves);const dummy=new THREE.Object3D();let li=0;
  for(const [x,z] of trees){
    const trunk=cylinder(scene,x,.15,z,.24,3.1,mat('#665744'),.13);solid(trunk,'tree trunk',false);colliders.push({minX:x-.25,maxX:x+.25,minZ:z-.25,maxZ:z+.25});
    for(let b=0;b<7;b++){
      const angle=b/7*Math.PI*2+rng()*.3,end=new THREE.Vector3(x+Math.cos(angle)*1.8,3.1+rng()*2,z+Math.sin(angle)*1.8);
      const path=new THREE.CatmullRomCurve3([new THREE.Vector3(x,1.8,z),new THREE.Vector3(x+Math.cos(angle)*.55,3.3,z+Math.sin(angle)*.55),end]);
      const branch=new THREE.Mesh(new THREE.TubeGeometry(path,8,.055,6,false),mat('#665744'));branch.castShadow=true;scene.add(branch);
      for(let n=0;n<30;n++){
        const theta=rng()*Math.PI*2,u=rng()*2-1,r=Math.cbrt(rng())*1.05;
        dummy.position.set(end.x+Math.sqrt(1-u*u)*Math.cos(theta)*r,end.y+u*r*.75,end.z+Math.sqrt(1-u*u)*Math.sin(theta)*r);
        dummy.rotation.set(rng()*Math.PI, rng()*Math.PI*2,rng()*Math.PI);dummy.scale.setScalar(.7+rng()*.5);dummy.updateMatrix();leaves.setMatrixAt(li,dummy.matrix);leaves.setColorAt(li,new THREE.Color().setHSL(.20+rng()*.08,.18+rng()*.24,.30+rng()*.20));li++;
      }
    }
  }
  leaves.instanceMatrix.needsUpdate=true;
  // Parked cars with curved bodywork, tires, wheel rims and reflective glazing.
  function car(x,z,color,rotation=0){
    const g=new THREE.Group();g.position.set(x,.08,z);g.rotation.y=rotation;scene.add(g);
    const paint=new THREE.MeshPhysicalMaterial({color,metalness:.6,roughness:.27,clearcoat:1});
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(.65,2.25,5,14),paint);body.rotation.x=Math.PI/2;body.scale.set(1.25,.99,.60);body.position.y=.65;g.add(body);
    cube(g,0,.85,-.12,1.35,.65,1.6,windowMat);cube(g,0,1.46,-.12,1.42,.055,1.65,paint);
    for(const side of [-1,1])for(const zz of [-1.15,1.15]){
      const tire=new THREE.Mesh(new THREE.CylinderGeometry(.33,.33,.19,20),mat('#202527',.95));tire.rotation.z=Math.PI/2;tire.position.set(side*.79,.34,zz);g.add(tire);
      const rim=new THREE.Mesh(new THREE.CylinderGeometry(.20,.20,.195,16),mat('#9ba2a1',.25,.9));rim.rotation.z=Math.PI/2;rim.position.copy(tire.position);g.add(rim);
    }
    for(const xx of [-.52,.52]){cube(g,xx,.64,1.76,.32,.12,.025,mat('#e4dfc8',.18,.2));cube(g,xx,.65,-1.76,.30,.10,.025,mat('#994d42',.2));}
    solid(g,'parked car');
  }
  car(-2.85,20,'#e1ddd0');car(2.85,-4,'#455a61',Math.PI);car(-2.85,-29,'#8e6d61');
  // Small cafe terrace near the garden.
  for(const [x,z] of [[10,-15],[11,-19],[20,-10]]){
    const table=new THREE.Group();table.position.set(x,.15,z);scene.add(table);cylinder(table,0,0,0,.035,.72,metal);cylinder(table,0,.72,0,.50,.06,wood,.50,24);solid(table,'cafe table');
    for(const side of [-1,1]){const chair=new THREE.Group();chair.position.set(x+side*.85,.15,z);scene.add(chair);cube(chair,0,.43,0,.48,.045,.48,wood);cube(chair,side*.20,.47,0,.045,.48,.48,wood);for(const cx of [-.18,.18])for(const cz of [-.18,.18])cube(chair,cx,0,cz,.035,.43,.035,metal);solid(chair,'cafe chair');}
  }
  const direction=textBoard('Jardin des Oliviers',2.6,.55);direction.position.set(8,2.2,-8);scene.add(direction);cylinder(scene,8,.15,-8,.035,2.5,metal);
  // Merge static draw calls while retaining invisible detailed raycast geometry.
  scene.updateMatrixWorld(true);const batches=new Map();
  scene.traverse(object=>{
    if(!object.isMesh || object.isInstancedMesh || Array.isArray(object.material))return;
    const cloned=object.geometry.clone().applyMatrix4(object.matrixWorld),geometry=cloned.index?cloned.toNonIndexed():cloned;
    for(const key of Object.keys(geometry.attributes))if(!['position','normal','uv'].includes(key))geometry.deleteAttribute(key);
    if(!geometry.attributes.uv)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*2),2));
    if(!geometry.attributes.normal)geometry.computeVertexNormals();
    const batch=batches.get(object.material.uuid)||{material:object.material,geometries:[]};batch.geometries.push(geometry);batches.set(object.material.uuid,batch);object.layers.set(2);
  });
  for(const {material,geometries} of batches.values()){const mesh=new THREE.Mesh(mergeGeometries(geometries),material);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);geometries.forEach(g=>g.dispose());}
  // A movable package is intentionally tall enough to intersect the range rays.
  const crate=new THREE.Group();scene.add(crate);cube(crate,0,0,0,.9,1.5,.9,mat('#ae855b'));for(const x of [-.34,.34])cube(crate,x,0,0,.055,1.51,.92,wood);solid(crate,'test obstacle');const crateCollider=colliders.at(-1);
  function placeCrate(position,yaw,distance,direction='center'){
    const angle=yaw+(direction==='left'?Math.PI/6:direction==='right'?-Math.PI/6:0);
    crate.position.set(position.x-Math.sin(angle)*(distance+.45),.15,position.z-Math.cos(angle)*(distance+.45));crate.updateWorldMatrix(true,true);const b=new THREE.Box3().setFromObject(crate);Object.assign(crateCollider,{minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z});
  }
  // Walking figures remain independent raycast obstacles and update their footprints.
  function pedestrian(x,z,color,phase){
    const g=new THREE.Group();g.position.set(x,.15,z);scene.add(g);const skin=mat('#b88d70');
    const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.17,.43,4,8),mat(color));torso.position.y=1.08;g.add(torso);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.13,12,10),skin);head.position.y=1.58;g.add(head);
    const hair=new THREE.Mesh(new THREE.SphereGeometry(.135,12,8,0,Math.PI*2,0,Math.PI*.55),mat('#3a3029'));hair.position.y=1.61;g.add(hair);
    const legs=[];for(const side of [-1,1]){const pivot=new THREE.Group();pivot.position.set(side*.095,.83,0);g.add(pivot);const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.07,.48,3,8),mat('#454d50'));leg.position.y=-.32;pivot.add(leg);const shoe=cube(pivot,0,-.72,-.05,.14,.09,.25,mat('#3c3731'));legs.push(pivot);const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.055,.42,3,8),mat(color));arm.position.set(side*.24,1.02,0);g.add(arm);}
    g.traverse(o=>{if(o.isMesh)o.castShadow=true;});obstacles.push(g);const collider={minX:x-.23,maxX:x+.23,minZ:z-.2,maxZ:z+.2};colliders.push(collider);
    dynamic.push(now=>{const t=now*.00028+phase;g.position.z=z+Math.sin(t)*5;g.rotation.y=Math.cos(t)>0?Math.PI:0;legs.forEach((leg,i)=>leg.rotation.x=Math.sin(now*.006+i*Math.PI)*.35);collider.minZ=g.position.z-.2;collider.maxZ=g.position.z+.2;});
  }
  pedestrian(-5.8,-4,'#7b8477',0);pedestrian(7.1,-27,'#aa8c72',2);
  const avatar=new THREE.Group();avatar.layers.set(1);scene.add(avatar);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.33,.43,40),new THREE.MeshBasicMaterial({color:'#49d7be',side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.03;avatar.add(ring);
  const marker=new THREE.Mesh(new THREE.ConeGeometry(.20,.55,16),mat('#245b53'));marker.position.y=1;avatar.add(marker);avatar.traverse(o=>o.layers.set(1));
  function setLighting(preset='day'){
    const golden=preset==='golden';sun.color.set(golden?'#ffd5a0':'#fff1d5');sun.intensity=golden?2.7:3.1;sun.position.set(golden?-38:-28,golden?19:32,22);scene.environmentIntensity=golden?.50:.65;scene.fog.color.set(golden?'#d9c9b1':'#d7e0df');scene.backgroundIntensity=golden?.8:1;
  }
  return {scene,obstacles,colliders,avatar,placeCrate,setLighting,update:now=>dynamic.forEach(fn=>fn(now))};
}
