import React from 'react'
import { Skeleton } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const SkeletonDemo: React.FC = () => (
	<DemoPage
		eyebrow="Feedback"
		title="Skeleton"
		lede="Shimmer placeholder for loading states. Supports line, circle, and rectangle shapes."
	>
		<DemoSection title="Shapes">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<div>
					<strong style={{ display: 'block', marginBottom: 8 }}>Line (default)</strong>
					<Skeleton />
				</div>
				<div>
					<strong style={{ display: 'block', marginBottom: 8 }}>Circle</strong>
					<Skeleton shape="circle" />
				</div>
				<div>
					<strong style={{ display: 'block', marginBottom: 8 }}>Rectangle</strong>
					<Skeleton shape="rect" width="100%" height={120} />
				</div>
			</div>
		</DemoSection>

		<DemoSection title="Multiple Lines">
			<Skeleton count={4} />
		</DemoSection>

		<DemoSection title="Card Placeholder">
			<div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
				<Skeleton shape="circle" width={48} height={48} />
				<div style={{ flex: 1 }}>
					<Skeleton width="60%" height="1.2em" />
					<div style={{ marginTop: 8 }}>
						<Skeleton count={2} />
					</div>
				</div>
			</div>
		</DemoSection>
	</DemoPage>
)

export default SkeletonDemo
