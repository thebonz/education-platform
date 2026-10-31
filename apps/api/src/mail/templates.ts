import type { SiteKey } from '../config/env';

type Lang = 'en' | 'vi';
const langOf = (site: SiteKey): Lang => (site === 'english' ? 'en' : 'vi');

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function layout(title: string, body: string, link: string, button: string) {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f7f7fb;padding:24px">
<div style="max-width:520px;margin:auto;background:#fff;border-radius:16px;padding:28px">
<h2 style="margin-top:0">${escapeHtml(title)}</h2><p>${body}</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#e85d9e;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none">${escapeHtml(button)}</a></p>
<p style="color:#777;font-size:13px">${escapeHtml(link)}</p></div></body></html>`;
}

export function verifyEmailMail(site: SiteKey, name: string, link: string) {
  const vi = langOf(site) === 'vi';
  const subject = vi ? 'Xác thực email tài khoản HappyClass' : 'Verify your HappyClass email';
  const greeting = vi ? `Chào ${name},` : `Hi ${name},`;
  const line = vi
    ? 'Bấm nút dưới đây để xác thực email. Liên kết có hiệu lực trong 24 giờ.'
    : 'Click the button below to verify your email. The link is valid for 24 hours.';
  const button = vi ? 'Xác thực email' : 'Verify email';
  return { subject, text: `${greeting}\n\n${line}\n\n${link}\n`, html: layout(subject, `${escapeHtml(greeting)}<br>${escapeHtml(line)}`, link, button) };
}

export function resetPasswordMail(site: SiteKey, name: string, link: string) {
  const vi = langOf(site) === 'vi';
  const subject = vi ? 'Đặt lại mật khẩu HappyClass' : 'Reset your HappyClass password';
  const greeting = vi ? `Chào ${name},` : `Hi ${name},`;
  const line = vi
    ? 'Có yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Liên kết có hiệu lực trong 1 giờ. Nếu không phải bạn, hãy bỏ qua email này.'
    : 'We received a request to reset your password. The link is valid for 1 hour. If this was not you, ignore this email.';
  const button = vi ? 'Đặt lại mật khẩu' : 'Reset password';
  return { subject, text: `${greeting}\n\n${line}\n\n${link}\n`, html: layout(subject, `${escapeHtml(greeting)}<br>${escapeHtml(line)}`, link, button) };
}

export function accountExistsMail(site: SiteKey, link: string) {
  const vi = langOf(site) === 'vi';
  const subject = vi ? 'Bạn đã có tài khoản HappyClass' : 'You already have a HappyClass account';
  const line = vi
    ? 'Có người vừa đăng ký bằng email này, nhưng email đã có tài khoản. Nếu quên mật khẩu, bạn có thể đặt lại.'
    : 'Someone tried to sign up with this email, but an account already exists. If you forgot your password, you can reset it.';
  const button = vi ? 'Đặt lại mật khẩu' : 'Reset password';
  return { subject, text: `${line}\n\n${link}\n`, html: layout(subject, escapeHtml(line), link, button) };
}
