import { Global, Module } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionService, MailService],
  exports: [AuthService, SessionService, MailService],
})
export class AuthModule {}
