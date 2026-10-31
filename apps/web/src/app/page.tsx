import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="landing-shell">
      <div className="landing-top"><span className="brand-mark">✦</span><span>PLAY · LEARN · GROW</span></div>
      <section className="landing-hero">
        <div className="eyebrow">ONE PLATFORM · TWO LEARNING WORLDS</div>
        <h1>Learning feels better<br /><span>when it becomes play.</span></h1>
        <p>Chọn thư viện trò chơi phù hợp với hành trình học tập của bạn.</p>
      </section>
      <section className="product-choice">
        <Link href="/english" className="choice-card choice-english">
          <div className="choice-art">Aa<span>✦</span></div>
          <div className="choice-content"><span className="choice-kicker">FOR ENGLISH LEARNERS</span><h2>English Games</h2><p>Phonics, vocabulary, spelling and classroom games.</p><span className="choice-link">Explore English Games <b>↗</b></span></div>
        </Link>
        <Link href="/vietnamese" className="choice-card choice-vietnamese">
          <div className="choice-art">Ăă<span>✿</span></div>
          <div className="choice-content"><span className="choice-kicker">DÀNH CHO BÉ HỌC TIẾNG VIỆT</span><h2>Vietnamese Games</h2><p>Chữ cái, dấu thanh, ghép vần và chính tả.</p><span className="choice-link">Khám phá trò chơi <b>↗</b></span></div>
        </Link>
      </section>
      <footer className="landing-footer">A shared learning platform, designed for curious minds.</footer>
    </main>
  );
}
