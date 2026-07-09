'use client';

import { useCallback, useEffect, useState } from 'react';

export type Slide = {
    src: string;
    label: string;
    title: string;
    desc?: string;
};

const PIPELINE_TICKS = ['upload ✓', 'ffmpeg ✓', 'whisper.cpp ✓', 'indexed ✓'];

export function Slideshow({
    slides,
    progress = 'dots',
    autoPlayMs = 6000,
}: {
    slides: Slide[];
    progress?: 'dots' | 'steps';
    autoPlayMs?: number;
}) {
    const count = slides.length;
    const [active, setActive] = useState(0);
    const [runId, setRunId] = useState(0);
    const [paused, setPaused] = useState(false);
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReduced(mq.matches);
        const onChange = () => setReduced(mq.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    useEffect(() => {
        const onVis = () => setPaused(document.hidden);
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
    }, []);

    const go = useCallback(
        (next: number) => {
            setActive((next + count) % count);
            setRunId((r) => r + 1);
        },
        [count]
    );

    useEffect(() => {
        if (paused || reduced || count < 2) return;
        const t = setInterval(() => go(active + 1), autoPlayMs);
        return () => clearInterval(t);
    }, [active, paused, reduced, autoPlayMs, count, go]);

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowRight') go(active + 1);
        if (e.key === 'ArrowLeft') go(active - 1);
    };

    const slide = slides[active];
    const tick = PIPELINE_TICKS[runId % PIPELINE_TICKS.length];

    return (
        <div
            className="vs-slideshow"
            style={{ '--vs-scan': '#2f9e8a' } as React.CSSProperties}
            role="region"
            aria-roledescription="carousel"
            aria-label="Screenshots"
            tabIndex={0}
            onKeyDown={onKeyDown}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            <div className="vs-slideshow-bleed">
                <div className="vs-slideshow-chrome">
                    <span className="vs-dot" style={{ background: '#ff5f57' }} />
                    <span className="vs-dot" style={{ background: '#febc2e' }} />
                    <span className="vs-dot" style={{ background: '#28c840' }} />
                    <span className="vs-slideshow-path">{slide.label}</span>
                    <span key={`tick-${runId}`} className="vs-slideshow-readout">
                        {reduced ? 'verified ✓' : tick}
                    </span>
                </div>
                <div className="vs-slideshow-stage">
                    <img
                        key={runId}
                        src={slide.src}
                        alt={slide.title}
                        className={reduced ? 'vs-slideshow-img' : 'vs-slideshow-img vs-slideshow-wipe'}
                    />
                    {!reduced && <span key={`bar-${runId}`} className="vs-slideshow-scanbar" />}
                    {count > 1 && (
                        <>
                            <button type="button" className="vs-slideshow-nav vs-slideshow-nav-prev" aria-label="Previous screenshot" onClick={() => go(active - 1)}>
                                ←
                            </button>
                            <button type="button" className="vs-slideshow-nav vs-slideshow-nav-next" aria-label="Next screenshot" onClick={() => go(active + 1)}>
                                →
                            </button>
                        </>
                    )}
                </div>
            </div>
            <div className="vs-slideshow-meta">
                <div>
                    <h3 className="vs-slideshow-title">{slide.title}</h3>
                    {slide.desc && <p className="vs-slideshow-desc">{slide.desc}</p>}
                </div>
                {count > 1 && (
                    <div className="vs-slideshow-progress">
                        {progress === 'steps'
                            ? slides.map((s, i) => (
                                  <button
                                      key={s.src}
                                      type="button"
                                      className={`vs-step ${i === active ? 'is-active' : ''}`}
                                      aria-label={`Go to step ${i + 1}: ${s.title}`}
                                      onClick={() => go(i)}
                                  >
                                      {i + 1}
                                  </button>
                              ))
                            : slides.map((s, i) => (
                                  <button
                                      key={s.src}
                                      type="button"
                                      className={`vs-dot-btn ${i === active ? 'is-active' : ''}`}
                                      aria-label={`Go to slide ${i + 1}: ${s.title}`}
                                      onClick={() => go(i)}
                                  />
                              ))}
                        <span className="vs-slideshow-count">
                            {String(active + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
                        </span>
                    </div>
                )}
            </div>
            <span className="vs-sr-only" aria-live="polite">
                {slide.title}
            </span>
        </div>
    );
}
