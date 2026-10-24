import test from 'node:test';
import assert from 'node:assert/strict';
import {computeTempleHaptics} from '../frontend/haptics-policy.js';

test('side obstacles activate only the corresponding temple; center activates both',()=>{
  const left=computeTempleHaptics({left:1.1,center:5,right:5});
  assert.equal(left.left.level,'warning');assert.equal(left.right.intensity,0);
  const right=computeTempleHaptics({left:5,center:5,right:.4});
  assert.equal(right.left.intensity,0);assert.equal(right.right.level,'danger');
  const center=computeTempleHaptics({left:5,center:.4,right:5});
  assert.deepEqual(center.left,center.right);assert.equal(center.left.pulseMs,180);
  assert.ok(center.left.intensity>left.left.intensity);
});
test('stale and invalid haptic data never vibrates',()=>{
  for(const channels of [computeTempleHaptics({left:.2,center:.2,right:.2},false),computeTempleHaptics({left:NaN,center:-1,right:undefined})])
    for(const value of Object.values(channels)){assert.equal(value.level,'unknown');assert.equal(value.intensity,0);assert.equal(value.pulseMs,0);}
});
