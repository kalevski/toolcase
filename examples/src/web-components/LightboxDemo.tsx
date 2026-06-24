import React, { useEffect, useRef, useState } from 'react'

type GalleryImage = {
    src: string
    alt?: string
    caption?: string
    thumb?: string
}

const GALLERY: GalleryImage[] = [
    {
        src: 'https://picsum.photos/seed/a1/1200/800',
        alt: 'Mountains',
        caption: 'Majestic mountain range at sunrise',
        thumb: 'https://picsum.photos/seed/a1/200/150',
    },
    {
        src: 'https://picsum.photos/seed/b2/1200/800',
        alt: 'Forest',
        caption: 'Ancient forest in autumn',
        thumb: 'https://picsum.photos/seed/b2/200/150',
    },
    {
        src: 'https://picsum.photos/seed/c3/1200/800',
        alt: 'Ocean',
        caption: 'Waves crashing at the shore',
        thumb: 'https://picsum.photos/seed/c3/200/150',
    },
    {
        src: 'https://picsum.photos/seed/d4/1200/800',
        alt: 'Desert',
        caption: 'Sand dunes at golden hour',
        thumb: 'https://picsum.photos/seed/d4/200/150',
    },
    {
        src: 'https://picsum.photos/seed/e5/1200/800',
        alt: 'City',
        caption: 'City lights reflected in rain',
        thumb: 'https://picsum.photos/seed/e5/200/150',
    },
]

const LightboxDemo: React.FC = () => {
    const lightboxRef = useRef<HTMLElement | null>(null)
    const [open, setOpen] = useState(false)
    const [initial, setInitial] = useState(0)

    // Feed the array via the JS `images` property (arrays can't be set as attributes).
    useEffect(() => {
        const el = lightboxRef.current as any
        if (el) el.images = GALLERY
    }, [])

    // Controlled — the host fires tc-close; the consumer flips `open` to false.
    useEffect(() => {
        const el = lightboxRef.current
        if (!el) return
        const onClose = () => setOpen(false)
        el.addEventListener('tc-close', onClose)
        return () => el.removeEventListener('tc-close', onClose)
    }, [])

    const openAt = (i: number) => {
        setInitial(i)
        setOpen(true)
    }

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Lightbox"
                            description="Full-screen image gallery with keyboard/swipe navigation, thumbnails, captions, and focus management. Controlled component — fires tc-close when dismissed; set open to false to close."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Gallery — click any image to open the lightbox">
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {GALLERY.map((img, i) => (
                                        <button
                                            key={i}
                                            onClick={() => openAt(i)}
                                            style={{
                                                border: 'none',
                                                padding: 0,
                                                cursor: 'pointer',
                                                overflow: 'hidden',
                                            }}
                                            aria-label={`Open ${img.alt}`}
                                        >
                                            <img
                                                src={img.thumb}
                                                alt={img.alt}
                                                style={{
                                                    display: 'block',
                                                    width: 180,
                                                    height: 130,
                                                    objectFit: 'cover',
                                                }}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </tc-section-card>

                            {/* @ts-ignore */}
                            <tc-lightbox
                                ref={(el: HTMLElement | null) => {
                                    lightboxRef.current = el
                                }}
                                initial-index={initial}
                                open={open || undefined}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LightboxDemo
