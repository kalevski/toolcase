import React, { useState } from 'react'
import { Lightbox, LightboxImage, Button, Card, CodeSnippet } from '@toolcase/react-components'

const usageCode = `import { Lightbox, LightboxImage } from '@toolcase/react-components'

const images: LightboxImage[] = [
  { src: '/photo1.jpg', alt: 'Photo 1', caption: 'Caption text' },
]

<Lightbox
  images={images}
  open={open}
  onClose={() => setOpen(false)}
/>`

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
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Lightbox</h1>
					<p className="text-muted mb-0">Full-screen image viewer with keyboard/swipe navigation, thumbnails, and captions.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Gallery</h2>
						<div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
							{GALLERY.map((img, i) => (
								<button
									key={i}
									onClick={() => openAt(i)}
									style={{
										border: 'none',
										padding: 0,
										cursor: 'pointer',
										borderRadius: 8,
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
						<p className="text-muted mt-2 mb-0" style={{ fontSize: '0.85rem' }}>
							Click any image to open the lightbox.
						</p>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet language="typescript" code={usageCode} />
					</Card>
				</div>
			</div>

			<Lightbox
				images={GALLERY}
				open={open}
				initialIndex={initial}
				onClose={() => setOpen(false)}
			/>
		</div>
	)
}
