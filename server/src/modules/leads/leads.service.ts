import { Injectable } from '@nestjs/common';
import { ZodPipe } from '../../common/zod.pipe';
import { leadQuerySchema } from './leads.dto';
import { LeadsRepository } from './leads.repository';

@Injectable()
export class LeadsService {
  constructor(private readonly repository: LeadsRepository) { }

  list(input: unknown) {
    return this.repository.list(new ZodPipe(leadQuerySchema).transform(input));
  }

  find(id: string) {
    return this.repository.find(id);
  }
}
