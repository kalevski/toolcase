import React from 'react'
import { BadgeRow, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const BadgeRowDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Hero & Above-the-fold</RichPageHeaderChip>}
					title="BadgeRow"
					description="Shields.io-style label/value pills for licence, build, version, downloads."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Project badges">
						<BadgeRow
							badges={[
								{ label: 'license', value: 'MIT', color: '#10b981' },
								{ label: 'build', value: 'passing', color: '#10b981' },
								{ label: 'npm', value: 'v2.5.6', color: '#cb3837' },
								{ label: 'coverage', value: '94%', color: '#6366f1' },
								{ label: 'downloads', value: '24k/wk', color: '#0ea5e9' },
							]}
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default BadgeRowDemo
