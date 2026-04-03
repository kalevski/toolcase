import React from 'react'
import { Image, Card, CodeSnippet } from '@toolcase/react-components'

const ImageDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-4">Image</h1>
				<p className="text-muted mb-5">
					Enhanced img element with loading shimmer, fallback placeholder, aspect ratio, and object-fit support.
				</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Basic</h2>
					<div style={{ maxWidth: 400 }}>
						<Image
							src="https://picsum.photos/seed/wg1/600/400"
							alt="Random landscape"
							aspectRatio="3/2"
						/>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Object Fit</h2>
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
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Fallback on Error</h2>
					<div style={{ maxWidth: 300 }}>
						<Image
							src="https://invalid-url-that-will-fail.test/nope.png"
							alt="Broken image"
							fallback={<span><i className="bi bi-image" /> Image not found</span>}
							aspectRatio="16/9"
						/>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Aspect Ratios</h2>
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
				</Card>
			</div>
		</div>

		{/* Usage */}
		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Usage</h2>
					<CodeSnippet
						language="typescript"
						code={`import { Image } from '@webgame-cloud/react-components'

<Image src="/screenshot.png" alt="App screenshot" rounded />`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default ImageDemo
