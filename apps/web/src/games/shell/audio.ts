'use client';

/**
 * Âm thanh trong game:
 *  - say(): đọc to bằng Web Speech API. Khi có file ghi âm (giai đoạn 5: thư viện media), ưu tiên file.
 *  - sfx(): hiệu ứng ngắn tạo bằng WebAudio, không cần tải file.
 */
export type Sfx = 'correct' | 'wrong' | 'win' | 'pop';

export class GameAudio {
  enabled = true;
  voiceLang: string;
  private ctx: AudioContext | null = null;

  constructor(voiceLang: string) {
    this.voiceLang = voiceLang;
  }

  get speechAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  say(text: string) {
    if (!this.enabled || !this.speechAvailable || !text) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = this.voiceLang;
    u.rate = 0.85;
    const voice = synth.getVoices().find((v) => v.lang.replace('_', '-').toLowerCase() === this.voiceLang.toLowerCase())
      ?? synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(this.voiceLang.slice(0, 2).toLowerCase()));
    if (voice) u.voice = voice;
    synth.speak(u);
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
    if (this.speechAvailable) window.speechSynthesis.cancel();
  }
}
