import React from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Skeleton
} from '@toolcase/react-components'

const SkeletonDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Feedback</RichPageHeaderChip>}
				title="Skeleton"
				description="Shimmer placeholder for loading states. Supports text, circle, and rectangle variants."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Variants">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<div>
					<strong style={{ display: 'block', marginBottom: 8 }}>Text (default)</strong>
					<Skeleton />
				</div>
				<div>
					<strong style={{ display: 'block', marginBottom: 8 }}>Circle</strong>
					<Skeleton variant="circle" />
				</div>
				<div>
					<strong style={{ display: 'block', marginBottom: 8 }}>Rectangle</strong>
					<Skeleton variant="rect" width="100%" height={120} />
				</div>
			</div>
		</SectionCard>

		<SectionCard title="Multiple Lines">
			<Skeleton count={4} />
		</SectionCard>

		<SectionCard title="Card Placeholder">
			<div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
				<Skeleton variant="circle" width={48} height={48} />
				<div style={{ flex: 1 }}>
					<Skeleton width="60%" height="1.2em" />
					<div style={{ marginTop: 8 }}>
						<Skeleton count={2} />
					</div>
				</div>
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default SkeletonDemo
