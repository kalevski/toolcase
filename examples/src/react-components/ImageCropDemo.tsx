import React, { useState } from 'react'
import { ImageCrop } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const DEMO_IMAGE = 'https://picsum.photos/seed/toolcase/800/600'

export const ImageCropDemo: React.FC = () => {
	const [croppedFree,   setCroppedFree]   = useState<string | null>(null)
	const [croppedWide,   setCroppedWide]   = useState<string | null>(null)
	const [croppedCircle, setCroppedCircle] = useState<string | null>(null)

	const handleCrop = (setter: (s: string) => void) => (blob: Blob) => {
		const url = URL.createObjectURL(blob)
		setter(url)
	}

	return (
		<DemoPage
			eyebrow="Media & Files"
			title="ImageCrop"
			lede="Pan, zoom, and crop images with optional aspect ratio and circular mask."
		>
			<DemoSection title="Free-form crop">
				<ImageCrop
					src={DEMO_IMAGE}
					onCrop={handleCrop((url) => setCroppedFree(url))}
				/>
				{croppedFree && (
					<div className="mt-3">
						<p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>Result:</p>
						<img src={croppedFree} alt="Cropped result" style={{ maxWidth: '100%', borderRadius: 8 }} />
					</div>
				)}
			</DemoSection>

			<DemoSection title="16:9 aspect ratio">
				<ImageCrop
					src={DEMO_IMAGE}
					aspectRatio={16 / 9}
					onCrop={handleCrop((url) => setCroppedWide(url))}
				/>
				{croppedWide && (
					<div className="mt-3">
						<img src={croppedWide} alt="Cropped 16:9" style={{ maxWidth: '100%', borderRadius: 8 }} />
					</div>
				)}
			</DemoSection>

			<DemoSection title="Circular crop (avatar)">
				<ImageCrop
					src={DEMO_IMAGE}
					aspectRatio={1}
					circular
					onCrop={handleCrop((url) => setCroppedCircle(url))}
				/>
				{croppedCircle && (
					<div className="mt-3">
						<img
							src={croppedCircle}
							alt="Circular crop"
							style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover' }}
						/>
					</div>
				)}
			</DemoSection>
		</DemoPage>
	)
}
