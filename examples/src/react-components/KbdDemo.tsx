import React from 'react'
import { Kbd } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const KbdDemo: React.FC = () => (
	<DemoPage
		eyebrow="Typography"
		title="Kbd"
		lede="Displays keyboard shortcuts with styled key caps. Supports single keys and multi-key combos."
	>
		<DemoSection title="Single Key">
			<div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
				<Kbd>Enter</Kbd>
				<Kbd>Esc</Kbd>
				<Kbd>Tab</Kbd>
				<Kbd>Space</Kbd>
			</div>
		</DemoSection>

		<DemoSection title="Key Combinations">
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
		</DemoSection>

		<DemoSection title="Inline Usage">
			<p>
				Press <Kbd keys={['Ctrl', 'S']} /> to save. Use <Kbd>F2</Kbd> to rename.
				Hold <Kbd keys={['Shift', 'Alt']} /> and click to multi-select.
			</p>
		</DemoSection>
	</DemoPage>
)

export default KbdDemo
