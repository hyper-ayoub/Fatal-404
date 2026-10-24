import mqtt from 'mqtt';

export function createMqttBridge({onTelemetry, config=process.env}) {
  const enabled=config.MQTT_ENABLED==='true';
  const session=config.MQTT_SESSION || 'um6p-change-me-2026';
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(session))throw new Error('MQTT_SESSION must contain only letters, digits, underscores or hyphens');
  const prefix=`openpilot/${session}`;
  const topics={status:`${prefix}/status`,wokwiTelemetry:`${prefix}/telemetry`,haptic:`${prefix}/haptic`,simulatorTelemetry:`${prefix}/simulator/telemetry`,observation:`${prefix}/simulator/observation`,cameraFrame:`${prefix}/simulator/camera/frame`};
  const url=config.MQTT_URL || 'mqtt://broker.hivemq.com:1883';
  const parsed=new URL(url);
  const status={enabled,connected:false,broker:`${parsed.protocol}//${parsed.hostname}${parsed.port?':'+parsed.port:''}`,topicPrefix:prefix,topics,imagesEnabled:config.MQTT_PUBLISH_IMAGES==='true',publishedMessages:0,receivedMessages:0,lastPublishedAt:null,lastReceivedAt:null,lastError:null};
  let client=null,lastImageAt=0,lastHaptic='',lastHapticAt=0;
  function publish(topic,payload,{qos=0,retain=false}={}) {
    if(!client?.connected)return false;
    client.publish(topic,typeof payload==='string'?payload:JSON.stringify(payload),{qos,retain},error=>{
      if(error){status.lastError=error.message;return;}
      status.publishedMessages++;status.lastPublishedAt=Date.now();
    });return true;
  }
  if(enabled) {
    client=mqtt.connect(url,{
      clientId:`openpilot-backend-${crypto.randomUUID()}`,connectTimeout:8000,reconnectPeriod:3000,queueQoSZero:false,
      ...(config.MQTT_USERNAME?{username:config.MQTT_USERNAME}:{}),...(config.MQTT_PASSWORD?{password:config.MQTT_PASSWORD}:{}),
      will:{topic:topics.status,payload:JSON.stringify({online:false,source:'backend'}),qos:1,retain:true}
    });
    client.on('connect',()=>{
      status.connected=true;status.lastError=null;lastHaptic='';lastImageAt=0;
      client.subscribe(topics.wokwiTelemetry,{qos:0},error=>{if(error)status.lastError=error.message;});
      publish(topics.status,{online:true,source:'backend',connectedAt:Date.now()},{qos:1,retain:true});
      console.log(`MQTT connected: ${status.broker} / ${prefix}`);
    });
    client.on('close',()=>{status.connected=false;});
    client.on('error',error=>{status.lastError=error.message;console.error('MQTT:',error.message);});
    client.on('message',(topic,payload,packet)=>{
      if(topic!==topics.wokwiTelemetry || packet.retain || payload.length>65536)return;
      try {
        const body=JSON.parse(payload.toString());if(body.source!=='wokwi')return;
        onTelemetry(body);status.receivedMessages++;status.lastReceivedAt=Date.now();
      }catch{status.lastError='Ignored invalid Wokwi telemetry';}
    });
  }
  return {
    status:()=>({...status}),
    publishObservation(frame,alert) {
      if(!client?.connected)return;
      const {bytes,...data}=frame;
      publish(topics.simulatorTelemetry,{source:'simulator',sessionId:frame.sessionId,frameId:frame.frameId,capturedAt:frame.capturedAt,receivedAt:frame.receivedAt,distances:frame.distances});
      publish(topics.observation,{...data,kind:'rendered-simulator-camera',alert,cameraFrameTopic:status.imagesEnabled?topics.cameraFrame:null});
      if(status.imagesEnabled && Date.now()-lastImageAt>=1000){
        lastImageAt=Date.now();publish(topics.cameraFrame,{...data,kind:'rendered-simulator-camera',mimeType:'image/jpeg',image:bytes.toString('base64')});
      }
    },
    publishHaptic(alert,source) {
      const forward=source==='wokwi' || config.MQTT_FORWARD_SIM_HAPTICS==='true';
      const body={source,level:forward?alert.level:'unknown',pulseMs:forward?alert.pulseMs:0};
      const command=JSON.stringify(body);
      if(client?.connected && (command!==lastHaptic || Date.now()-lastHapticAt>=1000)){
        publish(topics.haptic,command);lastHaptic=command;lastHapticAt=Date.now();
      }
    },
    close() {
      if(!client)return;
      if(client.connected)publish(topics.status,{online:false,source:'backend',disconnectedAt:Date.now()},{qos:1,retain:true});
      client.end(false);
    }
  };
}
