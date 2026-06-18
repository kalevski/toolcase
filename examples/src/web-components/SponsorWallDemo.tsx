import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

// Logo placeholders via placehold.co (slate-200 bg / slate-500 ink), sized to
// each tier's logo box. Same source used in CardDemo; via.placeholder.com is
// defunct (DNS dead), which is why these were previously broken.
const TIERS_FULL = [
    {
        name: 'Platinum',
        label: 'Platinum',
        size: 'xl',
        logos: [
            { src: 'https://placehold.co/160x64/e2e8f0/64748b?text=Acme+Corp', alt: 'Acme Corp', href: '#' },
            { src: 'https://placehold.co/160x64/e2e8f0/64748b?text=Globex', alt: 'Globex', href: '#' },
        ],
    },
    {
        name: 'Gold',
        label: 'Gold',
        size: 'lg',
        logos: [
            { src: 'https://placehold.co/120x48/e2e8f0/64748b?text=Initech', alt: 'Initech', href: '#' },
            { src: 'https://placehold.co/120x48/e2e8f0/64748b?text=Umbrella', alt: 'Umbrella', href: '#' },
            { src: 'https://placehold.co/120x48/e2e8f0/64748b?text=Stark+Ind', alt: 'Stark Industries', href: '#' },
        ],
    },
    {
        name: 'Silver',
        label: 'Silver',
        size: 'md',
        logos: [
            { src: 'https://placehold.co/96x38/e2e8f0/64748b?text=Hooli', alt: 'Hooli', href: '#' },
            { src: 'https://placehold.co/96x38/e2e8f0/64748b?text=Pied+Piper', alt: 'Pied Piper' },
            { src: 'https://placehold.co/96x38/e2e8f0/64748b?text=Dunder+Mifflin', alt: 'Dunder Mifflin', href: '#' },
            { src: 'https://placehold.co/96x38/e2e8f0/64748b?text=Vandelay', alt: 'Vandelay Industries' },
        ],
    },
    {
        name: 'Community',
        label: 'Community',
        size: 'sm',
        logos: [
            { src: 'https://placehold.co/72x28/e2e8f0/64748b?text=Lo+Fidelity', alt: 'Lo Fidelity' },
            { src: 'https://placehold.co/72x28/e2e8f0/64748b?text=Bluth+Co', alt: "Bluth's Original", href: '#' },
            { src: 'https://placehold.co/72x28/e2e8f0/64748b?text=Planet+Expr', alt: 'Planet Express' },
            { src: 'https://placehold.co/72x28/e2e8f0/64748b?text=Soylent', alt: 'Soylent Corp', href: '#' },
            { src: 'https://placehold.co/72x28/e2e8f0/64748b?text=Aperture', alt: 'Aperture Science', href: '#' },
        ],
    },
]

const TIERS_SINGLE = [
    {
        name: 'Partners',
        size: 'lg',
        logos: [
            { src: 'https://placehold.co/120x48/e2e8f0/64748b?text=Acme', alt: 'Acme', href: '#' },
            { src: 'https://placehold.co/120x48/e2e8f0/64748b?text=Globex', alt: 'Globex' },
            { src: 'https://placehold.co/120x48/e2e8f0/64748b?text=Initech', alt: 'Initech', href: '#' },
        ],
    },
]

const SponsorWallDemo: React.FC = () => {
    const fullRef = useRef<any>(null)
    const singleRef = useRef<any>(null)

    useEffect(() => {
        if (fullRef.current) fullRef.current.tiers = TIERS_FULL
    }, [])

    useEffect(() => {
        if (singleRef.current) singleRef.current.tiers = TIERS_SINGLE
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="SponsorWall"
                            description="Sponsor logos organised by tier with optional title and per-logo links. Logos rest greyscale/muted and lift to full on hover. Set tiers via the JS property."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Multiple tiers at all sizes (with title attribute)">
                                {/* @ts-ignore */}
                                <tc-sponsor-wall ref={fullRef} title="Our Sponsors" />
                            </SectionCard>

                            <SectionCard title="Single tier — no title, mixed linked / unlinked logos">
                                {/* @ts-ignore */}
                                <tc-sponsor-wall ref={singleRef} />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SponsorWallDemo
