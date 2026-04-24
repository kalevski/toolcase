import React from 'react'
import { UsageSummaryPanel } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const UsageSummaryPanelDemo: React.FC = () => (
	<DemoPage
		eyebrow="Dashboard & Admin"
		title="UsageSummaryPanel"
		lede="A usage breakdown panel with labeled progress meters and warning thresholds."
	>
		<DemoSection title="Default">
			<UsageSummaryPanel
				title="Project Usage"
				usage={[
					{ label: 'Storage', used: 2.4, total: 5, measurementUnit: 'GB' },
					{ label: 'Bandwidth', used: 15, total: 50, measurementUnit: 'GB' },
					{ label: 'Builds', used: 42, total: 100, measurementUnit: 'builds' },
				]}
			/>
		</DemoSection>

		<DemoSection title="With Warnings">
			<UsageSummaryPanel
				title="Account Limits"
				usage={[
					{ label: 'Storage', used: 4.8, total: 5, measurementUnit: 'GB', warn: true },
					{ label: 'API Calls', used: 9200, total: 10000, measurementUnit: 'calls', warn: true },
					{ label: 'Projects', used: 3, total: 10, measurementUnit: 'projects' },
				]}
			/>
		</DemoSection>

		<DemoSection title="Empty / Zero Usage">
			<UsageSummaryPanel
				title="New Account"
				usage={[
					{ label: 'Storage', used: 0, total: 1, measurementUnit: 'GB' },
					{ label: 'Bandwidth', used: 0, total: 10, measurementUnit: 'GB' },
				]}
			/>
		</DemoSection>
	</DemoPage>
)

export default UsageSummaryPanelDemo
