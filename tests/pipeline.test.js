import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {WebSocket} from 'ws';

test('HTTP -> state -> WebSocket -> assistant, source isolation and stale readings', async t=>{
  const child=spawn(process.execPath,['backend/server.js'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',AI_MODE:'demo',MQTT_ENABLED:'false'},stdio:['ignore','pipe','pipe']});
  t.after(()=>child.kill());
  const base=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Server startup timed out')),10000);
    child.once('error',reject);
    child.stdout.on('data',data=>{const match=data.toString().match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});
    child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Server exited: ${code}`));});
  });
  const post=async(path,body)=>fetch(`${base}/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await fetch(base)).status,200);
  assert.equal((await fetch(`${base}/vendor/three/three.module.js`)).status,200);
  let response=await post('telemetry',{source:'simulator',distances:{left:2,center:.4,right:3}});
  assert.equal(response.status,200);
  let state=await (await fetch(`${base}/api/state`)).json();assert.equal(state.alert.level,'danger');
  const ws=new WebSocket(base.replace('http','ws')+'/ws');t.after(()=>ws.close());
  const message=once(ws,'message');await once(ws,'open');
  assert.equal(JSON.parse((await message)[0].toString()).alert.level,'danger');
  response=await post('ask',{question:'What is ahead?'});const answer=await response.json();
  assert.equal(answer.mode,'demo');assert.match(answer.text,/Stop/);
  assert.equal((await post('telemetry',{source:'wokwi',distances:{left:1,center:-1,right:1}})).status,400);
  await post('source',{source:'wokwi'});
  state=await (await fetch(`${base}/api/state`)).json();assert.equal(state.alert.level,'unknown');
  await post('telemetry',{source:'wokwi',distances:{left:2,center:1,right:3}});
  state=await (await fetch(`${base}/api/state`)).json();assert.equal(state.alert.level,'warning');
  await new Promise(resolve=>setTimeout(resolve,2600));
  state=await (await fetch(`${base}/api/state`)).json();assert.equal(state.alert.level,'unknown');assert.equal(state.sensors,null);
  assert.equal((await post('ask',{question:''})).status,400);
  assert.equal((await fetch(`${base}/.env`)).status,404);
});
