// OpenPilot: 3 ultrasonic rays, MQTT telemetry and non-blocking servo pulses.
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

const char* BROKER = "broker.hivemq.com";
const int BROKER_PORT = 1883;
// MUST match MQTT_SESSION in the backend .env. Choose your own unique value.
const char* SESSION = "um6p-0654c473a7b4";
const int TRIG[] = {5, 19, 22};
const int ECHO[] = {18, 21, 23};
WiFiClient network;
PubSubClient mqtt(network);
Servo haptic;
String telemetryTopic, commandTopic;
unsigned long lastSample=0, lastReconnect=0, remoteAt=0, pulseAt=0;
int localPeriod=0, remotePeriod=0;
bool tapping=false, hasRemote=false;

void command(char* topic, byte* payload, unsigned int length) {
  JsonDocument doc;
  if (deserializeJson(doc,payload,length)) return;
  const char* level=doc["level"] | "unknown";
  remotePeriod = strcmp(level,"danger")==0 ? 180 : strcmp(level,"warning")==0 ? 600 : 0;
  remoteAt=millis(); hasRemote=true;
}
float measure(int index) {
  digitalWrite(TRIG[index],LOW); delayMicroseconds(2);
  digitalWrite(TRIG[index],HIGH); delayMicroseconds(10); digitalWrite(TRIG[index],LOW);
  unsigned long duration=pulseIn(ECHO[index],HIGH,25000);
  return duration ? duration * 0.000343f / 2.0f : -1;
}
void setup() {
  Serial.begin(115200);
  for(int i=0;i<3;i++){pinMode(TRIG[i],OUTPUT);pinMode(ECHO[i],INPUT);}
  haptic.attach(13,500,2400);haptic.write(90);
  WiFi.begin("Wokwi-GUEST","",6);
  mqtt.setServer(BROKER,BROKER_PORT);mqtt.setCallback(command);mqtt.setBufferSize(512);mqtt.setSocketTimeout(1);
  telemetryTopic=String("openpilot/")+SESSION+"/telemetry";
  commandTopic=String("openpilot/")+SESSION+"/haptic";
}
void loop() {
  unsigned long now=millis();
  if(WiFi.status()==WL_CONNECTED && !mqtt.connected() && now-lastReconnect>3000){
    lastReconnect=now;
    String clientId=String("openpilot-esp32-")+String((uint32_t)ESP.getEfuseMac(),HEX);
    if(mqtt.connect(clientId.c_str())){mqtt.subscribe(commandTopic.c_str());Serial.println("MQTT connected");}
  }
  mqtt.loop();
  if(now-lastSample>=200){
    lastSample=now;JsonDocument doc;doc["source"]="wokwi";
    const char* directions[]={"left","center","right"};float nearest=100;
    for(int i=0;i<3;i++){
      float metres=measure(i);
      if(metres<.02f || metres>4.0f) doc["distances"][directions[i]]=nullptr;
      else {doc["distances"][directions[i]]=metres;nearest=min(nearest,metres);}
    }
    localPeriod=nearest<.7f ? 180 : nearest<1.5f ? 600 : 0;
    char payload[256];serializeJson(doc,payload,sizeof(payload));
    if(mqtt.connected())mqtt.publish(telemetryTopic.c_str(),payload,false);
    Serial.println(payload);
  }
  // Local warning always works without the broker or LLM. Remote commands expire.
  int remote=hasRemote && now-remoteAt<2500 ? remotePeriod : 0;
  int period=localPeriod && remote ? min(localPeriod,remote) : max(localPeriod,remote);
  if(!period){if(tapping){haptic.write(90);tapping=false;}pulseAt=now;}
  else if(!tapping && now-pulseAt>=(unsigned long)period){haptic.write(110);tapping=true;pulseAt=now;}
  else if(tapping && now-pulseAt>=80){haptic.write(90);tapping=false;}
}
