import { Injectable, NotFoundException } from '@nestjs/common';
import { Status, User, Workspace } from '../../database/models';
@Injectable()
export class UsersRepository {
  async findOrCreate(email: string) {
    return (await User.findOrCreate({ where: { email }, defaults: { email, meta: {} } }))[0];
  }
  async find(id: string) {
    const user = await User.findByPk(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
  async profile(id: string) {
    const [user, statuses, workspace] = await Promise.all([
      this.find(id),
      Status.findAll({
        order: [
          ['position', 'ASC'],
          ['id', 'ASC'],
        ],
      }),
      Workspace.findByPk(1),
    ]);
    return {
      user: { id: user.id, email: user.email, meta: user.meta, createdAt: user.createdAt },
      statuses: statuses.map((s) => s.toJSON()),
      workspace: workspace!.toJSON(),
    };
  }
}
