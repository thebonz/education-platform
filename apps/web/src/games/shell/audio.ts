'use client';

/**
 * Âm thanh trong game:
 *  - say(): tiếng Việt → file giọng Bắc do máy chủ tạo (/api/tts, Piper); nếu máy chủ không đọc được thì dùng
 *    giọng tiếng Việt cài trên máy. KHÔNG BAO GIỜ đọc chữ Việt bằng giọng tiếng Anh (nghe sai hoàn toàn).
 *    Tiếng Anh → Web Speech API của trình duyệt.
 *  - sfx(): hiệu ứng ngắn tạo bằng WebAudio, không cần tải file.
 */
export type Sfx = 'correct' | 'wrong' | 'win' | 'pop';

const norm = (lang: string) => lang.replace('_', '-').toLowerCase();

export class GameAudio {
  enabled = true;
  voiceLang: string;
  /** Gọi khi không có cách nào đọc đúng tiếng Việt (máy chủ lỗi và máy không có giọng Việt). */
  onUnavailable?: () => void;
  private ctx: AudioContext | null = null;
  private player: HTMLAudioElement | null = null;
  private seq = 0;

  constructor(voiceLang: string) {
    this.voiceLang = voiceLang;
  }

  get speechAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /** Giọng của máy đúng ngôn ngữ (vi-VN, vi_VN…); không lấy giọng ngôn ngữ khác. */
  private deviceVoice(lang: string): SpeechSynthesisVoice | null {
    if (!this.speechAvailable) return null;
    const voices = window.speechSynthesis.getVoices();
    const want = norm(lang);
    return voices.find((v) => norm(v.lang) === want) ?? voices.find((v) => norm(v.lang).startsWith(want.slice(0, 2) + '-') || norm(v.lang) === want.slice(0, 2)) ?? null;
  }

  private speakWithDevice(text: string, requireVoice: boolean): boolean {
    if (!this.speechAvailable) return false;
    const voice = this.deviceVoice(this.voiceLang);
    if (requireVoice && !voice) return false;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = this.voiceLang;
    u.rate = 0.85;
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
    return true;
  }

  say(text: string) {
    if (!this.enabled || !text || typeof window === 'undefined') return;
    this.stop();
    if (!norm(this.voiceLang).startsWith('vi')) { this.speakWithDevice(text, false); return; }
    const id = ++this.seq;
    let fellBack = false;
    const fallback = () => {
      if (fellBack || id !== this.seq) return;
      fellBack = true;
      if (!this.speakWithDevice(text, true)) this.onUnavailable?.();
    };
    const a = new Audio(`/api/tts?lang=vi&text=${encodeURIComponent(text)}`);
    a.preload = 'auto';
    a.onerror = fallback;
    this.player = a;
    a.play().catch((e: DOMException) => {
      // Trình duyệt chặn tự phát (chưa có thao tác của người dùng) thì thôi, không đổi sang giọng khác.
      if (e?.name !== 'NotAllowedError' && e?.name !== 'AbortError') fallback();
    });
  }

  sfx(kind: Sfx) {
    if (!this.enabled || typeof window === 'undefined') return;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx ??= new Ctor();
      const ctx = this.ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      const notes: Record<Sfx, number[]> = { correct: [660, 880], wrong: [220, 180], win: [523, 659, 784, 1047], pop: [990] };
      notes[kind].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t0 = ctx.currentTime + i * 0.11;
        osc.type = kind === 'wrong' ? 'square' : 'sine';
        osc.frequency.setValueAtTime(freq, t0);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(kind === 'wrong' ? 0.05 : 0.12, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.18);
      });
    } catch {
      // Âm thanh không bắt buộc; bỏ qua lỗi của trình duyệt.
    }
  }

  stop() {
    if (this.player) { this.player.onerror = null; this.player.pause(); this.player = null; }
    if (this.speechAvailable) window.speechSynthesis.cancel();
  }
}
