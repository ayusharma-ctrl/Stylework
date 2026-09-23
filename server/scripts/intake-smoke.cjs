const {bootstrap}=require('../dist/main');
const {randomUUID}=require('node:crypto');
const {WebhookCredentialsService}=require('../dist/modules/webhooks/webhook-credentials.service');
(async()=>{
 const app=await bootstrap();
 const keys=app.get(WebhookCredentialsService),credential=await keys.create('Intake smoke');
 try{
  const base='http://127.0.0.1:'+(process.env.PORT||3000);
  const payload={eventId:randomUUID(),externalLeadId:'smoke-'+randomUUID(),version:1,occurredAt:new Date().toISOString(),data:{fullName:'Intake smoke',email:'intake@example.test'}};
  async function send(value,valid=true){return fetch(base+'/webhook/meta-lead',{method:'POST',headers:{'Content-Type':'application/json','X-Webhook-Key':valid?credential.key:'invalid'},body:JSON.stringify(value)});}
  if((await send(payload,false)).status!==401)throw Error('Key rejection failed');
  const results=await Promise.all(Array.from({length:10},()=>send(payload)));
  if(results.filter(r=>r.status===202).length!==1||results.filter(r=>r.status===200).length!==9)throw Error('Duplicate acceptance mismatch');
  if((await send({...payload,data:{...payload.data,fullName:'Conflicting'}})).status!==409)throw Error('Conflict rejection failed');
  await keys.revoke(credential.id);
  if((await send(payload)).status!==401)throw Error('Key revocation failed');
  console.log('PASS intake smoke: database key, concurrent duplicates, payload conflict, key revocation');
 }finally{await keys.revoke(credential.id);await app.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1});
