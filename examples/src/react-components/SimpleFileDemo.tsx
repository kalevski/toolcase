import { SimpleFile } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

export const SimpleFileDemo = () => (
	<DemoPage
		eyebrow="Media & Files"
		title="SimpleFile"
		lede="A compact file display showing the name, extension, and an icon based on file type."
	>
		<DemoSection title="Image Files">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
				<SimpleFile name="player.png" extension="png" />
				<SimpleFile name="background.jpg" extension="jpg" />
				<SimpleFile name="tileset.svg" extension="svg" />
				<SimpleFile name="icon.gif" extension="gif" />
			</div>
		</DemoSection>

		<DemoSection title="Audio Files">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
				<SimpleFile name="soundtrack.mp3" extension="mp3" />
				<SimpleFile name="jump-sfx.wav" extension="wav" />
				<SimpleFile name="ambient.ogg" extension="ogg" />
			</div>
		</DemoSection>

		<DemoSection title="Code & Data Files">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
				<SimpleFile name="game-config.json" extension="json" />
				<SimpleFile name="level-data.xml" extension="xml" />
				<SimpleFile name="main.ts" extension="ts" />
				<SimpleFile name="styles.css" extension="css" />
			</div>
		</DemoSection>

		<DemoSection title="Archive & Binary Files">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
				<SimpleFile name="assets.zip" extension="zip" />
				<SimpleFile name="build.tar.gz" extension="gz" />
				<SimpleFile name="game.exe" extension="exe" />
				<SimpleFile name="readme.pdf" extension="pdf" />
			</div>
		</DemoSection>
	</DemoPage>
)
