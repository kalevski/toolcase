import React from 'react'
import { QueuedFile } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const QueuedFileDemo: React.FC = () => (
	<DemoPage
		eyebrow="Media & Files"
		title="QueuedFile"
		lede="A file row with a blinking loading effect and a dismiss button. Ideal for upload queues and processing lists."
	>
		<DemoSection title="Image Files">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
				<QueuedFile name="hero-spritesheet.png" extension="png" format="image" size={245760} onDismiss={() => console.log('dismiss hero-spritesheet.png')} />
				<QueuedFile name="tileset-forest.png" extension="png" format="image" size={102400} onDismiss={() => console.log('dismiss tileset-forest.png')} />
				<QueuedFile name="ui-icons.svg" extension="svg" format="image" size={8192} onDismiss={() => console.log('dismiss ui-icons.svg')} />
			</div>
		</DemoSection>

		<DemoSection title="Audio Files">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
				<QueuedFile name="battle-theme.ogg" extension="ogg" format="audio" size={5242880} onDismiss={() => console.log('dismiss')} />
				<QueuedFile name="explosion-sfx.wav" extension="wav" format="audio" size={131072} onDismiss={() => console.log('dismiss')} />
			</div>
		</DemoSection>

		<DemoSection title="Data & Archive Files">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
				<QueuedFile name="level-data.json" extension="json" format="text" size={4096} onDismiss={() => console.log('dismiss')} />
				<QueuedFile name="assets-v2.zip" extension="zip" format="archive" size={10485760} onDismiss={() => console.log('dismiss')} />
				<QueuedFile name="game.wasm" extension="wasm" format="binary" size={2097152} onDismiss={() => console.log('dismiss')} />
			</div>
		</DemoSection>

		<DemoSection title="Unknown Format / No Size">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
				<QueuedFile name="mystery-file.dat" extension="dat" onDismiss={() => console.log('dismiss')} />
				<QueuedFile name="readme.txt" extension="txt" format="text" onDismiss={() => console.log('dismiss')} />
			</div>
		</DemoSection>
	</DemoPage>
)

export default QueuedFileDemo
