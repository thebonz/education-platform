/**
 * Nhận dạng file theo nội dung (magic bytes), KHÔNG tin tên file hay Content-Type trình duyệt gửi lên.
 * Chỉ nhận định dạng an toàn để hiển thị trực tiếp: PNG, JPEG, WebP, GIF; MP3, OGG, WAV.
 * Không nhận SVG/HTML (có thể chứa script).
 */
export type Sniffed = { kind: 'IMAGE' | 'AUDIO'; mime: string; ext: string; width?: number; height?: number };

const ascii = (b: Buffer, start: number, len: number) => b.subarray(start, start + len).toString('latin1');

function pngSize(b: Buffer) {
  return b.length >= 24 && ascii(b, 12, 4) === 'IHDR' ? { width: b.readUInt32BE(16), height: b.readUInt32BE(20) } : {};
}

function gifSize(b: Buffer) {
  return b.length >= 10 ? { width: b.readUInt16LE(6), height: b.readUInt16LE(8) } : {};
}

function jpegSize(b: Buffer) {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = b.readUInt16BE(i + 2);
    // SOF0..SOF15 trừ DHT (C4), JPG (C8), DAC (CC)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    if (len < 2) break;
    i += 2 + len;
  }
  return {};
}

function webpSize(b: Buffer) {
  const chunk = ascii(b, 12, 4);
  if (chunk === 'VP8X' && b.length >= 30) return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  if (chunk === 'VP8 ' && b.length >= 30) return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L' && b.length >= 25) {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return {};
}

export function sniff(b: Buffer): Sniffed | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a) return { kind: 'IMAGE', mime: 'image/png', ext: 'png', ...pngSize(b) };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: 'IMAGE', mime: 'image/jpeg', ext: 'jpg', ...jpegSize(b) };
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return { kind: 'IMAGE', mime: 'image/webp', ext: 'webp', ...webpSize(b) };
  if (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a') return { kind: 'IMAGE', mime: 'image/gif', ext: 'gif', ...gifSize(b) };
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WAVE') return { kind: 'AUDIO', mime: 'audio/wav', ext: 'wav' };
  if (ascii(b, 0, 4) === 'OggS') return { kind: 'AUDIO', mime: 'audio/ogg', ext: 'ogg' };
  if (ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0)) return { kind: 'AUDIO', mime: 'audio/mpeg', ext: 'mp3' };
  return null;
}
