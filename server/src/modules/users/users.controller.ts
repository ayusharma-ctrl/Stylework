import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { z } from 'zod';
import { ApiRequest } from '../../common/http.types';
import { ZodPipe } from '../../common/zod.pipe';
import { UsersService } from './users.service';
const preferences = z.object({ theme: z.enum(['light', 'dark', 'system']) }).strict();
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get('me') me(@Req() req: ApiRequest) {
    return this.users.profile(req.principal!.id);
  }
  @Patch('me') update(
    @Req() req: ApiRequest,
    @Body(new ZodPipe(preferences)) body: z.infer<typeof preferences>,
  ) {
    return this.users.updateTheme(req.principal!.id, body.theme);
  }
}
