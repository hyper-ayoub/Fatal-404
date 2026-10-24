import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFrameStore} from '../backend/frames.js';
import {moveWithCollisions} from '../frontend/movement.js';
const input=()=>({sessionId:'test-session',frameId:1,capturedAt:Date.now(),width:640,height:360,pose:{x:5.7,y:1.72,z:14,yaw:0,pitch:0},distances:{left:null,center:.4,right:2},image:Buffer.from([255,216,1,255,217]).toString('base64')});
test('frame store binds pixels to sensor sample and drops stale data',()=>{
  const store=createFrameStore();const frame=store.put(input());const meta=store.metadata(frame.receivedAt);
  assert.equal(meta.frameId,1);assert.equal(meta.distances.center,.4);assert.equal(meta.bytes,undefined);
  assert.equal(store.current(frame.receivedAt+2501),null);assert.equal(store.metadata(frame.receivedAt+2501),null);
});
test('invalid and out-of-order camera observations are rejected',()=>{
  const store=createFrameStore();store.put(input());
  assert.throws(()=>store.put(input()),/Out-of-order/);
  for(const update of [{image:'nope'},{width:20},{pose:{x:NaN}},{capturedAt:0},{frameId:-1}])assert.throws(()=>createFrameStore().put({...input(),...update}));
});
test('walking stops at solid obstacles, slides alongside, and cannot tunnel',()=>{
  const boxes=[{minX:0,maxX:1,minZ:-2,maxZ:2}];
  const p={x:-1,z:0};moveWithCollisions(p,20,0,boxes);assert.ok(p.x<-.23);
  moveWithCollisions(p,1,1,boxes);assert.ok(p.x<-.23);assert.ok(p.z>.9);
  const free={x:-3,z:4};moveWithCollisions(free,1,-1,boxes);assert.ok(Math.abs(free.x+2)<1e-9);assert.ok(Math.abs(free.z-3)<1e-9);
});
