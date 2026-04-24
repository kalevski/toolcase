import React, { useState } from 'react'
import {
	ImageCrop,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

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
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Media & Files</RichPageHeaderChip>}
				title="ImageCrop"
				description="Pan, zoom, and crop images with optional aspect ratio and circular mask."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Free-form crop">
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
			</SectionCard>

			<SectionCard title="16:9 aspect ratio">
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
			</SectionCard>

			<SectionCard title="Circular crop (avatar)">
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
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}
