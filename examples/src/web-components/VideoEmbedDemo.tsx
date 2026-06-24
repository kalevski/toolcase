import React from 'react'

const VideoEmbedDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="VideoEmbed"
                            description="Responsive embedded video player. Detects the provider from the source URL — YouTube, Vimeo, Loom build the correct iframe embed; native files (.mp4/.webm/…) render a <video>. Drives a responsive aspect-ratio frame; forwards autoplay / loop / muted / controls."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="YouTube embed">
                                <div style={{ maxWidth: 640 }}>
                                    {/* @ts-ignore */}
                                    <tc-video-embed
                                        src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                                        title="Sample YouTube video"
                                    ></tc-video-embed>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Vimeo embed">
                                <div style={{ maxWidth: 640 }}>
                                    {/* @ts-ignore */}
                                    <tc-video-embed
                                        src="https://vimeo.com/76979871"
                                        title="Sample Vimeo video"
                                    ></tc-video-embed>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Native .mp4 — poster + controls">
                                <div style={{ maxWidth: 640 }}>
                                    {/* @ts-ignore */}
                                    <tc-video-embed
                                        src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                                        poster="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg"
                                        title="Big Buck Bunny"
                                        controls="true"
                                    ></tc-video-embed>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Non-16:9 aspect-ratio (1:1 square)">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-video-embed
                                        src="https://youtu.be/dQw4w9WgXcQ"
                                        aspect-ratio="1"
                                        title="Square aspect-ratio embed"
                                    ></tc-video-embed>
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default VideoEmbedDemo
