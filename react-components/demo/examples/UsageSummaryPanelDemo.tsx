import React from 'react'
import { UsageSummaryPanel, Card, CodeSnippet } from '../../src'

const UsageSummaryPanelDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">UsageSummaryPanel</h1>
				<p className="text-muted mb-0">A usage breakdown panel with labeled progress meters and warning thresholds.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Default</h2>
					<UsageSummaryPanel
						title="Project Usage"
						usage={[
							{ label: 'Storage', used: 2.4, total: 5, measurementUnit: 'GB' },
							{ label: 'Bandwidth', used: 15, total: 50, measurementUnit: 'GB' },
							{ label: 'Builds', used: 42, total: 100, measurementUnit: 'builds' },
						]}
					/>
				</Card>
			</div>
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">With Warnings</h2>
					<UsageSummaryPanel
						title="Account Limits"
						usage={[
							{ label: 'Storage', used: 4.8, total: 5, measurementUnit: 'GB', warn: true },
							{ label: 'API Calls', used: 9200, total: 10000, measurementUnit: 'calls', warn: true },
							{ label: 'Projects', used: 3, total: 10, measurementUnit: 'projects' },
						]}
					/>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Empty / Zero Usage</h2>
					<UsageSummaryPanel
						title="New Account"
						usage={[
							{ label: 'Storage', used: 0, total: 1, measurementUnit: 'GB' },
							{ label: 'Bandwidth', used: 0, total: 10, measurementUnit: 'GB' },
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
						code={`import { UsageSummaryPanel } from '@webgame-cloud/react-components'

<UsageSummaryPanel
  title="Project Usage"
  usage={[
    { label: 'Storage', used: 2.4, total: 5, measurementUnit: 'GB' },
    { label: 'Bandwidth', used: 15, total: 50, measurementUnit: 'GB' },
    { label: 'Builds', used: 42, total: 100, measurementUnit: 'builds' },
  ]}
/>`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default UsageSummaryPanelDemo
