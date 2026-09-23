const {bootstrap}=require('../dist/main');
const {createHmac,randomUUID}=require('node:crypto');
(async()=>{
 const app=await bootstrap();
 try{
  const base='http://127.0.0.1:'+(process.env.PORT||3000);
  const payload={eventId:randomUUID(),externalLeadId:'smoke-'+randomUUID(),version:1,occurredAt:new Date().toISOString(),data:{fullName:'Intake smoke',email:'intake@example.test'}};
  async function send(value,valid=true){const body=JSON.stringify(value),timestamp=String(Math.floor(Date.now()/1000));const signature='sha256='+createHmac('sha256',process.env.WEBHOOK_SECRET||'local-webhook-secret-change-before-deploy-123').update(timestamp+'.').update(body).digest('hex');return fetch(base+'/webhook/meta-lead',{method:'POST',headers:{'Content-Type':'application/json','X-Webhook-Key-Id':process.env.WEBHOOK_KEY_ID||'local-meta','X-Webhook-Timestamp':timestamp,'X-Webhook-Signature':valid?signature:'sha256='+'0'.repeat(64)},body});}
  if((await send(payload,false)).status!==401)throw Error('Signature rejection failed');
  const results=await Promise.all(Array.from({length:10},()=>send(payload)));
  if(results.filter(r=>r.status===202).length!==1||results.filter(r=>r.status===200).length!==9)throw Error('Duplicate acceptance mismatch');
  if((await send({...payload,data:{...payload.data,fullName:'Conflicting'}})).status!==409)throw Error('Conflict rejection failed');
  console.log('PASS intake smoke: signature, concurrent duplicate acceptance, payload conflict');
 }finally{await app.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1});
