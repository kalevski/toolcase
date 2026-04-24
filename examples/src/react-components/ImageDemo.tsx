import React from 'react'
import {
	Image,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const ImageDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Media & Files</RichPageHeaderChip>}
				title="Image"
				description="Enhanced img element with loading shimmer, fallback placeholder, aspect ratio, and object-fit support."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Basic">
			<div style={{ maxWidth: 400 }}>
				<Image
					src="https://picsum.photos/seed/wg1/600/400"
					alt="Random landscape"
					aspectRatio="3/2"
				/>
			</div>
		</SectionCard>

		<SectionCard title="Object Fit">
			<div className="d-flex gap-3 flex-wrap">
				{(['cover', 'contain', 'fill'] as const).map((fit) => (
					<div key={fit}>
						<p className="text-muted mb-1">{fit}</p>
						<Image
							src="https://picsum.photos/seed/wg2/600/400"
							alt={`Object fit: ${fit}`}
							objectFit={fit}
							aspectRatio="1/1"
							style={{ width: 150, border: '1px solid #e2e8f0' }}
						/>
					</div>
				))}
			</div>
		</SectionCard>

		<SectionCard title="Fallback on Error">
			<div style={{ maxWidth: 300 }}>
				<Image
					src="https://invalid-url-that-will-fail.test/nope.png"
					alt="Broken image"
					fallback={<span><i className="bi bi-image" /> Image not found</span>}
					aspectRatio="16/9"
				/>
			</div>
		</SectionCard>

		<SectionCard title="Aspect Ratios">
			<div className="d-flex gap-3 flex-wrap">
				{['1/1', '4/3', '16/9', '21/9'].map((ratio) => (
					<div key={ratio}>
						<p className="text-muted mb-1">{ratio}</p>
						<Image
							src={`https://picsum.photos/seed/wg-${ratio}/600/400`}
							alt={`Aspect ${ratio}`}
							aspectRatio={ratio}
							style={{ width: 150 }}
						/>
					</div>
				))}
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default ImageDemo
