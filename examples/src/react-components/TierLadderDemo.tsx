import React from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	TierLadder,
} from '@toolcase/react-components'

const tiers = [
	{ id: 'recruit', name: 'Recruit', range: '0 — 99', color: 'gray' as const },
	{ id: 'appr', name: 'Apprentice', range: '100 — 299', color: 'cyan' as const },
	{ id: 'journ', name: 'Journeyman', range: '300 — 699', color: 'yellow' as const },
	{ id: 'mason', name: 'Mason', range: '700 — 1499', color: 'pink' as const },
	{ id: 'arch', name: 'Architect', range: '1500+', color: 'red' as const },
]

const summary = (
	<>
		You: <b>412 pts</b> · 90d rolling<br />
		Next: Mason at 700 · need <b>288 more</b>
	</>
)

const TierLadderDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Game Jam / Arcade</RichPageHeaderChip>}
					title="TierLadder"
					description="Ranked tier list with colored dot, name, range. Highlights the current tier row."
				/>
				<div className="d-flex flex-column gap-4 mt-4">
					<SectionCard title="Five-tier ladder">
						<div style={{ maxWidth: 480 }}>
							<TierLadder
								title="Tier ladder · 90d rolling"
								currentTierId="journ"
								tiers={tiers}
								summary={summary}
							/>
						</div>
					</SectionCard>

					<SectionCard title="Without title or summary">
						<div style={{ maxWidth: 480 }}>
							<TierLadder
								tiers={[
									{ id: 'b', name: 'Bronze', range: 'Tier I', color: 'gray' },
									{ id: 's', name: 'Silver', range: 'Tier II', color: 'cyan' },
									{ id: 'g', name: 'Gold', range: 'Tier III', color: 'yellow' },
								]}
								currentTierId="s"
							/>
						</div>
					</SectionCard>

					<SectionCard title="Neon theme">
						<div className="theme theme--neon" style={{ padding: 24 }}>
							<div style={{ maxWidth: 480 }}>
								<TierLadder
									title="TIER LADDER · 90D ROLLING"
									currentTierId="journ"
									tiers={tiers}
									summary={summary}
								/>
							</div>
						</div>
					</SectionCard>
					<SectionCard title="Dark theme">
						<div className="theme theme--dark" style={{ padding: 24 }}>
							<div style={{ maxWidth: 480 }}>
								<TierLadder
									title="TIER LADDER · 90D ROLLING"
									currentTierId="journ"
									tiers={tiers}
									summary={summary}
								/>
							</div>
						</div>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default TierLadderDemo
