import React from 'react'
import {
	LiveFeed,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
} from '@toolcase/react-components'

const events = [
	{ id: 'e1', time: '14:42', actor: 'vex.kbd', message: <>auto-featured <i>Hush Tower</i> · 27 unique reactors</>, tags: [{ label: '+50', variant: 'acid' as const }] },
	{ id: 'e2', time: '14:31', actor: 'aft.fern', message: <>registered <i>Soft Static</i> in sprint 047</>, tags: [{ label: 'Register' }] },
	{ id: 'e3', time: '14:18', actor: 'orbit-rat', message: <>attested brief <i>047-A</i> on Carrion Memory</>, tags: [{ label: 'Attest' }] },
	{ id: 'e4', time: '14:09', actor: 'peat.tape', message: <>received 2 community flags on brief <i>047-C</i></>, tags: [{ label: 'Flag', variant: 'red' as const }] },
	{ id: 'e5', time: '13:54', actor: 'cold.lichen', message: <>submitted build #4 to sprint 047</>, tags: [{ label: 'Submit' }] },
	{ id: 'e6', time: '13:21', actor: 'halfbit.honey', message: <>promoted to <i>Journeyman</i> · 90d 308</>, tags: [{ label: 'Promote', variant: 'acid' as const }] },
	{ id: 'e7', time: '12:47', actor: 'nullmoss', message: <>earned helpful-answer +5 in <i>#dev-talk</i></>, tags: [{ label: '+5' }] },
	{ id: 'e8', time: '12:02', actor: 'shrike.hour', message: <>paused for sprint 048</>, tags: [{ label: 'Pause' }] },
]

const LiveFeedDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Game Jam / Arcade</RichPageHeaderChip>}
					title="LiveFeed"
					description="Log-style timestamped event list with optional pulsing REC indicator. Inline <b> bolds the actor; <i> emphasizes entity references."
				/>
				<div className="d-flex flex-column gap-4 mt-4">
					<SectionCard title="Recording feed">
						<LiveFeed recording events={events} />
					</SectionCard>

					<SectionCard title="No-actor minimal feed (capped at 3 rows)">
						<LiveFeed
							header="// System"
							maxRows={3}
							events={[
								{ id: 's1', time: '03:00', message: <>Nightly maintenance complete. <i>1,402 rows</i> reconciled.</> },
								{ id: 's2', time: '02:55', message: <>Decay recompute pass started.</> },
								{ id: 's3', time: '02:54', message: <>Scoring queue drained: <i>0 pending</i>.</> },
								{ id: 's4', time: '02:30', message: <>Hidden because maxRows=3.</> },
							]}
						/>
					</SectionCard>

					<SectionCard title="Neon theme">
						<div className="theme theme--neon" style={{ padding: 24 }}>
							<LiveFeed recording events={events} />
						</div>
					</SectionCard>
					<SectionCard title="Dark theme">
						<div className="theme theme--dark" style={{ padding: 24 }}>
							<LiveFeed recording events={events} />
						</div>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default LiveFeedDemo
