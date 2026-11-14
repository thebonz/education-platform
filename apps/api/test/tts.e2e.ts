import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TtsService, ttsUrl } from '../src/tts/tts.service';
import { createTestApp, createUser, login, ORIGIN_VI, TestApp } from './helpers';

/** WAV tối thiểu hợp lệ (44 byte header + 4 byte dữ liệu). */
function fakeWav(): Buffer {
  const b = Buffer.alloc(48);
  b.write('RIFF', 0, 'latin1'); b.writeUInt32LE(40, 4); b.write('WAVEfmt ', 8, 'latin1');
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(22050, 24);
  b.writeUInt32LE(44100, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36, 'latin1'); b.writeUInt32LE(4, 40);
  return b;
}

describe('Đọc tiếng Việt (TTS)', () => {
  let t: TestApp;
  let tts: Server;
  let calls: string[];
  let fail = false;
  const cache = mkdtempSync(join(tmpdir(), 'hc-tts-'));

  beforeAll(async () => {
    calls = [];
    tts = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        calls.push(JSON.parse(body).text);
        if (fail) { res.writeHead(500); res.end('{}'); return; }
        res.writeHead(200, { 'content-type': 'audio/wav' }); res.end(fakeWav());
      });
    });
    await new Promise<void>((r) => tts.listen(0, '127.0.0.1', r));
    t = await createTestApp({ TTS_URL: `http://127.0.0.1:${(tts.address() as AddressInfo).port}`, TTS_CACHE_DIR: cache });
  });
  afterAll(async () => {
    await t.close();
    tts.close();
    process.env.TTS_URL = '';
    rmSync(cache, { recursive: true, force: true });
  });

  const get = (text: string) => t.http().get('/api/tts').query({ lang: 'vi', text });

  it('tạo âm thanh qua dịch vụ tts, lưu đệm; lần sau không gọi lại', async () => {
    const r1 = await get('  Con mèo   trèo cây cau ')
      .buffer(true).parse((res, cb) => { const parts: Buffer[] = []; res.on('data', (c: Buffer) => parts.push(c)); res.on('end', () => cb(null, Buffer.concat(parts))); })
      .expect(200);
    expect(r1.headers['content-type']).toBe('audio/wav');
    expect(r1.headers['cache-control']).toContain('immutable');
    expect(r1.headers['x-content-type-options']).toBe('nosniff');
    expect((r1.body as Buffer).subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(calls).toEqual(['Con mèo trèo cây cau']);
    await get('Con mèo trèo cây cau').expect(200);
    expect(calls).toHaveLength(1);
    // Cùng câu viết dạng tổ hợp (NFD) vẫn dùng lại file
    await get('Con mèo trèo cây cau'.normalize('NFD')).expect(200);
    expect(calls).toHaveLength(1);
    expect(readdirSync(cache).length).toBe(1);
  });

  it('từ chối câu rỗng, quá dài, ký tự lạ hoặc ngôn ngữ khác', async () => {
    await get('').expect(400);
    await get('a'.repeat(301)).expect(400);
    await get('<script>alert(1)</script>').expect(400);
    await t.http().get('/api/tts').query({ lang: 'en', text: 'hello' }).expect(400);
    expect(calls).toHaveLength(1);
  });

  it('dịch vụ tts lỗi: 503 để trình duyệt dùng giọng của máy; không lưu file hỏng', async () => {
    fail = true;
    const r = await get('Bé đi học').expect(503);
    expect(r.body.error).toBe('tts_unavailable');
    expect(readdirSync(cache).length).toBe(1);
    fail = false;
  });

  it('tạo sẵn âm thanh cho mọi câu của game tiếng Việt; lần hai không tạo lại', async () => {
    const svc = t.app.get(TtsService);
    const before = calls.length;
    const made = await svc.warm();
    expect(made).toBeGreaterThan(50);
    expect(calls.length - before).toBe(made);
    expect(await svc.warm()).toBe(0);
  });

  it('gói offline tiếng Việt kèm file giọng đọc của các game (đúng URL trình duyệt dùng)', async () => {
    await createUser(t.prisma, 'teacher-tts@example.com', 'Correct-Horse-42');
    const cookie = await login(t, 'teacher-tts@example.com', 'Correct-Horse-42', ORIGIN_VI);
    const pack = await t.http().get('/api/offline/pack?product=vietnamese').set('Cookie', cookie).expect(200);
    const tone = pack.body.games.find((g: { slug: string }) => g.slug === 'nghe-chon-dau-thanh');
    const word: string = tone.data.items[0].say ?? tone.data.items[0].word;
    expect(pack.body.media).toContain(ttsUrl(word));
    // URL trong gói phát được ngay từ bộ nhớ đệm
    const before = calls.length;
    await t.http().get(ttsUrl(word)).expect(200);
    expect(calls.length).toBe(before);
  });
});
