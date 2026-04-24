import React from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Spinner
} from '@toolcase/react-components'

const SpinnerDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Feedback</RichPageHeaderChip>}
				title="Spinner"
				description="A loading indicator with variant colors, sizes, and optional label."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Variants">
			<div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
				<Spinner variant="primary" />
				<Spinner variant="secondary" />
				<Spinner variant="info" />
				<Spinner variant="success" />
				<Spinner variant="warning" />
				<Spinner variant="danger" />
			</div>
		</SectionCard>

		<SectionCard title="Sizes">
			<div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
				<Spinner size="small" />
				<Spinner size="default" />
				<Spinner size="large" />
			</div>
		</SectionCard>

		<SectionCard title="With Label">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
				<Spinner label="Loading data…" />
				<Spinner variant="success" label="Saving changes…" size="large" />
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default SpinnerDemo
