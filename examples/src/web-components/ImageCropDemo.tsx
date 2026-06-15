import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const DEMO_IMAGE = 'https://picsum.photos/seed/toolcase/800/600'

/** Listen for `tc-crop`, turning each cropped Blob into a preview object URL. */
function useCropPreview(): [string | null, React.RefObject<any>] {
    const [url, setUrl] = useState<string | null>(null)
    const ref = useRef<any>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        let current: string | null = null
        const onCrop = (e: Event) => {
            const blob = (e as CustomEvent<{ blob: Blob }>).detail.blob
            if (current) URL.revokeObjectURL(current)
            current = URL.createObjectURL(blob)
            setUrl(current)
        }
        const onError = (e: Event) => {
            // eslint-disable-next-line no-console
            console.error((e as CustomEvent<{ error: Error }>).detail.error)
        }
        el.addEventListener('tc-crop', onCrop)
        el.addEventListener('tc-error', onError)
        return () => {
            el.removeEventListener('tc-crop', onCrop)
            el.removeEventListener('tc-error', onError)
            if (current) URL.revokeObjectURL(current)
        }
    }, [])

    return [url, ref]
}

const ImageCropDemo: React.FC = () => {
    const [freeUrl, freeRef] = useCropPreview()
    const [wideUrl, wideRef] = useCropPreview()
    const [circleUrl, circleRef] = useCropPreview()

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ImageCrop"
                            description="Canvas-based image cropper with drag-to-pan, scroll-to-zoom, a zoom slider, an optional aspect ratio, and a circular mask. Apply emits the cropped region as a tc-crop event carrying a Blob."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Square crop (1:1)">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-image-crop ref={freeRef} src={DEMO_IMAGE} />
                                    {freeUrl && (
                                        <div className="mt-3">
                                            <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>Result:</p>
                                            <img src={freeUrl} alt="Cropped result" style={{ maxWidth: '100%' }} />
                                        </div>
                                    )}
                                </div>
                            </SectionCard>

                            <SectionCard title="Wide crop (aspect-ratio 1.777…)">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-image-crop ref={wideRef} src={DEMO_IMAGE} aspect-ratio={16 / 9} />
                                    {wideUrl && (
                                        <div className="mt-3">
                                            <img src={wideUrl} alt="Cropped 16:9" style={{ maxWidth: '100%' }} />
                                        </div>
                                    )}
                                </div>
                            </SectionCard>

                            <SectionCard title="Circular crop (avatar)">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-image-crop ref={circleRef} src={DEMO_IMAGE} aspect-ratio={1} circular />
                                    {circleUrl && (
                                        <div className="mt-3">
                                            <img
                                                src={circleUrl}
                                                alt="Circular crop"
                                                style={{ width: 120, height: 120, borderRadius: '50%' }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ImageCropDemo
