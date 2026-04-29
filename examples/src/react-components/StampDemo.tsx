import React from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Stamp,
} from '@toolcase/react-components'

const Surface: React.FC<{ children: React.ReactNode }> = ({ children }) => (
	<div style={{
		position: 'relative',
		width: 220,
		height: 140,
		background: 'var(--tc-surface-muted)',
		border: '1px solid var(--tc-border)',
		display: 'grid',
		placeItems: 'center',
		color: 'var(--tc-text-faint)',
		fontFamily: 'var(--tc-font-family-mono)',
		fontSize: 12,
		letterSpacing: '0.08em',
		textTransform: 'uppercase',
	}}>
		{children}
	</div>
)

const colors = (
	<div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
		<Surface><Stamp label="Pink" position="tl" /><span>art</span></Surface>
		<Surface><Stamp label="Yellow" color="yellow" position="tl" /><span>art</span></Surface>
		<Surface><Stamp label="Red" color="red" position="tl" /><span>art</span></Surface>
		<Surface><Stamp label="Cyan" color="cyan" position="tl" /><span>art</span></Surface>
		<Surface><Stamp label="Green" color="green" position="tl" /><span>art</span></Surface>
	</div>
)

const StampDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Game Jam / Arcade</RichPageHeaderChip>}
					title="Stamp"
					description="Solid-color corner badge. Position-able via 'tl' / 'tr' / 'bl' / 'br' on a relative parent. Variants: pink, yellow, red, cyan, green."
				/>
				<div className="d-flex flex-column gap-4 mt-4">
					<SectionCard title="All five colors (top-left)">{colors}</SectionCard>

					<SectionCard title="All four corners">
						<div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
							<Surface><Stamp label="TL" position="tl" /></Surface>
							<Surface><Stamp label="TR" color="yellow" position="tr" /></Surface>
							<Surface><Stamp label="BL" color="cyan" position="bl" /></Surface>
							<Surface><Stamp label="BR" color="green" position="br" /></Surface>
						</div>
					</SectionCard>

					<SectionCard title="Inline (no position)">
						<div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
							<Stamp label="Featured · +50" color="yellow" />
							<Stamp label="New" />
							<Stamp label="Flagged · 2" color="red" />
						</div>
					</SectionCard>

					<SectionCard title="Neon theme">
						<div className="theme theme--neon" style={{ padding: 32 }}>{colors}</div>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default StampDemo
