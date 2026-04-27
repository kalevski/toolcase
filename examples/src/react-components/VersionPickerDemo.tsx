import React, { useState } from 'react'
import { VersionPicker, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const versions = [
	{ label: 'v1.x', value: '1', deprecated: true },
	{ label: 'v2.x', value: '2', lts: true },
	{ label: 'v3.x', value: '3', latest: true },
]

const VersionPickerDemo: React.FC = () => {
	const [v, setV] = useState('3')
	return (
		<div className="container py-4">
			<div className="row">
				<div className="col-12">
					<RichPageHeader
						chips={<RichPageHeaderChip>Roadmap & Releases</RichPageHeaderChip>}
						title="VersionPicker"
						description="Switch between docs/release versions with latest/LTS callouts."
					/>
					<div className="d-flex flex-column gap-3 mt-4">
						<SectionCard title="Segmented">
							<VersionPicker versions={versions} value={v} onChange={setV} />
							<div className="mt-2 text-muted small">Selected: v{v}.x</div>
						</SectionCard>
						<SectionCard title="Dropdown">
							<VersionPicker variant="dropdown" versions={versions} value={v} onChange={setV} />
						</SectionCard>
					</div>
				</div>
			</div>
		</div>
	)
}

export default VersionPickerDemo
