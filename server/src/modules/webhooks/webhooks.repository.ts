import { Injectable } from '@nestjs/common';
import { Transaction } from 'sequelize';
import { Receipt } from '../../database/models';
@Injectable()
export class WebhooksRepository {
 find(eventId:string,transaction?:Transaction) {return Receipt.findOne({where:{source:'meta',eventId},transaction,...(transaction?{lock:transaction.LOCK.UPDATE}:{})});}
 safe(receipt:Receipt) {return {receiptId:receipt.id,eventId:receipt.eventId,state:receipt.state,attempts:receipt.attempts,leadId:receipt.leadId,errorCode:receipt.errorCode,errorMessage:receipt.errorMessage,createdAt:receipt.createdAt,processedAt:receipt.processedAt};}
}
