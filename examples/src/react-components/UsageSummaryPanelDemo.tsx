import React from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	UsageSummaryPanel
} from '@toolcase/react-components'

const UsageSummaryPanelDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Dashboard & Admin</RichPageHeaderChip>}
				title="UsageSummaryPanel"
				description="A usage breakdown panel with labeled progress meters and warning thresholds."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Default">
			<UsageSummaryPanel
				title="Project Usage"
				usage={[
					{ label: 'Storage', used: 2.4, total: 5, measurementUnit: 'GB' },
					{ label: 'Bandwidth', used: 15, total: 50, measurementUnit: 'GB' },
					{ label: 'Builds', used: 42, total: 100, measurementUnit: 'builds' },
				]}
			/>
		</SectionCard>

		<SectionCard title="With Warnings">
			<UsageSummaryPanel
				title="Account Limits"
				usage={[
					{ label: 'Storage', used: 4.8, total: 5, measurementUnit: 'GB', warn: true },
					{ label: 'API Calls', used: 9200, total: 10000, measurementUnit: 'calls', warn: true },
					{ label: 'Projects', used: 3, total: 10, measurementUnit: 'projects' },
				]}
			/>
		</SectionCard>

		<SectionCard title="Empty / Zero Usage">
			<UsageSummaryPanel
				title="New Account"
				usage={[
					{ label: 'Storage', used: 0, total: 1, measurementUnit: 'GB' },
					{ label: 'Bandwidth', used: 0, total: 10, measurementUnit: 'GB' },
				]}
			/>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default UsageSummaryPanelDemo
