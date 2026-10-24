const $=id=>document.getElementById(id);
const Recognition=window.SpeechRecognition || window.webkitSpeechRecognition;

export class VoiceAssistant {
  constructor() {
    this.config=null;this.sessionId=crypto.randomUUID();this.history=[];
    this.token=0;this.busy=false;this.voiceMode=false;this.listening=false;this.speaking=false;
    this.lastAnswer='';this.lastEvent=null;this.audio=null;this.recognition=null;this.abort=null;
    this.restartTimer=null;this.media=null;this.recorder=null;this.voiceContext=null;this.audioResolver=null;
    $('ask-form').onsubmit=e=>{e.preventDefault();this.run($('question').value);};
    $('voice-start').onclick=()=>this.voiceMode?this.stop():this.startVoice();
    $('voice-stop').onclick=()=>this.stop();
    $('voice-profile').value=localStorage.getItem('openpilot-voice') || 'warm';
    $('voice-profile').onchange=()=>localStorage.setItem('openpilot-voice',$('voice-profile').value);
    $('voice-preview').onclick=()=>{this.stop();this.status('Playing voice preview…','speaking');$('spoken-replies').checked=true;if(this.config?.voiceConfigured)$('eleven').checked=true;this.play({text:"Of course. Let me take a look.",audioUrl:'/api/assistant/voice-preview'},this.token).finally(()=>this.status('Ready to listen'));};
    $('microphone').onclick=()=>{this.stop();this.listen();};
    $('speak').onclick=()=>{
      if(!this.lastAnswer)return;
      const keepVoice=this.voiceMode;this.stop();this.voiceMode=keepVoice;
      if(keepVoice)$('voice-start').textContent='■ End voice conversation';
      this.play(this.lastEvent || {text:this.lastAnswer},this.token).finally(()=>this.scheduleListening());
    };
    this.loadConfig();
  }
  status(text,stage='ready') {$('voice-state').textContent=text;$('voice-state').dataset.stage=stage;}
  async loadConfig() {
    try {
      const response=await fetch('/api/assistant/config');const data=await response.json();
      if(!response.ok)throw new Error(data.error || data.detail || 'Python backend is offline');
      this.config=data;
      $('ai-mode').textContent=data.mode==='gemma'?(data.fallbackConfigured?'GEMMA · OPENAI BACKUP':'PYTHON · GEMMA VISION'):'PYTHON · DEMO';
      $('eleven').checked=data.voiceConfigured;
      this.status(data.mode==='demo'?'Ready · demo until Gemma keys are added':'Ready to listen');
    } catch(e) {this.status('Python assistant offline','error');$('answer').textContent=e.message;}
  }
  stop() {
    this.voiceMode=false;this.token++;this.abort?.abort();this.abort=null;
    clearTimeout(this.restartTimer);this.recognition?.abort();this.recognition=null;
    if(this.recorder?.state==='recording')this.recorder.stop();
    this.cleanupMic();this.stopAudio();this.busy=false;this.listening=false;
    $('ask').disabled=false;$('voice-start').textContent='◉ Start voice conversation';$('voice-stop').disabled=true;
    this.status('Stopped · ready for another request');
  }
  stopAudio() {
    if(this.audio){this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.audio=null;}
    if('speechSynthesis' in window)speechSynthesis.cancel();
    this.audioResolver?.();this.audioResolver=null;this.speaking=false;
  }
  cleanupMic() {
    this.media?.getTracks().forEach(track=>track.stop());this.media=null;
    if(this.voiceContext){this.voiceContext.close().catch(()=>{});this.voiceContext=null;}
  }
  async startVoice() {
    if(!this.config)await this.loadConfig();
    if(!this.config)return;
    this.stop();this.voiceMode=true;$('voice-start').textContent='■ End voice conversation';$('voice-stop').disabled=false;
    await this.listen();
  }
  scheduleListening() {
    clearTimeout(this.restartTimer);
    if(this.voiceMode && !this.busy && !this.listening && !this.speaking)this.restartTimer=setTimeout(()=>this.listen(),500);
  }
  async listen() {
    if(this.listening || this.busy || this.speaking)return;
    if(!this.config)await this.loadConfig();
    if(!this.config)return;
    const engine=$('voice-input').value;
    if(engine==='eleven' || !Recognition){
      if(!this.config.transcriptionConfigured){this.status('Type a request, or add ElevenLabs for microphone transcription','error');return;}
      return this.recordUtterance();
    }
    const token=this.token;const recognition=new Recognition();this.recognition=recognition;
    recognition.lang=navigator.language || 'en-US';recognition.interimResults=true;recognition.continuous=false;
    this.listening=true;$('voice-stop').disabled=false;this.status('Listening… say what you need','listening');
    recognition.onresult=e=>{
      if(token!==this.token)return;
      const result=e.results[e.resultIndex];const text=result[0].transcript;
      $('question').value=text;$('voice-transcript').textContent=`You: ${text}`;
      if(result.isFinal){this.listening=false;recognition.stop();this.run(text);}
    };
    recognition.onerror=e=>{
      if(token!==this.token)return;
      this.listening=false;
      if(e.error==='no-speech'){this.status('No speech detected · listening again');return;}
      if(e.error!=='aborted'){
        this.voiceMode=false;$('voice-start').textContent='◉ Start voice conversation';
        this.status(`Microphone: ${e.error}. You can type a request.`, 'error');
      }
    };
    recognition.onend=()=>{if(token===this.token){this.listening=false;this.scheduleListening();}};
    try{recognition.start();}catch{this.listening=false;this.status('Microphone could not start. Try again or type your request.','error');}
  }
  async recordUtterance() {
    const token=this.token;this.listening=true;
    try {
      this.media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
      if(token!==this.token){this.cleanupMic();return;}
      const AudioContext=window.AudioContext || window.webkitAudioContext;
      this.voiceContext=new AudioContext();await this.voiceContext.resume();
      const analyser=this.voiceContext.createAnalyser();analyser.fftSize=2048;
      this.voiceContext.createMediaStreamSource(this.media).connect(analyser);
      const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(type=>MediaRecorder.isTypeSupported(type));
      const recorder=new MediaRecorder(this.media,mime?{mimeType:mime}:{});this.recorder=recorder;
      const chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recorder.onstop=async()=>{
        this.cleanupMic();this.listening=false;
        if(token!==this.token)return;
        const blob=new Blob(chunks,{type:recorder.mimeType});
        if(!heard){this.status('No speech detected');this.scheduleListening();return;}
        this.busy=true;this.status('Transcribing your request…','analyzing');
        try {
          const form=new FormData();form.append('audio',blob,recorder.mimeType.includes('mp4')?'utterance.mp4':'utterance.webm');
          this.abort=new AbortController();
          const response=await fetch('/api/assistant/transcribe',{method:'POST',body:form,signal:this.abort.signal});
          const data=await response.json();if(!response.ok)throw new Error(data.detail || data.error || 'Transcription failed');
          if(token!==this.token)return;this.busy=false;$('question').value=data.text;await this.run(data.text);
        }catch(e){if(e.name!=='AbortError'){this.status(e.message,'error');this.voiceMode=false;$('voice-start').textContent='◉ Start voice conversation';}}
        finally{if(token===this.token)this.busy=false;}
      };
      recorder.start();this.status('Listening… pause briefly when finished','listening');$('voice-stop').disabled=false;
      const buffer=new Float32Array(analyser.fftSize);const started=performance.now();let heard=false,lastSpeech=started;
      const detect=()=>{
        if(token!==this.token || recorder.state!=='recording')return;
        analyser.getFloatTimeDomainData(buffer);const rms=Math.sqrt(buffer.reduce((sum,n)=>sum+n*n,0)/buffer.length);const now=performance.now();
        if(rms>.018){heard=true;lastSpeech=now;}
        if((heard && now-lastSpeech>900 && now-started>500) || now-started>15000 || (!heard && now-started>6000))recorder.stop();
        else requestAnimationFrame(detect);
      };detect();
    }catch(e){this.cleanupMic();this.listening=false;this.voiceMode=false;$('voice-start').textContent='◉ Start voice conversation';this.status(`Microphone unavailable: ${e.message}`,'error');}
  }
  async play(event,token) {
    if(token!==this.token || !$('spoken-replies').checked)return;
    this.speaking=true;
    try {
      if($('eleven').checked && this.config?.voiceConfigured && event.audioUrl){
        try {
          await new Promise((resolve,reject)=>{
            const audio=new Audio(`${event.audioUrl}?voice=${encodeURIComponent($('voice-profile').value)}`);this.audio=audio;this.audioResolver=resolve;
            const timeout=setTimeout(()=>{audio.pause();reject(new Error('Voice playback timed out'));},35000);
            const done=()=>{clearTimeout(timeout);resolve();};this.audioResolver=()=>{clearTimeout(timeout);audio.pause();resolve();};
            audio.onended=done;audio.onerror=()=>{clearTimeout(timeout);reject(new Error('ElevenLabs playback failed'));};
            audio.play().catch(error=>{clearTimeout(timeout);reject(error);});
          });return;
        }catch{if(token===this.token)this.status('Using browser voice for this reply');}
      }
      if(token!==this.token)return;
      if(!('speechSynthesis' in window)){this.status('Voice unavailable · response is shown below');return;}
      await new Promise(resolve=>{
        const utterance=new SpeechSynthesisUtterance(event.text);this.audioResolver=resolve;
        utterance.rate=.98;utterance.pitch=1;
        const timeout=setTimeout(resolve,35000);const done=()=>{clearTimeout(timeout);resolve();};this.audioResolver=done;
        utterance.onend=done;utterance.onerror=done;speechSynthesis.speak(utterance);
      });
    }finally{if(token===this.token){this.speaking=false;this.audioResolver=null;}}
  }
  async run(question) {
    question=question.trim();if(!question)return;
    const keepVoice=this.voiceMode;this.stop();this.voiceMode=keepVoice;
    if(keepVoice)$('voice-start').textContent='■ End voice conversation';
    const token=this.token;this.busy=true;$('ask').disabled=true;$('voice-stop').disabled=false;
    $('voice-transcript').textContent=`You: ${question}`;
    this.status('Connecting to the Python assistant…','analyzing');
    let queue=Promise.resolve();let finalAnswer=null;
    this.abort=new AbortController();
    try {
      const response=await fetch('/api/assistant/turn',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,sessionId:this.sessionId,history:this.history.slice(-6)}),signal:this.abort.signal});
      if(!response.ok){const data=await response.json();throw new Error(data.error || data.detail || 'Assistant request failed');}
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffered='';
      const event=data=>{
        if(token!==this.token)return;
        if(data.type==='ack'){
          $('answer').textContent=data.text;this.status('Acknowledged · checking your surroundings','analyzing');
          queue=queue.then(()=>this.play(data,token));
        }else if(data.type==='analyzing'){
          this.status(`Analyzing image #${data.frameId} and ${data.distanceSource} sensors…`,'analyzing');
          $('voice-context').textContent=`Frame ${data.frameId} · ${data.transport.toUpperCase()} · ${data.aligned?'matched image + range rays':'camera and distance sources differ'}`;
        }else if(data.type==='answer' || data.type==='error'){
          $('answer').textContent=data.text;this.lastAnswer=data.text;this.lastEvent=data;
          this.status(data.type==='error'?data.text:'Speaking the description…',data.type==='error'?'error':'speaking');
          if(data.type==='answer'){
            finalAnswer=data.text;$('ai-mode').textContent=data.mode==='openai'?`OPENAI · ${data.model.toUpperCase()} · FALLBACK`:data.mode==='gemma'?'PYTHON · GEMMA VISION':'PYTHON · DEMO';
          }
          if(data.mode==='sensor-only')$('ai-mode').textContent='LIVE SENSORS · IMAGE AI UNAVAILABLE';
          queue=queue.then(()=>this.play(data,token));
        }
      };
      while(true){const {done,value}=await reader.read();buffered+=decoder.decode(value || new Uint8Array(),{stream:!done});const lines=buffered.split('\n');buffered=lines.pop();for(const line of lines)if(line.trim())event(JSON.parse(line));if(done)break;}
      if(buffered.trim())event(JSON.parse(buffered));
      await queue;
      if(token===this.token && finalAnswer){this.history.push({role:'user',text:question},{role:'model',text:finalAnswer});this.history=this.history.slice(-6);this.status(this.voiceMode?'Ready for your next question':'Ready · ask another question');}
    }catch(e){if(e.name!=='AbortError' && token===this.token){this.status(e.message,'error');$('answer').textContent=e.message;}}
    finally{if(token===this.token){this.busy=false;$('ask').disabled=false;$('voice-stop').disabled=!this.voiceMode;this.scheduleListening();}}
  }
}
