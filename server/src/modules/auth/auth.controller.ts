import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Public } from '../../common/public.decorator';
import { ApiRequest } from '../../common/http.types';
import { ZodPipe } from '../../common/zod.pipe';
import { AuthService } from './auth.service';
import { signinSchema, SigninDto } from './auth.dto';
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public() @Post('signin') @HttpCode(200)
  signin(@Body(new ZodPipe(signinSchema)) body: SigninDto) { return this.auth.signin(body.email); }
  @Post('signout') @HttpCode(200)
  signout(@Req() req:ApiRequest) { return this.auth.signout(req.principal!.sessionId); }
}
