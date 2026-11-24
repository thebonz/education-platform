'use client';

import { useEffect, useMemo, useState } from 'react';
import { GameAudio } from '@/games/shell/audio';

/** Chỉ dành cho trang Admin: nghe thử từng mẫu câu, KHÔNG tự động duyệt game. */
export function AdminVoiceReview({ samples }: { samples: string[] }) {
  const audio = useMemo(() => new GameAudio('vi-VN'), []);
  const [error, setError] = useState(false);
  useEffect(() => {
    audio.onUnavailable = () => setError(true);
    audio.onAvailable = () => setError(false);
    return () => {
      audio.onUnavailable = undefined;
      audio.onAvailable = undefined;
      audio.stop();
    };
  }, [audio]);

  return (
    <section className="panel admin-voice-review" data-testid="admin-voice-review">
      <h2>🔊 Kiểm tra giọng đọc tiếng Việt</h2>
      <p className="muted">Chọn từng câu để nghe qua dịch vụ giọng Việt của HappyClass. Chỉ lấy tối đa 12 mẫu; giáo viên cần chơi thử toàn bộ game và tự đánh giá phát âm, dấu thanh, tốc độ và mức độ phù hợp với trẻ.</p>
      {samples.length ? (
        <div className="admin-voice-samples">
          {samples.map((sample) => (
            <button key={sample} type="button" className="admin-voice-sample" data-testid="admin-voice-sample"
              onClick={() => { setError(false); audio.say(sample); }} title="Bấm để nghe">
              <span aria-hidden="true">🔊</span> <span>{sample}</span>
            </button>
          ))}
        </div>
      ) : <p className="muted">Không có mẫu giọng phù hợp trong phiên bản hiện tại. Hãy kiểm tra trực tiếp khi chơi thử.</p>}
      {error && <p className="voice-missing" role="status" data-testid="admin-voice-error">
        Chưa phát được giọng Việt. Kiểm tra kết nối/dịch vụ TTS rồi bấm nghe lại; không duyệt nếu chưa xác minh được các âm cần nghe.
      </p>}
    </section>
  );
}
