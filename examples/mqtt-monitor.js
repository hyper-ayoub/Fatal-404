import 'dotenv/config';
import mqtt from 'mqtt';
const countIndex=process.argv.indexOf('--count');
const limit=countIndex>=0?Number(process.argv[countIndex+1]):Infinity;
if(!(limit>0))throw new Error('--count must be positive');
const topic=`openpilot/${process.env.MQTT_SESSION || 'um6p-change-me-2026'}`;
const client=mqtt.connect(process.env.MQTT_URL || 'mqtt://broker.hivemq.com:1883',{
  clientId:`openpilot-monitor-${crypto.randomUUID()}`,reconnectPeriod:2000,connectTimeout:8000,
  ...(process.env.MQTT_USERNAME?{username:process.env.MQTT_USERNAME}:{}),...(process.env.MQTT_PASSWORD?{password:process.env.MQTT_PASSWORD}:{})
});
let received=0;const observed=new Set();
const required=['simulator/telemetry','simulator/observation','haptic',...(process.env.MQTT_PUBLISH_IMAGES==='true'?['simulator/camera/frame']:[])];
const timer=Number.isFinite(limit)?setTimeout(()=>{console.error('Timed out waiting for required live MQTT topics. Keep the simulator tab visible.');client.end(true);process.exitCode=1;},20000):null;
client.on('connect',()=>client.subscribe(`${topic}/#`,error=>{if(error)throw error;console.log(`Subscribed to ${topic}/#`);}));
client.on('error',error=>console.error('MQTT:',error.message));
client.on('message',(name,buffer,packet)=>{
  if(packet.retain)return;
  const suffix=name.slice(topic.length+1);let data;
  try{data=JSON.parse(buffer.toString());}catch{return;}
  observed.add(suffix);received++;
  console.log(JSON.stringify({topic:suffix,frameId:data.frameId,level:data.level || data.alert?.level,distances:data.distances,imageBytes:data.image?Buffer.from(data.image,'base64').length:undefined}));
  if(received>=limit && required.every(name=>observed.has(name))){
    console.log(`Verified ${received} non-retained messages across ${required.length} required topics.`);if(timer)clearTimeout(timer);client.end();
  }
});
process.on('SIGINT',()=>{if(timer)clearTimeout(timer);client.end();});
