'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type Feedback = { kind: 'correct' | 'wrong' | 'info'; text: string } | null;

/** Thông báo ngắn tự ẩn, dùng chung cho các template. */
export function useFeedback(timeoutMs = 1600) {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((f: Feedback, sticky = false) => {
    window.clearTimeout(timer.current);
    setFeedback(f);
    if (!sticky && f) timer.current = window.setTimeout(() => setFeedback(null), timeoutMs);
  }, [timeoutMs]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { feedback, show };
}

export function FeedbackLine({ feedback }: { feedback: Feedback }) {
  return (
    <p className={`tpl-feedback ${feedback?.kind ?? ''}`} role="status" aria-live="polite" data-testid="tpl-feedback">
      {feedback?.text ?? ' '}
    </p>
  );
}
