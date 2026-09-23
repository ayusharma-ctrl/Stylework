import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { secureEqual } from '../../common/crypto';
export function verifyDelivery(raw:Buffer|undefined,headers:Record<string,unknown>,keyId:string,secret:string,now=Date.now()) {
 const timestamp=headers['x-webhook-timestamp'],signature=headers['x-webhook-signature'];
 if(!raw||headers['x-webhook-key-id']!==keyId||typeof timestamp!=='string'||!/^\d{10}$/.test(timestamp)||typeof signature!=='string'||!/^sha256=[a-f0-9]{64}$/.test(signature))throw new UnauthorizedException('Invalid webhook credentials');
 if(Math.abs(now-Number(timestamp)*1000)>300000)throw new UnauthorizedException('Webhook delivery timestamp is outside the allowed window');
 const expected='sha256='+createHmac('sha256',secret).update(timestamp+'.').update(raw).digest('hex');
 if(!secureEqual(expected,signature))throw new UnauthorizedException('Invalid webhook signature');
}
