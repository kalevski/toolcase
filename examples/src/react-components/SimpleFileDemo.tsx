import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	SimpleFile
} from '@toolcase/react-components'

export const SimpleFileDemo = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Media & Files</RichPageHeaderChip>}
				title="SimpleFile"
				description="A compact file display showing the name, extension, and an icon based on file type."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Image Files">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
				<SimpleFile name="player.png" extension="png" />
				<SimpleFile name="background.jpg" extension="jpg" />
				<SimpleFile name="tileset.svg" extension="svg" />
				<SimpleFile name="icon.gif" extension="gif" />
			</div>
		</SectionCard>

		<SectionCard title="Audio Files">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
				<SimpleFile name="soundtrack.mp3" extension="mp3" />
				<SimpleFile name="jump-sfx.wav" extension="wav" />
				<SimpleFile name="ambient.ogg" extension="ogg" />
			</div>
		</SectionCard>

		<SectionCard title="Code & Data Files">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
				<SimpleFile name="game-config.json" extension="json" />
				<SimpleFile name="level-data.xml" extension="xml" />
				<SimpleFile name="main.ts" extension="ts" />
				<SimpleFile name="styles.css" extension="css" />
			</div>
		</SectionCard>

		<SectionCard title="Archive & Binary Files">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
				<SimpleFile name="assets.zip" extension="zip" />
				<SimpleFile name="build.tar.gz" extension="gz" />
				<SimpleFile name="game.exe" extension="exe" />
				<SimpleFile name="readme.pdf" extension="pdf" />
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)
