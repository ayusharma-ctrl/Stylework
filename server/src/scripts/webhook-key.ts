import 'reflect-metadata';
import {DatabaseService} from '../database/database.service';
import {WebhookCredentialsService} from '../modules/webhooks/webhook-credentials.service';
async function main(){
 const db=new DatabaseService(),service=new WebhookCredentialsService();
 try{
  const [command,...rest]=process.argv.slice(2);
  if(command==='create'||command==='import'){
   if(command==='import'&&!process.env.WEBHOOK_KEY)throw new Error('Set client input WEBHOOK_KEY to import a provided key');
   console.log(JSON.stringify(await service.create(rest.join(' ')||'Manual sender',command==='import'?process.env.WEBHOOK_KEY:undefined),null,2));
   console.log('Save this key now. Only its hash is stored in PostgreSQL.');
  }else if(command==='list')console.log(JSON.stringify(await service.list(),null,2));
  else if(command==='revoke'){if(!rest[0])throw new Error('Provide a credential ID');await service.revoke(rest[0]);console.log('Credential revoked');}
  else throw new Error('Usage: webhook:key create NAME | import NAME | list | revoke ID');
 }finally{await db.sequelize.close();}
}
void main().catch(error=>{console.error(error.message);process.exitCode=1;});
