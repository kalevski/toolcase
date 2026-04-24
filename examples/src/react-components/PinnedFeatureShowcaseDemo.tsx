import React from 'react'
import {
	PinnedFeatureShowcase,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const PinnedFeatureShowcaseDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Marketing</RichPageHeaderChip>}
				title="PinnedFeatureShowcase"
				description="A sticky-scrolling feature showcase with pinned media and scrollable feature items."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Default">
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
		</SectionCard>

		<SectionCard title="Fewer Items (No Eyebrow)">
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
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default PinnedFeatureShowcaseDemo
