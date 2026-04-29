import React, { useState } from 'react'
import {
	CycleWheel,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
} from '@toolcase/react-components'

const CycleWheelDemo: React.FC = () => {
	const [paused, setPaused] = useState(false)
	const [current, setCurrent] = useState(1)
	const phases = ['Roll', 'Build', 'Attest', 'Ship', 'Close']

	return (
		<div className="container py-4">
			<div className="row">
				<div className="col-12">
					<RichPageHeader
						chips={<RichPageHeaderChip>Game Jam / Arcade</RichPageHeaderChip>}
						title="CycleWheel"
						description="Rotating SVG ring of phase labels around a fixed center showing the current state and an arrow pointer."
					/>
					<div className="d-flex flex-column gap-4 mt-4">
						<SectionCard title="Default — five-phase loop">
							<div style={{ maxWidth: 420, margin: '0 auto' }}>
								<CycleWheel
									phases={phases}
									currentIndex={current}
									paused={paused}
									centerLabel="Now · Sprint"
									centerValue="047"
									centerPill="Open"
									centerSub={<>Day <b>03</b> / 14</>}
								/>
							</div>
							<div className="d-flex gap-2 justify-content-center mt-3">
								<button className="btn btn-sm btn-outline-secondary" onClick={() => setCurrent((c) => (c + 1) % phases.length)}>
									Next phase ({phases[current]})
								</button>
								<button className="btn btn-sm btn-outline-secondary" onClick={() => setPaused((p) => !p)}>
									{paused ? 'Resume' : 'Pause'}
								</button>
							</div>
						</SectionCard>

						<SectionCard title="Three-phase variant">
							<div style={{ maxWidth: 320, margin: '0 auto' }}>
								<CycleWheel
									phases={['Draft', 'Review', 'Ship']}
									currentIndex={2}
									spinSeconds={30}
									centerValue="v2"
									centerPill="Live"
								/>
							</div>
						</SectionCard>

						<SectionCard title="Neon theme">
							<div className="theme theme--neon" style={{ padding: 24 }}>
								<div style={{ maxWidth: 420, margin: '0 auto' }}>
									<CycleWheel
										phases={phases}
										currentIndex={current}
										paused={paused}
										centerLabel="↻ NOW · СПРИНТ"
										centerValue="047"
										centerPill="OPEN"
										centerSub={<>DAY <b>03</b> / 14</>}
									/>
								</div>
							</div>
						</SectionCard>
					</div>
				</div>
			</div>
		</div>
	)
}

export default CycleWheelDemo
