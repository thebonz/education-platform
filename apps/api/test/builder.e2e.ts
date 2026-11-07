import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seed } from '../src/cli/seed';
import { createTestApp, createUser, login, ORIGIN_ADMIN, TestApp } from './helpers';

const PW = 'Correct-Horse-42';
// PNG 1×1 hợp lệ
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

describe('Game Builder và thư viện media', () => {
  let t: TestApp;
  let editor: string;
  let reviewer: string;
  let member: string;
  let mediaDir: string;

  beforeAll(async () => {
    mediaDir = mkdtempSync(join(tmpdir(), 'hc-media-'));
    t = await createTestApp({ MEDIA_DIR: mediaDir, MEDIA_MAX_IMAGE_BYTES: '20000' });
    await createUser(t.prisma, 'editor@example.com', PW, ['content_editor']);
    await createUser(t.prisma, 'reviewer@example.com', PW, ['content_reviewer']);
    await createUser(t.prisma, 'member@example.com', PW);
    editor = await login(t, 'editor@example.com', PW, ORIGIN_ADMIN);
    reviewer = await login(t, 'reviewer@example.com', PW, ORIGIN_ADMIN);
    member = await login(t, 'member@example.com', PW, ORIGIN_ADMIN);
  });
  afterAll(async () => {
    await t.close();
    rmSync(mediaDir, { recursive: true, force: true });
    delete process.env.MEDIA_DIR;
    delete process.env.MEDIA_MAX_IMAGE_BYTES;
  });

  const as = (cookie: string) => ({
    get: (url: string) => t.http().get(url).set('Cookie', cookie),
    post: (url: string, body: object = {}) => t.http().post(url).set('Origin', ORIGIN_ADMIN).set('Cookie', cookie).send(body),
    patch: (url: string, body: object) => t.http().patch(url).set('Origin', ORIGIN_ADMIN).set('Cookie', cookie).send(body),
  });

  describe('tạo và soạn game', () => {
    let id: string;

    it('chỉ người có quyền games.edit mới tạo được game', async () => {
      const body = { product: 'vietnamese', slug: 'ghep-tieng-thu', title: 'Ghép tiếng thử', summary: 'Bản thử', templateKey: 'syllable-builder', level: 'lop-1' };
      await as(member).post('/api/admin/games', body).expect(403);
      await as(reviewer).post('/api/admin/games', body).expect(403);
      const res = await as(editor).post('/api/admin/games', body).expect(201);
      expect(res.body).toMatchObject({ slug: 'ghep-tieng-thu', version: 1 });
      id = res.body.id;
      // Trùng slug trong cùng sản phẩm
      const dup = await as(editor).post('/api/admin/games', body).expect(409);
      expect(dup.body.error).toBe('slug_taken');
    });

    it('game mới: chưa xuất bản, không do seed quản lý, dùng nội dung mẫu hợp lệ', async () => {
      const game = await t.prisma.game.findUniqueOrThrow({ where: { id }, include: { versions: true, level: true } });
      expect(game).toMatchObject({ isPublished: false, managedBySeed: false, reviewStatus: 'PENDING' });
      expect(game.level?.slug).toBe('lop-1');
      expect(game.versions).toHaveLength(1);
      expect(game.versions[0].isPublished).toBe(false);
      // Chưa xuất bản → trang công khai không thấy
      await t.http().get('/api/catalog/products/vietnamese/games/ghep-tieng-thu').expect(404);
    });

    it('từ chối template không dùng cho sản phẩm và nội dung sai schema', async () => {
      const r1 = await as(editor).post('/api/admin/games', { product: 'english', slug: 'x', title: 'X', summary: 'X', templateKey: 'tone-finder' }).expect(400);
      expect(r1.body.error).toBe('template_not_for_product');
      const r2 = await as(editor).post(`/api/admin/games/${id}/versions`, { content: { items: [{ id: 'a', word: 'gế', hint: 'x' }] } }).expect(400);
      expect(r2.body.error).toBe('invalid_content');
      expect(r2.body.issues.map((i: { path: string }) => i.path)).toEqual(expect.arrayContaining(['items', 'items.0.word']));
    });

    it('lưu nháp tạo phiên bản mới; chưa đổi phiên bản đang chạy', async () => {
      const content = {
        instructions: 'Ghép tiếng nhé',
        items: [{ id: 'ba', word: 'bà', picture: { kind: 'emoji', value: '👵' } }, { id: 'ca', word: 'cá', hint: 'con cá' }, { id: 'ke', word: 'kẻ', say: 'kẻ vở' }],
      };
      const res = await as(editor).post(`/api/admin/games/${id}/versions`, { content, note: 'Thêm tiếng kẻ' }).expect(201);
      expect(res.body).toEqual({ versionNumber: 2, isPublished: false });
      const list = await as(reviewer).get(`/api/admin/games/${id}/versions`).expect(200);
      expect(list.body.versions.map((v: { versionNumber: number }) => v.versionNumber)).toEqual([2, 1]);
      expect(list.body.versions[0]).toMatchObject({ note: 'Thêm tiếng kẻ', createdBy: expect.any(String), isPublished: false });
      const v2 = await as(reviewer).get(`/api/admin/games/${id}/versions/2`).expect(200);
      // Mặc định của schema được điền khi lưu
      expect(v2.body.content).toMatchObject({ choicesPerStep: 4, includeTone: true });
    });

    it('xuất bản game cần có phiên bản đã phát hành', async () => {
      const r = await as(editor).patch(`/api/admin/games/${id}`, { isPublished: true }).expect(400);
      expect(r.body.error).toBe('no_published_version');
    });

    it('phát hành phiên bản 2 rồi mở game: người chơi thấy nội dung mới, chờ giáo viên duyệt', async () => {
      await as(reviewer).post(`/api/admin/games/${id}/versions/2/publish`).expect(403);
      const pub = await as(editor).post(`/api/admin/games/${id}/versions/2/publish`).expect(200);
      expect(pub.body).toEqual({ versionNumber: 2, isPublished: true, changed: true });
      await as(editor).patch(`/api/admin/games/${id}`, { isPublished: true, title: 'Ghép tiếng có k', difficulty: 'easy' }).expect(200);

      const play = await t.http().get('/api/catalog/products/vietnamese/games/ghep-tieng-thu/play').expect(200);
      expect(play.body.data.items.map((x: { word: string }) => x.word)).toEqual(['bà', 'cá', 'kẻ']);
      const meta = await t.http().get('/api/catalog/products/vietnamese/games/ghep-tieng-thu').expect(200);
      expect(meta.body).toMatchObject({ title: 'Ghép tiếng có k', reviewStatus: 'PENDING' });

      // Duyệt, rồi phát hành phiên bản khác → phải duyệt lại
      await as(reviewer).post(`/api/admin/games/${id}/review`, { status: 'APPROVED' }).expect(200);
      const again = await as(editor).post(`/api/admin/games/${id}/versions/2/publish`).expect(200);
      expect(again.body.changed).toBe(false);
      expect((await t.prisma.game.findUniqueOrThrow({ where: { id } })).reviewStatus).toBe('APPROVED');
      await as(editor).post(`/api/admin/games/${id}/versions/1/publish`).expect(200);
      expect((await t.prisma.game.findUniqueOrThrow({ where: { id } })).reviewStatus).toBe('PENDING');

      const actions = (await t.prisma.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: 'asc' } })).map((l) => l.action);
      expect(actions).toEqual(expect.arrayContaining(['admin.game_created', 'admin.game_version_saved', 'admin.game_version_published', 'admin.game_updated']));
    });

    it('sửa game do seed tạo: seed lần sau không ghi đè', async () => {
      const seeded = await t.prisma.game.findFirstOrThrow({ where: { slug: 'ghep-tieng-co-ban' } });
      await as(editor).patch(`/api/admin/games/${seeded.id}`, { title: 'Ghép tiếng (đã sửa tay)' }).expect(200);
      await t.prisma.game.update({ where: { id: seeded.id }, data: { seedRevision: 0 } }); // giả lập gói seed mới hơn
      const report = await seed(t.prisma);
      expect(report.gamesUpdated).toBe(0);
      expect((await t.prisma.game.findUniqueOrThrow({ where: { id: seeded.id } })).title).toBe('Ghép tiếng (đã sửa tay)');
    });

    it('nhân bản thành game mới chưa xuất bản, giữ nguyên game gốc', async () => {
      const res = await as(editor).post(`/api/admin/games/${id}/duplicate`, { slug: 'ghep-tieng-thu-2', title: 'Bản sao' }).expect(201);
      const copy = await t.prisma.game.findUniqueOrThrow({ where: { id: res.body.id }, include: { versions: true } });
      expect(copy).toMatchObject({ isPublished: false, templateKey: 'syllable-builder', managedBySeed: false });
      expect(copy.versions[0].note).toMatch(/ghep-tieng-thu \(phiên bản 1\)/);
      await as(editor).post(`/api/admin/games/${id}/duplicate`, { slug: 'ghep-tieng-thu-2', title: 'Trùng' }).expect(409);
    });

    it('danh sách admin hiện cả game nháp', async () => {
      const res = await as(reviewer).get('/api/admin/games?product=vietnamese&pageSize=100').expect(200);
      const draft = res.body.games.find((g: { slug: string }) => g.slug === 'ghep-tieng-thu-2');
      expect(draft).toMatchObject({ isPublished: false, version: null, latestVersion: 1 });
    });
  });

  describe('thư viện media', () => {
    let mediaId: string;

    it('tải ảnh lên: nhận dạng theo nội dung, lưu theo SHA-256, trùng file dùng lại bản cũ', async () => {
      await t.http().post('/api/admin/media').set('Origin', ORIGIN_ADMIN).set('Cookie', member).attach('file', PNG, 'cat.png').expect(403);
      const res = await t.http().post('/api/admin/media').set('Origin', ORIGIN_ADMIN).set('Cookie', editor)
        .field('alt', 'con mèo').attach('file', PNG, 'mèo con.png').expect(201);
      expect(res.body).toMatchObject({ kind: 'IMAGE', mimeType: 'image/png', width: 1, height: 1, alt: 'con mèo', originalName: 'mèo con.png' });
      expect(res.body.url).toBe(`/api/media/${res.body.id}`);
      mediaId = res.body.id;
      const again = await t.http().post('/api/admin/media').set('Origin', ORIGIN_ADMIN).set('Cookie', editor).attach('file', PNG, 'khac.png').expect(201);
      expect(again.body).toMatchObject({ id: mediaId, duplicate: true });
      expect(readdirSync(mediaDir).length).toBe(1);
    });

    it('từ chối SVG/HTML giả làm ảnh, file quá lớn, thiếu file', async () => {
      const up = (buf: Buffer, name: string) => t.http().post('/api/admin/media').set('Origin', ORIGIN_ADMIN).set('Cookie', editor).attach('file', buf, name);
      await up(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'x.svg').expect(415);
      await up(Buffer.from('<html><body>hi</body></html>'), 'x.png').expect(415);
      const big = Buffer.concat([PNG.subarray(0, 33), Buffer.alloc(30_000)]);
      await up(big, 'big.png').expect(413);
      await t.http().post('/api/admin/media').set('Origin', ORIGIN_ADMIN).set('Cookie', editor).field('alt', 'x').expect(400);
      // Thiếu Origin (CSRF) bị chặn
      await t.http().post('/api/admin/media').set('Cookie', editor).attach('file', PNG, 'a.png').expect(403);
    });

    it('phục vụ file công khai với header an toàn; danh sách cho admin', async () => {
      const res = await t.http().get(`/api/media/${mediaId}`).expect(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toContain('sandbox');
      expect(res.headers['cache-control']).toContain('immutable');
      expect(Buffer.compare(res.body as Buffer, PNG)).toBe(0);
      await t.http().get('/api/media/00000000-0000-4000-8000-000000000000').expect(404);

      const list = await as(reviewer).get(`/api/admin/media?kind=IMAGE&q=${encodeURIComponent('mèo')}`).expect(200);
      expect(list.body.total).toBe(1);
      await as(member).get('/api/admin/media').expect(403);
      await as(editor).patch(`/api/admin/media/${mediaId}`, { alt: 'chú mèo con' }).expect(200);
    });

    it('ảnh trong thư viện dùng được trong nội dung game', async () => {
      const game = await t.prisma.game.findFirstOrThrow({ where: { slug: 'ghep-tieng-thu' } });
      await as(editor).post(`/api/admin/games/${game.id}/versions`, {
        content: { items: [
          { id: 'meo', word: 'mèo', picture: { kind: 'image', src: `/api/media/${mediaId}`, alt: 'con mèo' } },
          { id: 'ca', word: 'cá', hint: 'con cá' }, { id: 'ba', word: 'bà', hint: 'bà nội' },
        ] },
      }).expect(201);
    });
  });
});
