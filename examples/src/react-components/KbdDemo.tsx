import React from 'react'
import {
	Kbd,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const KbdDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Typography</RichPageHeaderChip>}
				title="Kbd"
				description="Displays keyboard shortcuts with styled key caps. Supports single keys and multi-key combos."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Single Key">
			<div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
				<Kbd>Enter</Kbd>
				<Kbd>Esc</Kbd>
				<Kbd>Tab</Kbd>
				<Kbd>Space</Kbd>
			</div>
		</SectionCard>

		<SectionCard title="Key Combinations">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<Kbd keys={['Ctrl', 'C']} /> <span style={{ color: '#64748b' }}>— Copy</span>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<Kbd keys={['Ctrl', 'V']} /> <span style={{ color: '#64748b' }}>— Paste</span>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<Kbd keys={['Ctrl', 'Shift', 'P']} /> <span style={{ color: '#64748b' }}>— Command Palette</span>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<Kbd keys={['⌘', 'K']} /> <span style={{ color: '#64748b' }}>— Quick Open (macOS)</span>
				</div>
			</div>
		</SectionCard>

		<SectionCard title="Inline Usage">
			<p>
				Press <Kbd keys={['Ctrl', 'S']} /> to save. Use <Kbd>F2</Kbd> to rename.
				Hold <Kbd keys={['Shift', 'Alt']} /> and click to multi-select.
			</p>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default KbdDemo
