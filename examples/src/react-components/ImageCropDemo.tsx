import React, { useState } from 'react'
import { ImageCrop, Button, Card, CodeSnippet } from '@toolcase/react-components'

const usageCode = `import { ImageCrop } from '@toolcase/react-components'

<ImageCrop
  src="/photo.jpg"
  aspectRatio={16 / 9}
  onCrop={(blob) => uploadImage(blob)}
/>`

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
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">ImageCrop</h1>
					<p className="text-muted mb-0">Pan, zoom, and crop images with optional aspect ratio and circular mask.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Free-form crop</h2>
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
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">16:9 aspect ratio</h2>
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
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Circular crop (avatar)</h2>
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
		</div>
	)
}
