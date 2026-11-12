import Link from 'next/link';
import type { Product } from '@/lib/sites';

/**
 * Điều khoản sử dụng và Chính sách quyền riêng tư. Nội dung mô tả đúng cách hệ thống đang xử lý dữ liệu
 * (xem docs/SECURITY.md). Bản dự thảo cho giai đoạn chạy thử: tên pháp nhân và chính sách hoàn tiền
 * do chủ sở hữu bổ sung trước khi mở công khai.
 */
export const LEGAL_VERSION = '2026-11-01';

type Section = { h: string; p: string[] };
type Doc = { title: string; draft: string; updated: string; sections: Section[] };

const TERMS: Record<'vi' | 'en', Doc> = {
  vi: {
    title: 'Điều khoản sử dụng',
    draft: 'Bản dự thảo áp dụng trong giai đoạn chạy thử. Thông tin pháp nhân vận hành sẽ được bổ sung trước khi mở công khai.',
    updated: 'Phiên bản',
    sections: [
      { h: '1. Dịch vụ', p: ['HappyClass (happyclass.asia) cung cấp trò chơi học tiếng Anh và tiếng Việt cho học sinh tiểu học, dành cho giáo viên và phụ huynh sử dụng cùng các em.'] },
      { h: '2. Tài khoản', p: ['Tài khoản chỉ dành cho người từ 18 tuổi trở lên (giáo viên, phụ huynh). Học sinh không tự tạo tài khoản; các em chơi qua thiết bị của người lớn hoặc vào lớp bằng mã lớp.', 'Bạn chịu trách nhiệm giữ bí mật mật khẩu và mọi hoạt động trong tài khoản của mình. Thấy dấu hiệu bất thường, hãy đổi mật khẩu và đăng xuất mọi thiết bị ở trang Tài khoản.'] },
      { h: '3. Gói thành viên và thanh toán', p: ['Mỗi sản phẩm (English Games, Trò chơi tiếng Việt) có gói riêng theo năm hoặc theo tháng. Giá hiện hành là giá hiển thị ở trang Bảng giá tại thời điểm đặt đơn.', 'Gói được kích hoạt khi khoản chuyển khoản khớp đúng mã đơn và số tiền. Gói không tự động gia hạn; mua thêm khi còn hạn thì thời gian được cộng nối tiếp.', 'Gói trường học, hỗ trợ thanh toán và các yêu cầu về hoàn tiền: liên hệ qua Zalo ở trang Bảng giá.'] },
      { h: '4. Nội dung', p: ['Trò chơi, câu hỏi, hình ảnh và âm thanh trên HappyClass là nội dung do HappyClass biên soạn theo định hướng chương trình, không sao chép sách giáo khoa.', 'Bạn được dùng nội dung để dạy và học, kể cả chỉnh sửa bản sao cho lớp của mình. Không được sao chép hàng loạt, bán lại hoặc đăng lại nội dung ở nơi khác.'] },
      { h: '5. Lớp học', p: ['Giáo viên tự nhập biệt danh học sinh và chịu trách nhiệm về thông tin đã nhập. Hãy dùng biệt danh hoặc tên gọi ngắn, không nhập họ tên đầy đủ, ngày sinh hay thông tin liên lạc của học sinh.', 'Mã lớp nên chỉ chia sẻ cho học sinh của lớp. Có thể đổi mã lớp bất cứ lúc nào.'] },
      { h: '6. Chơi offline', p: ['Game tải về để chơi offline đi kèm giấy phép 30 ngày; cần kết nối mạng để gia hạn. Game trả phí chỉ chơi được trong thời hạn gói.'] },
      { h: '7. Hành vi không được phép', p: ['Truy cập trái phép, dò quét lỗ hổng, tải dữ liệu tự động hàng loạt, chia sẻ tài khoản để kinh doanh, tải lên nội dung vi phạm pháp luật hoặc không phù hợp với trẻ em. HappyClass có thể khoá tài khoản vi phạm.'] },
      { h: '8. Giới hạn trách nhiệm', p: ['Trong giai đoạn chạy thử, dịch vụ được cung cấp theo hiện trạng và có thể tạm dừng để bảo trì. HappyClass sao lưu dữ liệu định kỳ nhưng không cam kết dịch vụ luôn liên tục.'] },
      { h: '9. Thay đổi điều khoản', p: ['Khi điều khoản thay đổi, phiên bản mới được ghi ngày ở đầu trang. Tiếp tục sử dụng sau khi thay đổi nghĩa là bạn đồng ý với phiên bản mới.'] },
      { h: '10. Luật áp dụng', p: ['Điều khoản này được điều chỉnh bởi pháp luật Việt Nam.'] },
    ],
  },
  en: {
    title: 'Terms of Use',
    draft: 'Draft terms for the testing period. Details of the operating legal entity will be added before public launch.',
    updated: 'Version',
    sections: [
      { h: '1. The service', p: ['HappyClass (happyclass.asia) provides English and Vietnamese learning games for primary pupils, used by teachers and parents together with children.'] },
      { h: '2. Accounts', p: ['Accounts are for adults aged 18 or over (teachers, parents). Pupils do not create accounts; they play on an adult’s device or join a class with a class code.', 'You are responsible for keeping your password secret. If something looks wrong, change your password and log out of all devices on the Account page.'] },
      { h: '3. Memberships and payment', p: ['Each product has its own yearly or monthly membership. The price that applies is the one shown on the Pricing page when you place the order.', 'A membership starts once a bank transfer matches the order code and amount. Memberships do not renew automatically; buying again while active extends the end date.', 'School plans, payment help and refund requests: contact us on Zalo via the Pricing page.'] },
      { h: '4. Content', p: ['Games, questions, images and audio are original HappyClass content written to follow the curriculum, not copied from textbooks.', 'You may use the content for teaching and learning, including editing copies for your own classes. Do not bulk-copy, resell or republish it elsewhere.'] },
      { h: '5. Classes', p: ['Teachers enter pupil nicknames and are responsible for what they enter. Use short nicknames; do not enter full names, birth dates or contact details.', 'Share a class code only with that class. You can change the code at any time.'] },
      { h: '6. Offline play', p: ['Downloaded offline games carry a 30-day licence that must be renewed online. Premium games work only while your membership lasts.'] },
      { h: '7. Not allowed', p: ['Unauthorised access, vulnerability scanning, automated bulk downloading, sharing accounts commercially, or uploading unlawful or child-inappropriate content. We may lock accounts that do so.'] },
      { h: '8. Liability', p: ['During testing the service is provided as is and may pause for maintenance. Data is backed up regularly, but uninterrupted service is not guaranteed.'] },
      { h: '9. Changes', p: ['When these terms change, the new version date is shown at the top. Continuing to use the service means you accept the new version.'] },
      { h: '10. Governing law', p: ['These terms are governed by the laws of Vietnam.'] },
    ],
  },
};

const PRIVACY: Record<'vi' | 'en', Doc> = {
  vi: {
    title: 'Chính sách quyền riêng tư',
    draft: 'Bản dự thảo áp dụng trong giai đoạn chạy thử, mô tả đúng cách hệ thống đang xử lý dữ liệu.',
    updated: 'Phiên bản',
    sections: [
      { h: 'Chúng tôi thu thập gì', p: [
        'Tài khoản người lớn: email, tên hiển thị, mật khẩu (chỉ lưu dạng băm Argon2id, không ai đọc được), thời điểm xác thực email, và lần đồng ý điều khoản (phiên bản, thời gian, địa chỉ IP).',
        'Phiên đăng nhập: trình duyệt, địa chỉ IP và thời gian, để bạn xem và đăng xuất từ xa ở trang Tài khoản.',
        'Học tập: kết quả chơi (điểm, số sao, số lần sai, thời gian), game yêu thích.',
        'Học sinh trong lớp: chỉ biệt danh và một biểu tượng do giáo viên nhập, cùng kết quả chơi. Học sinh không có email, mật khẩu hay tài khoản.',
        'Thanh toán: đơn hàng (gói, số tiền, mã đơn) và thông báo giao dịch ngân hàng nhận được (số tiền, nội dung chuyển khoản, thời gian, mã giao dịch). Chúng tôi không nhận thông tin thẻ hay tài khoản đăng nhập ngân hàng của bạn.',
        'Nhật ký bảo mật: các thao tác quan trọng (đăng nhập, đổi mật khẩu, thao tác quản trị) kèm địa chỉ IP.',
      ] },
      { h: 'Cookie và lưu trữ trên thiết bị', p: [
        'Chỉ một cookie cần thiết: hc_session để giữ đăng nhập (HttpOnly, không đọc được bằng JavaScript). Không có cookie quảng cáo, không dùng công cụ phân tích hay theo dõi của bên thứ ba.',
        'Khi bạn dùng chế độ chơi offline, nội dung game và giấy phép được lưu trong bộ nhớ trình duyệt của thiết bị đó; bấm “Xoá dữ liệu offline” để xoá.',
      ] },
      { h: 'Chúng tôi dùng dữ liệu để làm gì', p: ['Cung cấp tài khoản, lưu kết quả học, mở gói đã mua, gửi email xác thực và đặt lại mật khẩu, chống gian lận và bảo vệ hệ thống. Không bán dữ liệu, không dùng dữ liệu của trẻ em để quảng cáo.'] },
      { h: 'Bên thứ ba xử lý dữ liệu', p: ['Cloudflare (đường truyền, bảo vệ truy cập), SePay (chuyển thông báo giao dịch từ ngân hàng), nhà cung cấp gửi email, và dịch vụ lưu trữ bản sao lưu (Cloudflare R2 hoặc Backblaze B2; bản sao lưu được mã hoá trước khi gửi đi).'] },
      { h: 'Thời gian lưu trữ', p: [
        'Dữ liệu tài khoản và học tập được giữ cho đến khi bạn xoá tài khoản. Phiên đăng nhập tự hết hạn sau 30 ngày.',
        'Đơn hàng và giao dịch thanh toán là chứng từ kế toán, được giữ theo thời hạn pháp luật kế toán quy định, dưới dạng ẩn danh nếu tài khoản đã xoá.',
        'Bản sao lưu mã hoá được giữ tối đa 12 tháng rồi tự xoá; dữ liệu đã xoá có thể còn trong bản sao lưu cũ đến hết thời hạn này.',
      ] },
      { h: 'Quyền của bạn', p: [
        'Xem và sửa tên hiển thị, xem các phiên đăng nhập, đổi mật khẩu ở trang Tài khoản.',
        'Xoá tài khoản ngay ở trang Tài khoản: email, tên, lớp học, học sinh, kết quả và gói bị xoá; việc này cũng là rút lại sự đồng ý.',
        'Yêu cầu khác về dữ liệu cá nhân: liên hệ qua Zalo ở trang Bảng giá.',
      ] },
      { h: 'Trẻ em', p: ['Dịch vụ dành cho người lớn sử dụng cùng trẻ. Giáo viên nhập biệt danh học sinh cần có sự đồng ý của phụ huynh theo quy định của nhà trường, và không nhập họ tên đầy đủ hay thông tin liên lạc của học sinh.'] },
      { h: 'Bảo mật', p: ['Kết nối HTTPS, mật khẩu băm Argon2id, phân quyền theo vai trò ở máy chủ, chống CSRF, giới hạn tần suất truy cập, cơ sở dữ liệu không mở ra Internet, bản sao lưu mã hoá.'] },
    ],
  },
  en: {
    title: 'Privacy Policy',
    draft: 'Draft policy for the testing period; it describes how the system actually handles data.',
    updated: 'Version',
    sections: [
      { h: 'What we collect', p: [
        'Adult accounts: email, display name, password (stored only as an Argon2id hash), email verification time, and your acceptance of the terms (version, time, IP address).',
        'Login sessions: browser, IP address and time, so you can review and sign out remotely on the Account page.',
        'Learning: game results (score, stars, mistakes, time) and favourite games.',
        'Pupils in a class: only a nickname and an emoji entered by the teacher, plus game results. Pupils have no email, password or account.',
        'Payments: orders (plan, amount, order code) and incoming bank transfer notices (amount, transfer note, time, reference). We never receive card details or your banking login.',
        'Security log: important actions (sign-in, password change, admin actions) with IP address.',
      ] },
      { h: 'Cookies and on-device storage', p: [
        'One essential cookie only: hc_session keeps you signed in (HttpOnly). No advertising cookies and no third-party analytics or tracking.',
        'Offline play stores game content and its licence in that device’s browser storage; use “Remove offline data” to delete it.',
      ] },
      { h: 'How we use data', p: ['To run your account, save learning results, unlock memberships you bought, send verification and password-reset emails, prevent fraud and protect the service. We do not sell data or use children’s data for advertising.'] },
      { h: 'Processors', p: ['Cloudflare (network, access protection), SePay (relays bank transfer notices), an email delivery provider, and backup storage (Cloudflare R2 or Backblaze B2; backups are encrypted before upload).'] },
      { h: 'Retention', p: [
        'Account and learning data are kept until you delete your account. Sessions expire after 30 days.',
        'Orders and payment records are accounting documents kept for the legally required period, anonymised if the account is deleted.',
        'Encrypted backups are kept for up to 12 months, so deleted data may remain in older backups until they expire.',
      ] },
      { h: 'Your rights', p: [
        'View and edit your display name, review sessions and change your password on the Account page.',
        'Delete your account on the Account page: email, name, classes, pupils, results and memberships are removed; this also withdraws your consent.',
        'Other personal-data requests: contact us on Zalo via the Pricing page.',
      ] },
      { h: 'Children', p: ['The service is for adults using it with children. Teachers entering pupil nicknames should have parental consent as their school requires, and must not enter pupils’ full names or contact details.'] },
      { h: 'Security', p: ['HTTPS, Argon2id password hashing, server-side role-based access, CSRF protection, rate limiting, a database not exposed to the Internet, and encrypted backups.'] },
    ],
  },
};

function LegalDoc({ doc, other }: { doc: Doc; other: { href: string; label: string } }) {
  return (
    <article className="legal-doc">
      <h1>{doc.title}</h1>
      <p className="muted">{doc.updated}: {LEGAL_VERSION}</p>
      <p className="legal-draft">{doc.draft}</p>
      {doc.sections.map((s) => (
        <section key={s.h}><h2>{s.h}</h2>{s.p.map((x) => <p key={x.slice(0, 40)}>{x}</p>)}</section>
      ))}
      <p><Link href={other.href}>{other.label}</Link></p>
    </article>
  );
}

const lang = (p: Product) => (p === 'english' ? 'en' : 'vi');

export function TermsContent({ product, base }: { product: Product; base: string }) {
  const l = lang(product);
  return <LegalDoc doc={TERMS[l]} other={{ href: `${base}/privacy`, label: PRIVACY[l].title }} />;
}

export function PrivacyContent({ product, base }: { product: Product; base: string }) {
  const l = lang(product);
  return <LegalDoc doc={PRIVACY[l]} other={{ href: `${base}/terms`, label: TERMS[l].title }} />;
}

export function legalTitle(kind: 'terms' | 'privacy', product: Product) {
  return (kind === 'terms' ? TERMS : PRIVACY)[lang(product)].title;
}
