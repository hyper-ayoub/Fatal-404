import {validateTelemetry, STALE_MS} from './policy.js';

// One synchronized observation: pixels and range rays from the same render tick.
export function validateFrame(body) {
  if (!body || typeof body.sessionId !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(body.sessionId) || !Number.isSafeInteger(body.frameId) || body.frameId < 0) throw new Error('Invalid frame identity');
  if (body.width !== 640 || body.height !== 360) throw new Error('Expected a 640x360 frame');
  if (!Number.isFinite(body.capturedAt) || Math.abs(Date.now()-body.capturedAt)>30000) throw new Error('Invalid capture timestamp');
  if (!body.pose || !['x','y','z','yaw','pitch'].every(key=>Number.isFinite(body.pose[key]) && Math.abs(body.pose[key])<10000)) throw new Error('Invalid camera pose');
  if (typeof body.image !== 'string' || body.image.length>500000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.image)) throw new Error('Invalid JPEG encoding');
  const bytes=Buffer.from(body.image,'base64');
  if (bytes.length<4 || bytes[0]!==255 || bytes[1]!==216 || bytes.at(-2)!==255 || bytes.at(-1)!==217) throw new Error('Expected JPEG bytes');
  const sensor=validateTelemetry({source:'simulator',distances:body.distances});
  const pose=Object.fromEntries(['x','y','z','yaw','pitch'].map(key=>[key,body.pose[key]]));
  return {...sensor,sessionId:body.sessionId,frameId:body.frameId,capturedAt:body.capturedAt,width:640,height:360,pose,bytes};
}

export function createFrameStore() {
  let latest=null,owner=null;
  return {
    claim(sessionId,force=false) {
      if(typeof sessionId!=='string' || !/^[a-zA-Z0-9-]{1,64}$/.test(sessionId))throw new Error('Invalid camera session');
      if(owner && owner!==sessionId && latest && Date.now()-latest.receivedAt<=STALE_MS && !force)throw new Error('Another camera session is active');
      const changed=owner!==sessionId;owner=sessionId;if(changed)latest=null;return changed;
    },
    put(body) {
      if(owner && body?.sessionId!==owner)throw new Error('Another simulator tab controls the live camera. Focus this tab to reconnect.');
      const frame=validateFrame(body);
      if(latest?.sessionId===frame.sessionId && frame.frameId<=latest.frameId) throw new Error('Out-of-order frame');
      latest={...frame,receivedAt:Date.now()};return latest;
    },
    current(now=Date.now()) {return latest && now-latest.receivedAt<=STALE_MS ? latest : null;},
    metadata(now=Date.now()) {
      const frame=this.current(now); if(!frame)return null;
      const {bytes,...metadata}=frame;
      return {...metadata,kind:'rendered-simulator-camera',imageUrl:'/api/camera/latest.jpg',streamUrl:'/api/camera/stream.mjpg'};
    }
  };
}
