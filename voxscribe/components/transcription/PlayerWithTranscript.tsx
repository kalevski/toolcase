'use client'

// Audio player synced to the transcript (spec §4.4): HTML5 <audio> streaming
// from the Range-capable audio route; below it the timestamped segment list.
// The current segment highlights while playing; clicking a segment seeks.

import { useEffect, useRef, useState } from 'react'
import { segmentTimestamp } from '@/server/domain/format'
import type { TranscriptSegment } from '@/server/domain/types'

export function PlayerWithTranscript({ id, segments }: { id: string; segments: TranscriptSegment[] }) {
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const [currentIdx, setCurrentIdx] = useState(-1)
    const listRef = useRef<HTMLOListElement | null>(null)

    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return
        const onTime = () => {
            const t = audio.currentTime
            const idx = segments.findIndex((s) => t >= s.start && t < s.end)
            setCurrentIdx(idx)
        }
        audio.addEventListener('timeupdate', onTime)
        return () => audio.removeEventListener('timeupdate', onTime)
    }, [segments])

    // Keep the active segment in view while playing.
    useEffect(() => {
        if (currentIdx < 0) return
        const el = listRef.current?.children[currentIdx] as HTMLElement | undefined
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, [currentIdx])

    const seek = (s: TranscriptSegment) => {
        const audio = audioRef.current
        if (!audio) return
        audio.currentTime = s.start
        void audio.play().catch(() => {})
    }

    return (
        <div className="voxscribe-player">
            {/* No <track> element: the synced segment list below IS the caption surface. */}
            <audio ref={audioRef} controls preload="metadata" src={`/api/transcriptions/${id}/audio`} />
            {segments.length > 0 && (
                <ol className="voxscribe-segments" ref={listRef}>
                    {segments.map((s, i) => (
                        <li
                            key={`${s.start}-${i}`}
                            className={i === currentIdx ? 'voxscribe-segment-active' : undefined}
                        >
                            <button type="button" onClick={() => seek(s)}>
                                <span className="voxscribe-segment-ts">{segmentTimestamp(s.start)}</span>
                                <span>{s.text}</span>
                            </button>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    )
}
