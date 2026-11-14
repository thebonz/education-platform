import { createServer, Server } from 'node:net';
import type { AddressInfo } from 'node:net';
import { resetEnvCache } from '../../src/config/env';
import { MailService } from '../../src/mail/mail.service';

/** SMTP giả tối thiểu (không TLS, không xác thực) để kiểm tra MailService gửi thật qua nodemailer. */
function fakeSmtp(): Promise<{ server: Server; port: number; messages: string[] }> {
  const messages: string[] = [];
  const server = createServer((sock) => {
    let data = false; let buf = '';
    sock.write('220 fake ESMTP\r\n');
    sock.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      if (data) {
        const end = buf.indexOf('\r\n.\r\n');
        if (end < 0) return;
        messages.push(buf.slice(0, end)); buf = buf.slice(end + 5); data = false;
        sock.write('250 OK queued\r\n');
      }
      let i;
      while (!data && (i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO' || cmd === 'HELO') sock.write('250-fake\r\n250 8BITMIME\r\n');
        else if (cmd === 'DATA') { data = true; sock.write('354 go\r\n'); }
        else if (cmd === 'QUIT') { sock.end('221 bye\r\n'); }
        else sock.write('250 OK\r\n');
      }
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: (server.address() as AddressInfo).port, messages })));
}

describe('MailService qua SMTP (nodemailer)', () => {
  it('gửi được email tiếng Việt qua máy chủ SMTP', async () => {
    const smtp = await fakeSmtp();
    Object.assign(process.env, { DATABASE_URL: 'postgresql://unused/test', MAIL_TRANSPORT: 'smtp', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_SECURE: 'false', SMTP_USER: '' });
    resetEnvCache();
    try {
      await new MailService().send({ to: 'co.thuy@example.com', subject: 'Xác thực email HappyClass', text: 'Chào cô, bấm vào liên kết.', html: '<p>Chào cô</p>' });
      expect(smtp.messages).toHaveLength(1);
      expect(smtp.messages[0]).toMatch(/^To: co\.thuy@example\.com/m);
      expect(smtp.messages[0]).toMatch(/^Subject: =\?UTF-8\?/m);
    } finally {
      smtp.server.close();
      process.env.MAIL_TRANSPORT = 'memory';
      resetEnvCache();
    }
  });
});
