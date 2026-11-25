'use client';

import { preferredEnglishVoice, rankedEnglishVoices } from './english-voices';

/**
 * Âm thanh trong game:
 *  - say(): tiếng Việt → file giọng Bắc do máy chủ tạo (/api/tts, Piper); nếu máy chủ không đọc được thì dùng
 *    giọng tiếng Việt cài trên máy. KHÔNG BAO GIỜ đọc chữ Việt bằng giọng tiếng Anh (nghe sai hoàn toàn).
 *    Tiếng Anh → lựa chọn có thể đổi giữa các giọng tiếng Anh mà máy/trình duyệt đã cài;
 *    ưu tiên giọng Natural/Neural khi có. Không tự tạo hoặc tải giọng bên thứ ba.
 *  - sfx(): hiệu ứng ngắn tạo bằng WebAudio, không cần tải file.
 */
export type Sfx = 'correct' | 'wrong' | 'win' | 'pop';

const norm = (lang: string) => lang.replace('_', '-').toLowerCase();

export class GameAudio {
  enabled = true;
  voiceLang: string;
  englishVoiceURI: string | null = null;
  englishRate = 0.85;
  /** Gọi khi không có cách nào đọc đúng tiếng Việt (máy chủ lỗi và máy không có giọng Việt). */
  onUnavailable?: () => void;
  /** Chỉ báo khi audio máy chủ thực sự bắt đầu phát, hoặc giọng thiết bị được chọn. */
  onAvailable?: () => void;
  private ctx: AudioContext | null = null;
  private player: HTMLAudioElement | null = null;
  private seq = 0;

  constructor(voiceLang: string) {
    this.voiceLang = voiceLang;
  }

  get speechAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /** Liệt kê giọng tiếng Anh; phát hiện danh sách cập nhật qua voiceschanged ở GameShell. */
  availableEnglishVoices(): SpeechSynthesisVoice[] {
    if (!this.speechAvailable) return [];
    return rankedEnglishVoices(window.speechSynthesis.getVoices(), this.voiceLang);
  }

  /** Giữ nguyên chính sách không đọc tiếng Việt bằng giọng Anh. */
  private deviceVoice(lang: string): SpeechSynthesisVoice | null {
    if (!this.speechAvailable) return null;
    const voices = window.speechSynthesis.getVoices();
    const want = norm(lang);
    if (want.startsWith('en')) {
      return preferredEnglishVoice(voices, want, this.englishVoiceURI);
    }
    return voices.find((v) => norm(v.lang) === want)
      ?? voices.find((v) => norm(v.lang).startsWith(want.slice(0, 2) + '-') || norm(v.lang) === want.slice(0, 2))
      ?? null;
  }

  private speakWithDevice(text: string, requireVoice: boolean, id: number): boolean {
    if (!this.speechAvailable || typeof SpeechSynthesisUtterance === 'undefined') return false;
    const voice = this.deviceVoice(this.voiceLang);
    const voices = window.speechSynthesis.getVoices();
    // Tiếng Việt bắt buộc có giọng vi. Tiếng Anh có thể dùng lựa chọn mặc định
    // khi browser chưa liệt kê giọng; không ép dùng giọng ngôn ngữ khác đã biết.
    if (requireVoice && !voice) return false;
    if (norm(this.voiceLang).startsWith('en') && voices.length > 0 && !voice) return false;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang ?? this.voiceLang;
    utterance.rate = norm(this.voiceLang).startsWith('en') ? this.englishRate : 0.85;
    utterance.pitch = 1;
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      if (id === this.seq && this.enabled) this.onAvailable?.();
    };
    utterance.onerror = (event) => {
      if (id !== this.seq || !this.enabled || event.error === 'canceled' || event.error === 'interrupted') return;
      this.onUnavailable?.();
    };
    try {
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      return false;
    }
  }

  say(text: string) {
    if (!this.enabled || !text || typeof window === 'undefined') return;
    this.stop();
    const id = ++this.seq;
    if (!norm(this.voiceLang).startsWith('vi')) {
      if (!this.speakWithDevice(text, false, id)) this.onUnavailable?.();
      return;
    }
    let fellBack = false;
    const fallback = () => {
      if (fellBack || id !== this.seq || !this.enabled) return;
      fellBack = true;
      if (!this.speakWithDevice(text, true, id)) this.onUnavailable?.();
    };
    const a = new Audio(`/api/tts?lang=vi&text=${encodeURIComponent(text)}`);
    a.preload = 'auto';
    a.onplaying = () => {
      if (id === this.seq && this.enabled) this.onAvailable?.();
    };
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
    // Vô hiệu các sự kiện onerror/onplaying của lần phát cũ khi đổi câu, đổi game hoặc tắt tiếng.
    this.seq++;
    if (this.player) {
      this.player.onerror = null;
      this.player.onplaying = null;
      this.player.pause();
      this.player = null;
    }
    if (this.speechAvailable) window.speechSynthesis.cancel();
  }
}
