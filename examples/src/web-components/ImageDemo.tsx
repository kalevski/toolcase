import React, { useEffect, useRef } from 'react'

const ImageDemo: React.FC = () => {
    const brokenRef = useRef<any>(null)

    useEffect(() => {
        const el = brokenRef.current
        if (!el) return
        const onErr = () => {
            // tc-error was dispatched — handled by default fallback slot
        }
        el.addEventListener('tc-error', onErr)
        return () => el.removeEventListener('tc-error', onErr)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Image"
                            description="Image wrapper with a loading shimmer skeleton, optional aspect ratio, configurable object-fit, and an error fallback (default broken-image icon or custom slotted content)."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Successful image — aspect-ratio 16/9">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-image
                                        src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80"
                                        alt="Mountain landscape"
                                        aspect-ratio="16/9"
                                        object-fit="cover"
                                    ></tc-image>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="object-fit: contain — same image, different fit">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-image
                                        src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80"
                                        alt="Mountain landscape"
                                        aspect-ratio="4/3"
                                        object-fit="contain"
                                    ></tc-image>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Broken src — default broken-image fallback">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-image
                                        src="https://example.invalid/no-image.jpg"
                                        alt="Intentionally broken image"
                                        aspect-ratio="16/9"
                                    ></tc-image>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Broken src — custom slotted fallback">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-image
                                        ref={brokenRef}
                                        src="https://example.invalid/missing.png"
                                        alt="Photo unavailable"
                                        aspect-ratio="16/9"
                                    >
                                        <div
                                            style={{
                                                textAlign: 'center',
                                                padding: '1rem',
                                                color: 'var(--tc-text-muted)',
                                                fontSize: '0.875rem',
                                            }}
                                        >
                                            <div
                                                style={{ fontWeight: 500, marginBottom: '0.25rem' }}
                                            >
                                                Photo unavailable
                                            </div>
                                            <div>This image could not be loaded.</div>
                                        </div>
                                        {/* @ts-ignore */}
                                    </tc-image>
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ImageDemo
