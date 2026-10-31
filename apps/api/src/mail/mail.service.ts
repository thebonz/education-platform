import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';

export type OutgoingMail = { to: string; subject: string; text: string; html: string };

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  /** Hộp thư trong bộ nhớ, chỉ dùng khi MAIL_TRANSPORT=memory (test). */
  readonly outbox: OutgoingMail[] = [];

  async send(mail: OutgoingMail): Promise<void> {
    const e = env();
    if (e.MAIL_TRANSPORT === 'memory') {
      this.outbox.push(mail);
      return;
    }
    if (e.MAIL_TRANSPORT === 'log') {
      // Chỉ dùng ở máy dev: in nội dung để lấy link xác thực. Không bật ở production (env.ts chặn).
      this.logger.log(`[DEV MAIL] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
      return;
    }
    this.transporter ??= nodemailer.createTransport({
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      secure: e.SMTP_SECURE,
      auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
    });
    try {
      await this.transporter.sendMail({ from: e.MAIL_FROM, ...mail });
    } catch (error) {
      // Không làm hỏng luồng đăng ký vì lỗi SMTP; người dùng có thể gửi lại.
      this.logger.error(`Gửi email thất bại tới domain ${mail.to.split('@')[1]}: ${(error as Error).message}`);
    }
  }
}
