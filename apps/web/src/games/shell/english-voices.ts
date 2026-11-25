/**
 * Ranking only. Actual English voice inventory is provided by the user browser/OS;
 * no claim that a matching high-quality voice exists on every device.
 */
export type BrowserVoice = {
  name: string;
  lang: string;
  voiceURI: string;
  default?: boolean;
  localService?: boolean;
};

const normalize = (value: string) => value.trim().replace(/_/g, '-').toLowerCase();

export function isEnglishVoice(voice: BrowserVoice): boolean {
  return /^en(?:-|$)/.test(normalize(voice.lang));
}

function qualityScore(voice: BrowserVoice, accent: string): number {
  const name = voice.name.toLowerCase();
  const actual = normalize(voice.lang);
  const wanted = normalize(accent);
  let score = actual === wanted ? 120 : actual.startsWith('en-') ? 20 : 8;
  // Microsoft en-US-AnaNeural is specifically categorized as a child voice.
  // Only select it when it really appears in the browser's voice inventory.
  if (wanted === 'en-us' && actual === 'en-us'
    && /(?:ana\s*(?:online|neural)|en-us-ana|\b(child|kid|children|youth)\b)/.test(name)) score += 310;
  if (/\b(natural|neural|enhanced|premium)\b/.test(name)) score += 90;
  if (/google.*english|google us english|google uk english/.test(name)) score += 55;
  if (/microsoft.*(aria|jenny|guy|sonia|ryan|libby)/.test(name)) score += 45;
  if (/\b(samantha|daniel|serena|ava|allison|alex)\b/.test(name)) score += 40;
  if (/espeak|mbrola|robot|compact/.test(name)) score -= 25;
  if (voice.default) score += 5;
  return score;
}

export function rankedEnglishVoices<T extends BrowserVoice>(voices: readonly T[], accent: string): T[] {
  return voices.filter(isEnglishVoice).sort((a, b) => {
    const diff = qualityScore(b, accent) - qualityScore(a, accent);
    return diff !== 0 ? diff : a.name.localeCompare(b.name, 'en');
  });
}

export function preferredEnglishVoice<T extends BrowserVoice>(
  voices: readonly T[], accent: string, voiceURI?: string | null,
): T | null {
  const ranked = rankedEnglishVoices(voices, accent);
  // Remember an explicit user selection when that voice still exists and supports English.
  return ranked.find((voice) => voice.voiceURI === voiceURI) ?? ranked[0] ?? null;
}
