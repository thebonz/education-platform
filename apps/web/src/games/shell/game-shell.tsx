'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRng, randomSeed } from '@happyclass/game-core/rng';
import { starsFor } from '@happyclass/game-core/scoring';
import type { TemplateKey } from '@happyclass/game-core/templates';
import { apiSend } from '@/lib/client-api';
import { TEMPLATE_COMPONENTS } from '../registry';
import { GameAudio } from './audio';
import { gameStrings, GameLang } from './strings';
import type { FinishPayload, ShellSettings } from './types';

type Phase = 'intro' | 'playing' | 'finished';
type Accent = 'en-GB' | 'en-US';

export type GameShellProps = {
  product: 'english' | 'vietnamese';
  slug: string;
  title: string;
  templateKey: TemplateKey;
  data: unknown;
  instructions?: string;
  loggedIn: boolean;
  libraryHref: string;
  loginHref: string;
  /** Xem trước trong Game Builder: không lưu kết quả, không mời đăng nhập, không có nút về thư viện. */
  preview?: boolean;
  /** Lưu kết quả theo cách riêng (lớp học: gửi về cho giáo viên). Có hàm này thì không lưu vào tài khoản. */
  onResult?: (r: { score: number; maxScore: number; mistakes: number; stars: 1 | 2 | 3; durationMs: number }) => Promise<boolean>;
  /** Thay link "về thư viện" bằng nút gọi hàm này (trang offline: không điều hướng khi mất mạng). */
  onBack?: () => void;
  /** Chữ hiện khi onResult lưu xong. */
  savedLabel?: string;
};

const ACCENT_KEY = 'hc.accent';
const SOUND_KEY = 'hc.sound';
const ENGLISH_VOICE_KEY = 'hc.english.voice';
const ENGLISH_RATE_KEY = 'hc.english.rate';
const ENGLISH_KID_DEFAULT_KEY = 'hc.english.kid-us-default.v1';
const ENGLISH_SAMPLE = 'Hello! Welcome to HappyClass. Listen carefully and have fun learning English.';
// Mẫu 6 thanh tiếng Việt; không phải kết quả đo chất lượng phát âm của Piper.
const VI_VOICE_SAMPLE = 'Bé nghe sáu thanh: ma, má, mà, mả, mã, mạ.';

function readPref(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writePref(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* bỏ qua: chế độ riêng tư */ }
}

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Khung chung cho mọi game: màn giới thiệu, thanh điểm, đồng hồ, âm thanh, toàn màn hình,
 * chơi lại, màn kết quả và lưu kết quả. Template chỉ lo luật chơi.
 */
export function GameShell(props: GameShellProps) {
  const lang: GameLang = props.product === 'english' ? 'en' : 'vi';
  const t = gameStrings(lang);
  const Template = TEMPLATE_COMPONENTS[props.templateKey];
  const isTeamGame = props.templateKey === 'trail-board'
    || (props.templateKey === 'quiz' && (props.data as { mode?: string }).mode === 'teams');
  const defaultTeams = (props.data as { defaultTeams?: number }).defaultTeams ?? 2;

  const rootRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [seed, setSeed] = useState(1);
  const [settings, setSettings] = useState<ShellSettings>({ teamCount: defaultTeams });
  const [progress, setProgress] = useState({ score: 0, mistakes: 0 });
  const [result, setResult] = useState<(FinishPayload & { stars: 1 | 2 | 3; durationMs: number }) | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'failed'>('idle');
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [isFullscreen, setFullscreen] = useState(false);
  const [sound, setSound] = useState(true);
  const [accent, setAccent] = useState<Accent>('en-US');
  const [englishVoiceURI, setEnglishVoiceURI] = useState('auto');
  const [englishRate, setEnglishRate] = useState(0.85);
  const [englishVoices, setEnglishVoices] = useState<{ name: string; lang: string; voiceURI: string }[]>([]);
  const [speechOk, setSpeechOk] = useState(true);
  const [voiceMissing, setVoiceMissing] = useState(false);

  const audio = useMemo(() => new GameAudio(lang === 'en' ? 'en-US' : 'vi-VN'), [lang]);
  useEffect(() => {
    const savedSound = readPref(SOUND_KEY);
    const savedAccent = readPref(ACCENT_KEY);
    if (savedSound === 'off') setSound(false);
    // One-time migration: requested default is American kid-friendly English.
    // After the first visit, explicit language/voice changes are respected.
    const kidDefaultSet = readPref(ENGLISH_KID_DEFAULT_KEY) === 'yes';
    if (lang === 'en' && !kidDefaultSet) {
      writePref(ACCENT_KEY, 'en-US');
      writePref(ENGLISH_VOICE_KEY, 'auto');
      writePref(ENGLISH_KID_DEFAULT_KEY, 'yes');
    } else {
      if (savedAccent === 'en-US' || savedAccent === 'en-GB') setAccent(savedAccent);
      const savedVoice = readPref(ENGLISH_VOICE_KEY);
      if (savedVoice && savedVoice.length <= 300) setEnglishVoiceURI(savedVoice);
    }
    const rate = Number(readPref(ENGLISH_RATE_KEY));
    if ([0.75, 0.85, 0.95].includes(rate)) setEnglishRate(rate);
    // Tiếng Việt đọc bằng giọng của máy chủ nên không phụ thuộc trình duyệt
    setSpeechOk(lang === 'vi' || audio.speechAvailable);
    audio.onUnavailable = () => setVoiceMissing(true);
    audio.onAvailable = () => setVoiceMissing(false);
    return () => { audio.onUnavailable = undefined; audio.onAvailable = undefined; };
  }, [audio, lang]);
  useEffect(() => { audio.enabled = sound; if (!sound) audio.stop(); }, [audio, sound]);
  useEffect(() => {
    if (lang !== 'en') return;
    audio.voiceLang = accent;
    audio.englishVoiceURI = englishVoiceURI === 'auto' ? null : englishVoiceURI;
    audio.englishRate = englishRate;
  }, [audio, accent, englishVoiceURI, englishRate, lang]);
  useEffect(() => {
    if (lang !== 'en' || !audio.speechAvailable) return;
    const synth = window.speechSynthesis;
    const update = () => setEnglishVoices(audio.availableEnglishVoices()
      .map((voice) => ({ name: voice.name, lang: voice.lang, voiceURI: voice.voiceURI })));
    update();
    synth.addEventListener?.('voiceschanged', update);
    const timer = window.setTimeout(update, 700);
    return () => {
      synth.removeEventListener?.('voiceschanged', update);
      window.clearTimeout(timer);
    };
  }, [audio, accent, lang]);
  useEffect(() => () => audio.stop(), [audio]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const start = useCallback(() => {
    setSeed(randomSeed());
    setRound((r) => r + 1);
    setProgress({ score: 0, mistakes: 0 });
    setResult(null);
    setSaveState('idle');
    setStartedAt(Date.now());
    setNow(Date.now());
    setPhase('playing');
  }, []);

  const onProgress = useCallback((p: { score: number; mistakes: number }) => setProgress(p), []);

  const onFinish = useCallback((p: FinishPayload) => {
    const durationMs = Date.now() - startedAt;
    const correct = Math.min(p.score, p.maxScore);
    const stars = starsFor(correct, Math.max(p.maxScore, 1), p.mistakes);
    setResult({ ...p, stars, durationMs });
    setPhase('finished');
    audio.sfx('win');
    const payload = { score: correct, maxScore: p.maxScore, mistakes: p.mistakes, stars, durationMs: Math.min(durationMs, 6 * 3_600_000) };
    if (props.onResult && !props.preview) {
      props.onResult(payload).then((ok) => setSaveState(ok ? 'saved' : 'failed'));
    } else if (props.loggedIn && !props.preview) {
      apiSend('POST', `/catalog/products/${props.product}/games/${props.slug}/sessions`, {
        score: correct, maxScore: p.maxScore, mistakes: p.mistakes, stars, durationMs: Math.min(durationMs, 6 * 3_600_000),
      }).then((res) => setSaveState(res.ok ? 'saved' : 'failed'));
    }
  }, [audio, props, startedAt]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch { /* trình duyệt từ chối toàn màn hình */ }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.key === 'f' || e.key === 'F') void toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const rng = useMemo(() => createRng(seed), [seed]);
  const elapsed = phase === 'playing' ? Math.max(0, now - startedAt) : result?.durationMs ?? 0;

  return (
    <div ref={rootRef} className={`game-shell lang-${lang} ${isFullscreen ? 'is-fullscreen' : ''}`} data-testid="game-shell" data-phase={phase}>
      <div className="shell-bar">
        <div className="shell-title"><b>{props.title}</b></div>
        <div className="shell-stats">
          {phase !== 'intro' && <span className="shell-pill" data-testid="shell-score">⭐ {progress.score}</span>}
          {phase !== 'intro' && <span className="shell-pill">⏱ {formatTime(elapsed)}</span>}
        </div>
        <div className="shell-controls">
          {lang === 'en' && (
            <select aria-label={t.accent} value={accent} onChange={(e) => {
                const v = e.target.value as Accent;
                setAccent(v); writePref(ACCENT_KEY, v);
                setEnglishVoiceURI('auto'); writePref(ENGLISH_VOICE_KEY, 'auto');
              }}>
              <option value="en-GB">🇬🇧 {t.british}</option>
              <option value="en-US">🇺🇸 {t.american}</option>
            </select>
          )}
          <button type="button" className="icon-button" aria-label={sound ? t.soundOff : t.soundOn} title={sound ? t.soundOff : t.soundOn}
            onClick={() => { const v = !sound; setSound(v); writePref(SOUND_KEY, v ? 'on' : 'off'); }}>{sound ? '🔊' : '🔇'}</button>
          {phase === 'playing' && <button type="button" className="icon-button" aria-label={t.restart} title={t.restart} onClick={start}>↻</button>}
          <button type="button" className="icon-button" aria-label={isFullscreen ? t.exitFullscreen : t.fullscreen} title={`${t.fullscreen} (F)`} onClick={toggleFullscreen}>⛶</button>
        </div>
      </div>

      {phase === 'intro' && (
        <div className="shell-intro">
          <h2>{props.title}</h2>
          {props.instructions && <p>{props.instructions}</p>}
          {isTeamGame && (
            <label className="team-count">{t.players}
              <select value={settings.teamCount} onChange={(e) => setSettings({ teamCount: Number(e.target.value) })} data-testid="team-count">
                {[2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
          {!speechOk && <p className="muted">{t.soundUnavailable}</p>}
          {lang === 'en' && (
            <div className="english-voice-panel" data-testid="english-voice-panel">
              <strong>🇺🇸 American English · Kid-friendly voice</strong>
              <p>We prefer a real US child voice (Ana) when your browser offers one. Otherwise we use the clearest available American voice. Preview before playing.</p>
              <div className="english-voice-options">
                <label htmlFor="english-voice-select">Voice
                  <select id="english-voice-select" data-testid="english-voice-select" value={englishVoices.some((v) => v.voiceURI === englishVoiceURI) ? englishVoiceURI : 'auto'}
                    onChange={(event) => {
                      const selected = event.target.value;
                      setEnglishVoiceURI(selected);
                      writePref(ENGLISH_VOICE_KEY, selected);
                    }}>
                    <option value="auto">✨ Best available US kid-friendly voice</option>
                    {englishVoices.map((voice) => (
                      <option value={voice.voiceURI} key={voice.voiceURI}>{voice.name} · {voice.lang}</option>
                    ))}
                  </select>
                </label>
                <label htmlFor="english-voice-speed">Speed
                  <select id="english-voice-speed" data-testid="english-voice-speed" value={englishRate}
                    onChange={(event) => {
                      const speed = Number(event.target.value);
                      setEnglishRate(speed);
                      writePref(ENGLISH_RATE_KEY, String(speed));
                    }}>
                    <option value="0.75">Slow · phonics</option>
                    <option value="0.85">Clear · children</option>
                    <option value="0.95">Natural pace</option>
                  </select>
                </label>
                <button type="button" className="secondary-button" disabled={!sound || !speechOk}
                  data-testid="english-voice-test" onClick={() => audio.say(ENGLISH_SAMPLE)}>
                  ▶ Hear sample
                </button>
              </div>
              {!englishVoices.length && <p className="english-voice-note">No installed English voices were listed yet. The browser default may work; for a clearer voice, enable an English voice in your device settings.</p>}
              {englishVoices.length > 0 && accent === 'en-US' && !englishVoices.some((v) => /(?:ana\s*(?:online|neural)|en-us-ana|\b(child|kid|children|youth)\b)/i.test(v.name) && v.lang.toLowerCase().replace('_', '-') === 'en-us') &&
                <p className="english-voice-note" data-testid="english-kid-fallback">A real American child voice is not available on this device. Using a clear US English voice with a gentle tone instead.</p>}
            </div>
          )}
          {lang === 'vi' && (
            <div className="voice-check" data-testid="voice-check">
              <button type="button" className="secondary-button" data-testid="voice-check-button"
                aria-label={t.voiceCheck} disabled={!sound} onClick={() => audio.say(VI_VOICE_SAMPLE)}>
                🔊 {t.voiceCheck}
              </button>
              <p>{sound ? t.voiceCheckHint : t.voiceCheckEnableSound}</p>
            </div>
          )}
          <button type="button" className="primary-button big" onClick={start} data-testid="shell-start">▶ {t.start}</button>
        </div>
      )}

      {voiceMissing && sound && <p className="voice-missing" role="status" data-testid="voice-missing">{t.voiceMissing}</p>}
      {phase === 'playing' && Template && (
        <div className="shell-stage">
          <Template key={round} data={props.data as never} lang={lang} t={t} rng={rng} audio={audio} settings={settings} onProgress={onProgress} onFinish={onFinish} />
        </div>
      )}

      {phase === 'finished' && result && (
        <div className="shell-result" data-testid="shell-result">
          <div className="result-stars" aria-label={`${result.stars}/3`}>{[1, 2, 3].map((i) => <span key={i} className={i <= result.stars ? 'on' : ''}>★</span>)}</div>
          <h2>{t.greatJob}</h2>
          <p data-testid="result-score">{t.youScored} {Math.min(result.score, result.maxScore)}/{result.maxScore} {t.points} · {t.mistakes}: {result.mistakes} · {t.time}: {formatTime(result.durationMs)}</p>
          {result.summary}
          {props.preview ? null : props.onResult ? (saveState === 'saved' && <p className="form-success" data-testid="result-saved">{props.savedLabel ?? t.saved}</p>)
            : props.loggedIn ? (saveState === 'saved' && <p className="form-success" data-testid="result-saved">{t.saved}</p>)
            : <p className="muted"><Link href={props.loginHref}>{t.loginToSave}</Link></p>}
          <div className="result-actions">
            <button type="button" className="primary-button" onClick={start} data-testid="play-again">↻ {t.playAgain}</button>
            {!props.preview && (props.onBack
              ? <button type="button" className="secondary-button" onClick={props.onBack}>{t.backToLibrary}</button>
              : <Link className="secondary-button" href={props.libraryHref}>{t.backToLibrary}</Link>)}
          </div>
        </div>
      )}
    </div>
  );
}
