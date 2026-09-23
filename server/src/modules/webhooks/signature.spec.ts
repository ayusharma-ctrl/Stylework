import { createHmac } from 'node:crypto';
import { verifyDelivery } from './signature';
import { webhookSchema } from './webhook.dto';
describe('signed delivery',()=>{
 const now=1800000000000,raw=Buffer.from('{"hello":"world"}'),timestamp=String(now/1000),secret='example-secret';
 const headers={'x-webhook-key-id':'key','x-webhook-timestamp':timestamp,'x-webhook-signature':'sha256='+createHmac('sha256',secret).update(timestamp+'.').update(raw).digest('hex')};
 it('accepts a fresh authentic body',()=>expect(()=>verifyDelivery(raw,headers,'key',secret,now)).not.toThrow());
 it('rejects body tampering',()=>expect(()=>verifyDelivery(Buffer.from('{}'),headers,'key',secret,now)).toThrow());
 it('rejects stale delivery timestamps',()=>expect(()=>verifyDelivery(raw,headers,'key',secret,now+300001)).toThrow('window'));
 it('requires a contact method',()=>expect(webhookSchema.safeParse({eventId:'test',externalLeadId:'test',version:1,occurredAt:new Date().toISOString(),data:{fullName:'Person'}}).success).toBe(false));
});
