import React from 'react'
import {
	HeroStatsBar,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
} from '@toolcase/react-components'

const stats = [
	{ key: 'Cycle', value: 14, unit: 'days' },
	{ key: 'Shipped', value: 46, unit: 'sprints' },
	{ key: 'Running', value: 1089, unit: 'days' },
	{ key: 'Off-season', value: 0, unit: 'ever', zero: true },
]

const HeroStatsBarDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Game Jam / Arcade</RichPageHeaderChip>}
					title="HeroStatsBar"
					description="Equal-width bordered cells with small uppercase key + huge mono numeral + small inline unit. Use directly under hero titles."
				/>
				<div className="d-flex flex-column gap-4 mt-4">
					<SectionCard title="Sprint stats — four cells with one zero variant">
						<HeroStatsBar stats={stats} />
					</SectionCard>

					<SectionCard title="Two-cell variant">
						<HeroStatsBar
							stats={[
								{ key: 'Total points', value: '3,402' },
								{ key: 'Games shipped', value: 18, unit: 'builds' },
							]}
						/>
					</SectionCard>

					<SectionCard title="Neon theme">
						<div className="theme theme--neon" style={{ padding: 24 }}>
							<HeroStatsBar stats={stats} />
						</div>
					</SectionCard>
					<SectionCard title="Dark theme">
						<div className="theme theme--dark" style={{ padding: 24 }}>
							<HeroStatsBar stats={stats} />
						</div>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default HeroStatsBarDemo
