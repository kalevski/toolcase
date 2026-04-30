import React, { useState } from 'react'
import {
	ChipGroup,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
} from '@toolcase/react-components'

const ALL_GENRES = [
	{ id: 'rogue', label: 'Roguelike', count: 11 },
	{ id: 'puzzle', label: 'Puzzle', count: 9 },
	{ id: 'platformer', label: 'Platformer', count: 8 },
	{ id: 'tower', label: 'Tower-def', count: 4 },
	{ id: 'sim', label: 'Sim', count: 6 },
	{ id: 'bullet', label: 'Bullet-hell', count: 3 },
	{ id: 'twin', label: 'Twin-stick', count: 7 },
	{ id: 'idle', label: 'Idle', count: 5 },
]
const DISABLED = [
	{ id: 'rts', label: 'RTS', disabled: true },
	{ id: 'rpg', label: 'RPG', disabled: true },
	{ id: 'vn', label: 'VN', disabled: true },
	{ id: 'racing', label: 'Racing', disabled: true },
]

const ChipGroupDemo: React.FC = () => {
	const [enabled, setEnabled] = useState<Set<string>>(new Set(['rogue', 'puzzle', 'platformer', 'tower', 'sim', 'bullet', 'twin', 'idle']))

	const toggle = (id: string) => {
		setEnabled((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const items = [
		...ALL_GENRES.map((g) => ({ ...g, active: enabled.has(g.id) })),
		...DISABLED,
	]

	return (
		<div className="container py-4">
			<div className="row">
				<div className="col-12">
					<RichPageHeader
						chips={<RichPageHeaderChip>Game Jam / Arcade</RichPageHeaderChip>}
						title="ChipGroup"
						description="Wrapping container of toggleable chips. Each chip supports active, disabled, and an optional ×count suffix."
					/>
					<div className="d-flex flex-column gap-4 mt-4">
						<SectionCard title="Bordered with title + counts (controlled toggle)">
							<ChipGroup
								title="Allowed genres"
								subtitle={`SprintPool · ${enabled.size} of ${ALL_GENRES.length + DISABLED.length} enabled`}
								border
								items={items}
								onToggle={toggle}
							/>
						</SectionCard>

						<SectionCard title="Inline (no border)">
							<ChipGroup
								items={[
									{ id: 'memory', label: 'Memory', active: true, count: 8 },
									{ id: 'silence', label: 'Silence', active: true, count: 6 },
									{ id: 'coop', label: 'Co-op', active: true, count: 11 },
									{ id: 'decay', label: 'Decay', count: 3 },
									{ id: 'static', label: 'Static', count: 2 },
								]}
							/>
						</SectionCard>

						<SectionCard title="Neon theme">
							<div className="theme theme--neon" style={{ padding: 24 }}>
								<ChipGroup
									title="ALLOWED GENRES"
									subtitle={`SprintPool · ${enabled.size} of ${ALL_GENRES.length + DISABLED.length} enabled`}
									border
									items={items}
									onToggle={toggle}
								/>
							</div>
						</SectionCard>
						<SectionCard title="Dark theme">
							<div className="theme theme--dark" style={{ padding: 24 }}>
								<ChipGroup
									title="ALLOWED GENRES"
									subtitle={`SprintPool · ${enabled.size} of ${ALL_GENRES.length + DISABLED.length} enabled`}
									border
									items={items}
									onToggle={toggle}
								/>
							</div>
						</SectionCard>
					</div>
				</div>
			</div>
		</div>
	)
}

export default ChipGroupDemo
