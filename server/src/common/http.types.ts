import { Request } from 'express';
export interface Principal {
  id: string;
  email: string;
  sessionId: string;
}
export interface ApiRequest extends Request {
  principal?: Principal;
  requestId: string;
  rawBody?: Buffer;
  webhookCredentialId?: string;
}
