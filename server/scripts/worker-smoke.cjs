const {bootstrapWorker}=require('../dist/worker');
const {JobsService}=require('../dist/modules/jobs/jobs.service');
const {LeadProcessor}=require('../dist/modules/jobs/lead-processor.service');
const {Receipt,Activity}=require('../dist/database/models');
(async()=>{
 const app=await bootstrapWorker();
 try{
  const receipt=await Receipt.findOne({order:[['createdAt','DESC']]});
  if(!receipt)throw Error('Run intake smoke before worker smoke');
  let current;
  for(let i=0;i<100;i++){current=await Receipt.findByPk(receipt.id);if(current.state!=='pending')break;await new Promise(r=>setTimeout(r,100));}
  if(current.state!=='processed')throw Error('Processing did not complete: '+current.state+' '+current.errorCode);
  await Promise.all([app.get(LeadProcessor).process(receipt.id),app.get(LeadProcessor).process(receipt.id)]);
  if(await Activity.count({where:{leadId:current.leadId,type:'LEAD_CREATED'}})!==1)throw Error('Duplicate lead audit');
  console.log('PASS worker smoke: durable processing and idempotent redelivery');
 }finally{await app.get(JobsService).stop();await app.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1});
