import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import 'dotenv/config';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const localPython=resolve(root,'.venv-assistant',process.platform==='win32'?'Scripts/python.exe':'bin/python');
const python=process.env.ASSISTANT_PYTHON || (existsSync(localPython)?localPython:'python');
const target=new URL(process.env.PYTHON_ASSISTANT_URL || 'http://127.0.0.1:8000');
const children=[];let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill();setTimeout(()=>process.exit(code),300);}
function launch(command,args){
  const child=spawn(command,args,{cwd:root,stdio:'inherit',windowsHide:true});children.push(child);
  child.on('error',error=>{console.error(error.message);console.error('Install the Python assistant dependencies; see docs/10-voice-assistant.md.');stop(1);});
  child.on('exit',code=>{if(!stopping)stop(code || 0);});
}
launch(python,['-m','uvicorn','backend.main:app','--host',target.hostname,'--port',target.port || '8000','--no-access-log']);
if(process.argv.includes('--all'))launch(process.execPath,['backend/server.js']);
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
