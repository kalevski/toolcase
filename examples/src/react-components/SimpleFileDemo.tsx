import { SimpleFile } from '@toolcase/react-components'
import { Card, CodeSnippet } from '@toolcase/react-components'

export const SimpleFileDemo = () => (
	<div className="container my-5">
		<div className="row">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">SimpleFile</h1>
				<p className="text-muted mb-4">A compact file display showing the name, extension, and an icon based on file type.</p>
			</div>
		</div>

		<div className="row mb-4">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Image Files</h2>
					<div className="d-flex flex-column gap-1">
						<SimpleFile name="player.png" extension="png" />
						<SimpleFile name="background.jpg" extension="jpg" />
						<SimpleFile name="tileset.svg" extension="svg" />
						<SimpleFile name="icon.gif" extension="gif" />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-4">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Audio Files</h2>
					<div className="d-flex flex-column gap-1">
						<SimpleFile name="soundtrack.mp3" extension="mp3" />
						<SimpleFile name="jump-sfx.wav" extension="wav" />
						<SimpleFile name="ambient.ogg" extension="ogg" />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-4">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Code &amp; Data Files</h2>
					<div className="d-flex flex-column gap-1">
						<SimpleFile name="game-config.json" extension="json" />
						<SimpleFile name="level-data.xml" extension="xml" />
						<SimpleFile name="main.ts" extension="ts" />
						<SimpleFile name="styles.css" extension="css" />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-4">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Archive &amp; Binary Files</h2>
					<div className="d-flex flex-column gap-1">
						<SimpleFile name="assets.zip" extension="zip" />
						<SimpleFile name="build.tar.gz" extension="gz" />
						<SimpleFile name="game.exe" extension="exe" />
						<SimpleFile name="readme.pdf" extension="pdf" />
					</div>
				</Card>
			</div>
		</div>

		{/* Usage */}
		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Usage</h2>
					<CodeSnippet
						language="typescript"
						code={`import { SimpleFile } from '@webgame-cloud/react-components'

<SimpleFile name="document.pdf" extension="pdf" />
<SimpleFile name="main.ts" extension="ts" />`}
					/>
				</Card>
			</div>
		</div>
	</div>
)
