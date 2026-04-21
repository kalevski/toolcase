import React from 'react'
import { QueuedFile, Card, CodeSnippet } from '@toolcase/react-components'

const QueuedFileDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">QueuedFile</h1>
				<p className="text-muted mb-0">A file row with a blinking loading effect and a dismiss button. Ideal for upload queues and processing lists.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Image Files</h2>
					<div className="d-flex flex-column gap-1">
						<QueuedFile name="hero-spritesheet.png" extension="png" format="image" size={245760} onDismiss={() => console.log('dismiss hero-spritesheet.png')} />
						<QueuedFile name="tileset-forest.png" extension="png" format="image" size={102400} onDismiss={() => console.log('dismiss tileset-forest.png')} />
						<QueuedFile name="ui-icons.svg" extension="svg" format="image" size={8192} onDismiss={() => console.log('dismiss ui-icons.svg')} />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Audio Files</h2>
					<div className="d-flex flex-column gap-1">
						<QueuedFile name="battle-theme.ogg" extension="ogg" format="audio" size={5242880} onDismiss={() => console.log('dismiss')} />
						<QueuedFile name="explosion-sfx.wav" extension="wav" format="audio" size={131072} onDismiss={() => console.log('dismiss')} />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Data &amp; Archive Files</h2>
					<div className="d-flex flex-column gap-1">
						<QueuedFile name="level-data.json" extension="json" format="text" size={4096} onDismiss={() => console.log('dismiss')} />
						<QueuedFile name="assets-v2.zip" extension="zip" format="archive" size={10485760} onDismiss={() => console.log('dismiss')} />
						<QueuedFile name="game.wasm" extension="wasm" format="binary" size={2097152} onDismiss={() => console.log('dismiss')} />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Unknown Format / No Size</h2>
					<div className="d-flex flex-column gap-1">
						<QueuedFile name="mystery-file.dat" extension="dat" onDismiss={() => console.log('dismiss')} />
						<QueuedFile name="readme.txt" extension="txt" format="text" onDismiss={() => console.log('dismiss')} />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Usage</h2>
					<CodeSnippet
						language="typescript"
						code={`import { QueuedFile } from '@toolcase/react-components'

<QueuedFile
  name="hero-spritesheet.png"
  extension="png"
  format="image"
  size={245760}
  onDismiss={() => removeFromQueue(file.id)}
/>`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default QueuedFileDemo
