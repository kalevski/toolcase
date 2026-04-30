import React, { useMemo } from 'react'
import {
	CountdownTimer,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
} from '@toolcase/react-components'

const CountdownTimerDemo: React.FC = () => {
	const target = useMemo(() => Date.now() + (11 * 86400000 + 7 * 3600000 + 42 * 60000 + 19_000), [])
	const compactTarget = useMemo(() => Date.now() + 90 * 60000, [])

	return (
		<div className="container py-4">
			<div className="row">
				<div className="col-12">
					<RichPageHeader
						chips={<RichPageHeaderChip>Game Jam / Arcade</RichPageHeaderChip>}
						title="CountdownTimer"
						description="DD/HH/MM/SS grid that ticks down to a target Date. Pauses interval when the tab is hidden."
					/>
					<div className="d-flex flex-column gap-4 mt-4">
						<SectionCard title="Full — sprint deadline">
							<div className="text-center">
								<CountdownTimer
									target={target}
									label="Drop deadline — sprint 047 ends in"
									subLabel="…then sprint 048 auto-rolls."
								/>
							</div>
						</SectionCard>

						<SectionCard title="Hours + minutes only">
							<div className="text-center">
								<CountdownTimer
									target={compactTarget}
									units={['hours', 'minutes', 'seconds']}
									label="Voting window"
								/>
							</div>
						</SectionCard>

						<SectionCard title="Compact variant">
							<div className="text-center">
								<CountdownTimer compact target={compactTarget} label="Next deploy" />
							</div>
						</SectionCard>

						<SectionCard title="Neon theme">
							<div className="theme theme--neon" style={{ padding: 24, textAlign: 'center' }}>
								<CountdownTimer
									target={target}
									label="« DROP DEADLINE — SPRINT 047 ENDS IN »"
									subLabel="…then sprint 048 auto-rolls."
								/>
							</div>
						</SectionCard>
						<SectionCard title="Dark theme">
							<div className="theme theme--dark" style={{ padding: 24, textAlign: 'center' }}>
								<CountdownTimer
									target={target}
									label="« DROP DEADLINE — SPRINT 047 ENDS IN »"
									subLabel="…then sprint 048 auto-rolls."
								/>
							</div>
						</SectionCard>
					</div>
				</div>
			</div>
		</div>
	)
}

export default CountdownTimerDemo
