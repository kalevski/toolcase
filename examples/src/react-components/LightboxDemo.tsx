import React, { useState } from 'react'
import { Lightbox, LightboxImage } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const GALLERY: LightboxImage[] = [
	{ src: 'https://picsum.photos/seed/a1/800/600', alt: 'Mountains', caption: 'Majestic mountain range at sunrise' },
	{ src: 'https://picsum.photos/seed/b2/800/600', alt: 'Forest',    caption: 'Ancient forest in autumn' },
	{ src: 'https://picsum.photos/seed/c3/800/600', alt: 'Ocean',     caption: 'Waves crashing at the shore' },
	{ src: 'https://picsum.photos/seed/d4/800/600', alt: 'Desert',    caption: 'Sand dunes at golden hour' },
	{ src: 'https://picsum.photos/seed/e5/800/600', alt: 'City',      caption: 'City lights reflected in rain' },
]

export const LightboxDemo: React.FC = () => {
	const [open,    setOpen]    = useState(false)
	const [initial, setInitial] = useState(0)

	const openAt = (i: number) => {
		setInitial(i)
		setOpen(true)
	}

	return (
		<DemoPage
			eyebrow="Overlays"
			title="Lightbox"
			lede="Full-screen image viewer with keyboard/swipe navigation, thumbnails, and captions."
		>
			<DemoSection title="Gallery">
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
								src={img.src.replace('/800/600', '/200/150')}
								alt={img.alt}
								style={{ display: 'block', width: 180, height: 130, objectFit: 'cover' }}
							/>
						</button>
					))}
				</div>
				<p style={{ color: '#64748b', marginTop: 8, marginBottom: 0, fontSize: '0.85rem' }}>
					Click any image to open the lightbox.
				</p>
			</DemoSection>

			<Lightbox
				images={GALLERY}
				open={open}
				initialIndex={initial}
				onClose={() => setOpen(false)}
			/>
		</DemoPage>
	)
}
