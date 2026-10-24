import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';

// Same-origin browser transport; Python owns the assistant and all provider calls.
export function pythonAssistantProxy(req,res) {
  const base=process.env.PYTHON_ASSISTANT_URL || 'http://127.0.0.1:8000';
  const target=new URL(req.originalUrl,base);
  if(!['http:','https:'].includes(target.protocol))return res.status(502).json({error:'Invalid Python assistant URL'});
  const headers={...req.headers,host:target.host};delete headers.connection;delete headers['transfer-encoding'];
  const json=req.is('application/json') && req.body!==undefined ? Buffer.from(JSON.stringify(req.body)) : null;
  if(json)headers['content-length']=String(json.length);
  if(Number(headers['content-length'] || 0)>6*1024*1024)return res.status(413).json({error:'Record a shorter utterance'});
  const upstream=(target.protocol==='https:'?httpsRequest:httpRequest)(target,{method:req.method,headers},response=>{
    res.status(response.statusCode || 502);
    for(const key of ['content-type','cache-control','x-accel-buffering'])if(response.headers[key])res.setHeader(key,response.headers[key]);
    res.flushHeaders();response.pipe(res);
    response.on('error',()=>res.destroy());
  });
  upstream.setTimeout(60000,()=>upstream.destroy(new Error('Python assistant timed out')));
  upstream.on('error',()=>{
    if(!res.headersSent)res.status(503).json({error:'Python assistant is offline. Start backend.main on port 8000.'});
    else res.end();
  });
  req.on('aborted',()=>upstream.destroy());
  res.on('close',()=>{if(!res.writableEnded)upstream.destroy();});
  if(json)upstream.end(json);else req.pipe(upstream);
}
