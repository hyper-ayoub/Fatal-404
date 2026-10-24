import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateTelemetry, evaluate} from '../backend/policy.js';
const sample = (center,receivedAt=1000) => ({simulator:{distances:{left:null,center,right:3},receivedAt}});
test('proximity thresholds, direction and pulse rate',()=>{
  assert.equal(evaluate(sample(.4),'simulator',1000).level,'danger');
  assert.equal(evaluate(sample(.4),'simulator',1000).pulseMs,180);
  assert.equal(evaluate(sample(.7),'simulator',1000).level,'warning');
  assert.equal(evaluate(sample(1.5),'simulator',1000).level,'clear');
  assert.equal(evaluate(sample(2),'simulator',1000).direction,'center');
});
test('missing/stale data cannot appear clear',()=>{
  assert.equal(evaluate({},'wokwi',1000).level,'unknown');
  assert.equal(evaluate(sample(.4),'simulator',3501).level,'unknown');
  assert.equal(evaluate({simulator:{distances:{left:null,center:null,right:null},receivedAt:1000}},'simulator',1000).level,'unknown');
});
test('switching source never falls back to simulator data',()=>{
  assert.equal(evaluate(sample(.4),'wokwi',1000).level,'unknown');
});
test('invalid or incomplete sensor messages are rejected',()=>{
  for (const center of [-1,11,'0.5',NaN]) assert.throws(()=>validateTelemetry({source:'wokwi',distances:{left:1,center,right:1}}));
  assert.throws(()=>validateTelemetry({source:'wokwi',distances:{center:1}}));
  assert.equal(validateTelemetry({source:'wokwi',distances:{left:null,center:1,right:2}}).distances.left,null);
});
test('camera labels cannot introduce metric depth into the protocol',()=>{
  const result=validateTelemetry({source:'vision',detections:[{label:'chair',confidence:.9,direction:'left',distance:.2}]});
  assert.equal(result.detections[0].distance,undefined);
  assert.throws(()=>validateTelemetry({source:'vision',detections:[{label:'chair',confidence:3,direction:'left'}]}));
});
