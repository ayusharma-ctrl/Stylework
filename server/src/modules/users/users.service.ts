import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';
@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}
  findOrCreate(email: string) { return this.repository.findOrCreate(email); }
  find(id: string) { return this.repository.find(id); }
  profile(id: string) { return this.repository.profile(id); }
  async updateTheme(id: string, theme: 'light'|'dark'|'system') {
    const user = await this.find(id);
    await user.update({ meta: { ...user.meta, theme } });
    return { id: user.id, email: user.email, meta: user.meta };
  }
}
