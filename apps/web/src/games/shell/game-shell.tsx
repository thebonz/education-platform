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
};

const ACCENT_KEY = 'hc.accent';
const SOUND_KEY = 'hc.sound';

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
  const isTeamGame = props.templateKey === 'quiz' && (props.data as { mode?: string }).mode === 'teams';
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
  const [accent, setAccent] = useState<Accent>('en-GB');
  const [speechOk, setSpeechOk] = useState(true);

  const audio = useMemo(() => new GameAudio(lang === 'en' ? 'en-GB' : 'vi-VN'), [lang]);
  useEffect(() => {
    const savedSound = readPref(SOUND_KEY);
    const savedAccent = readPref(ACCENT_KEY);
    if (savedSound === 'off') setSound(false);
    if (savedAccent === 'en-US' || savedAccent === 'en-GB') setAccent(savedAccent);
    setSpeechOk(audio.speechAvailable);
  }, [audio]);
  useEffect(() => { audio.enabled = sound; if (!sound) audio.stop(); }, [audio, sound]);
  useEffect(() => { if (lang === 'en') audio.voiceLang = accent; }, [audio, accent, lang]);
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
    if (props.loggedIn) {
      apiSend('POST', `/catalog/products/${props.product}/games/${props.slug}/sessions`, {
        score: correct, maxScore: p.maxScore, mistakes: p.mistakes, stars, durationMs: Math.min(durationMs, 6 * 3_600_000),
      }).then((res) => setSaveState(res.ok ? 'saved' : 'failed'));
    }
  }, [audio, props.loggedIn, props.product, props.slug, startedAt]);

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
            <select aria-label={t.accent} value={accent} onChange={(e) => { const v = e.target.value as Accent; setAccent(v); writePref(ACCENT_KEY, v); }}>
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
          <button type="button" className="primary-button big" onClick={start} data-testid="shell-start">▶ {t.start}</button>
        </div>
      )}

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
          {props.loggedIn ? (saveState === 'saved' && <p className="form-success" data-testid="result-saved">{t.saved}</p>)
            : <p className="muted"><Link href={props.loginHref}>{t.loginToSave}</Link></p>}
          <div className="result-actions">
            <button type="button" className="primary-button" onClick={start} data-testid="play-again">↻ {t.playAgain}</button>
            <Link className="secondary-button" href={props.libraryHref}>{t.backToLibrary}</Link>
          </div>
        </div>
      )}
    </div>
  );
}
