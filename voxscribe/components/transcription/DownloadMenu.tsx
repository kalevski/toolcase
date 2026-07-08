'use client'

// Download menu (spec §4.4): original audio + transcript.{txt,srt,vtt,json}.
// Plain links — the routes set Content-Disposition: attachment.

export function DownloadMenu({ id, done }: { id: string; done: boolean }) {
    return (
        <div className="voxscribe-download-menu">
            <a className="btn btn-sm btn-outline-secondary" href={`/api/transcriptions/${id}/audio`} download>
                Original audio
            </a>
            {done &&
                (['txt', 'srt', 'vtt', 'json'] as const).map((format) => (
                    <a
                        key={format}
                        className="btn btn-sm btn-outline-secondary"
                        href={`/api/transcriptions/${id}/transcript?format=${format}`}
                        download
                    >
                        .{format}
                    </a>
                ))}
        </div>
    )
}
