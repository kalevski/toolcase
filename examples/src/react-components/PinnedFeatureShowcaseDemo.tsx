import React from 'react'
import { PinnedFeatureShowcase, Card, CodeSnippet } from '@toolcase/react-components'

const PinnedFeatureShowcaseDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">PinnedFeatureShowcase</h1>
				<p className="text-muted mb-0">A sticky-scrolling feature showcase with pinned media and scrollable feature items.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Default</h2>
					<PinnedFeatureShowcase
						eyebrow="Why choose us"
						title="Built for game developers"
						description="A platform designed from the ground up to handle the unique needs of browser-based games."
						items={[
							{
								eyebrow: 'Performance',
								title: 'Global Edge Network',
								description: 'Assets are served from 200+ edge locations for sub-50ms load times worldwide.',
								icon: <i className="bi bi-globe2" style={{ fontSize: '1.5rem', color: '#6366f1' }} />,
							},
							{
								eyebrow: 'Developer Experience',
								title: 'One-Click Deploys',
								description: 'Push to deploy with automatic builds, versioning, and instant rollbacks.',
								icon: <i className="bi bi-rocket-takeoff" style={{ fontSize: '1.5rem', color: '#22c55e' }} />,
							},
							{
								eyebrow: 'Analytics',
								title: 'Real-Time Metrics',
								description: 'Track player sessions, retention, and performance with built-in dashboards.',
								icon: <i className="bi bi-bar-chart" style={{ fontSize: '1.5rem', color: '#f59e0b' }} />,
							},
							{
								eyebrow: 'Security',
								title: 'Built-In Protection',
								description: 'DDoS mitigation, SSL certificates, and asset integrity checks included.',
								icon: <i className="bi bi-shield-check" style={{ fontSize: '1.5rem', color: '#ef4444' }} />,
							},
						]}
						media={
							<div
								style={{
									width: '100%',
									height: 300,
									background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									color: '#6366f1',
									fontSize: '1rem',
									fontWeight: 600,
								}}
							>
								Media placeholder
							</div>
						}
					/>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Fewer Items (No Eyebrow)</h2>
					<PinnedFeatureShowcase
						title="Core Features"
						description="Everything you need to ship your game."
						items={[
							{
								title: 'Asset Bundling',
								description: 'Automatic sprite atlases, audio compression, and tree-shaking.',
								icon: <i className="bi bi-collection" style={{ fontSize: '1.5rem', color: '#06b6d4' }} />,
							},
							{
								title: 'Multiplayer Ready',
								description: 'WebSocket relay servers with automatic scaling and matchmaking.',
								icon: <i className="bi bi-people" style={{ fontSize: '1.5rem', color: '#8b5cf6' }} />,
							},
						]}
					/>
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
						code={`import { PinnedFeatureShowcase } from '@webgame-cloud/react-components'

<PinnedFeatureShowcase
  eyebrow="Why choose us"
  title="Built for game developers"
  description="Designed for browser-based games."
  items={[
    { title: 'Edge Network', description: 'Sub-50ms load times.', icon: <i className="bi bi-globe2" /> },
    { title: 'One-Click Deploys', description: 'Push to deploy.', icon: <i className="bi bi-rocket-takeoff" /> },
  ]}
  media={<img src="/preview.png" alt="Preview" />}
/>`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default PinnedFeatureShowcaseDemo
