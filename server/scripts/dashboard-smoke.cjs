const assert=require('node:assert/strict');
const {bootstrap}=require('../dist/main');
const {RedisService}=require('../dist/common/security/redis.service');
(async()=>{
 const app=await bootstrap(),abort=new AbortController();
 try{
  const base='http://127.0.0.1:'+(process.env.PORT||3000);
  const profile=(await (await fetch(base+'/signin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'dashboard-smoke@example.test'})})).json()).data;
  const headers={'Content-Type':'application/json',Authorization:'Bearer '+profile.tokens.accessToken,'X-Refresh-Token':profile.tokens.refreshToken};
  const stream=await fetch(base+'/dashboard/stream',{headers,signal:abort.signal});assert.equal(stream.status,200);assert.match(stream.headers.get('content-type'),/text\/event-stream/);
  const reader=stream.body.getReader();let buffered='';
  async function snapshot(){const deadline=setTimeout(()=>abort.abort(),7000);try{for(;;){const split=buffered.indexOf('\n\n');if(split>=0){const frame=buffered.slice(0,split);buffered=buffered.slice(split+2);const line=frame.split('\n').find(line=>line.startsWith('data: '));if(line)return JSON.parse(line.slice(6));}else{const chunk=await reader.read();if(chunk.done)throw Error('Stream closed');buffered+=new TextDecoder().decode(chunk.value);}}}finally{clearTimeout(deadline);}}
  const initial=await snapshot();assert.equal(initial.metrics.length,4);assert.equal(initial.timezone,'Asia/Kolkata');assert.ok(initial.statuses.length>=5);
  const lead=(await (await fetch(base+'/leads?first=1',{headers})).json()).data.nodes[0];const target=profile.statuses.find(s=>!s.archivedAt&&s.id!==lead.status.id);
  const changed=await fetch(base+'/leads/'+lead.id+'/status',{method:'PATCH',headers,body:JSON.stringify({statusId:target.id,expectedVersion:lead.version})});assert.equal(changed.status,200);
  // Simulate a delivered committed notification; outbox delivery is covered by worker smoke.
  await app.get(RedisService).client.publish('sw:changes','{}');
  const next=await snapshot();assert.notEqual(initial.revision,next.revision);
  assert.equal(next.statuses.find(s=>s.id===target.id).value,initial.statuses.find(s=>s.id===target.id).value+1);
  abort.abort();await reader.cancel().catch(()=>{});
  await fetch(base+'/signout',{method:'POST',headers,body:'{}'});
  console.log('PASS dashboard smoke: authenticated immediate snapshot and committed status counter update');
 }finally{abort.abort();await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
