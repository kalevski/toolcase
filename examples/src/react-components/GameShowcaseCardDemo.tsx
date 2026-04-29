import React from 'react'
import {
	GameShowcaseCard,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
} from '@toolcase/react-components'

const grid = (
	<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
		<GameShowcaseCard
			stamps={[{ label: 'Featured · +50', color: 'yellow' }]}
			metaLeft="vex.kbd · #047-S12"
			metaRight="Sprint 5/5"
			title="Hush Tower"
			pitch="A two-player co-op stacker where speaking aloud knocks the tower over. The microphone is the antagonist."
			tags={['puzzle', 'silence']}
			compliance={['yes', 'yes', 'no']}
		/>
		<GameShowcaseCard
			stamps={[{ label: 'Finals track' }]}
			metaLeft="orbit-rat · #047-S07"
			metaRight="Sprint 7/8"
			title="Carrion Memory"
			pitch="Roguelike where the dungeon remembers your last run, but the hero forgets. The map gossips behind your back."
			tags={['roguelike', 'memory']}
			compliance={['yes', 'yes', 'yes']}
		/>
		<GameShowcaseCard
			metaLeft="nullmoss · #047-S03"
			metaRight="Sprint 3/3"
			title="1-Button Funeral"
			pitch="A one-screen idle ritual. Press space to mourn. The villagers do the rest. Sixty seconds, exactly."
			tags={['idle', 'folklore']}
			compliance={['no', 'yes', 'no']}
		/>
		<GameShowcaseCard
			stamps={[{ label: 'New' }]}
			metaLeft="aft.fern · #047-S15"
			metaRight="Sprint 1/1"
			title="Soft Static"
			pitch="Two players co-tune an analog radio across a cursed valley. Only one of you ever sees the dial."
			tags={['sim', 'static']}
			compliance={['yes', 'no', 'no']}
		/>
		<GameShowcaseCard
			stamps={[{ label: 'Flagged · 2', color: 'red' }]}
			metaLeft="peat.tape · #047-S18"
			metaRight="Sprint 4/4"
			title="Underbelly Brigade"
			pitch="A bullet-hell where you protect five cooperative miners by playing only their lantern."
			tags={['bullet-hell', 'underground']}
			compliance={['yes', 'yes', 'flag']}
		/>
		<GameShowcaseCard
			metaLeft="halfbit · #047-S22"
			metaRight="Sprint 2/2"
			title="Tower Tongue"
			pitch="Tower-defense where waves are syllables. Build defenses by chanting glyphs you can’t pronounce."
			tags={['tower-def', 'folklore']}
			compliance={['yes', 'no', 'no']}
		/>
	</div>
)

const GameShowcaseCardDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Game Jam / Arcade</RichPageHeaderChip>}
					title="GameShowcaseCard"
					description="Game preview tile with patterned art slot, corner stamps, meta line, title, pitch, and footer with tags + compliance dots."
				/>
				<div className="d-flex flex-column gap-4 mt-4">
					<SectionCard title="Mixed grid — six builds">{grid}</SectionCard>

					<SectionCard title="Interactive">
						<div style={{ maxWidth: 320 }}>
							<GameShowcaseCard
								stamps={[{ label: 'Click me', color: 'cyan' }]}
								metaLeft="Demo"
								metaRight="Sprint 1/1"
								title="Clickable build"
								pitch="Whole card is a button. Try Tab + Enter."
								onClick={() => alert('Build opened')}
								tags={['interactive']}
								compliance={['yes', 'yes', 'yes']}
							/>
						</div>
					</SectionCard>

					<SectionCard title="Neon theme">
						<div className="theme theme--neon" style={{ padding: 24 }}>{grid}</div>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default GameShowcaseCardDemo
