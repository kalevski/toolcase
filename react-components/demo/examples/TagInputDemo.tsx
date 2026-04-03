import React, { useState } from 'react'
import { TagInput, Card, CodeSnippet } from '../../src'

const TagInputDemo: React.FC = () => {
	const [tags, setTags] = useState<string[]>(['pixel-art', 'retro'])
	const [controlled, setControlled] = useState<string[]>(['unity', 'godot'])

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">TagInput</h1>
					<p className="text-muted mb-0">A tag input with autocomplete recommendations, controlled/uncontrolled modes, and tag limits.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Basic with Recommendations</h2>
						<TagInput
							label="Tags"
							recommendations={['pixel-art', 'retro', '2d', '3d', 'platformer', 'puzzle', 'rpg', 'action']}
							value={tags}
							onChange={setTags}
							placeholder="Add a tag…"
						/>
						<p className="text-muted mt-2 mb-0" style={{ fontSize: '0.8rem' }}>Tags: {tags.join(', ')}</p>
					</Card>
				</div>
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Controlled</h2>
						<TagInput
							label="Engines"
							recommendations={['unity', 'godot', 'unreal', 'phaser', 'pixi', 'three.js']}
							value={controlled}
							onChange={setControlled}
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Allow Create</h2>
						<TagInput
							label="Custom Tags"
							recommendations={['alpha', 'beta', 'release']}
							defaultValue={['alpha']}
							allowCreate
							placeholder="Type and press Enter…"
						/>
					</Card>
				</div>
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Max Tags (3)</h2>
						<TagInput
							label="Limited"
							recommendations={['red', 'green', 'blue', 'yellow', 'purple']}
							defaultValue={['red', 'green']}
							maxTags={3}
							allowCreate
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Disabled</h2>
						<TagInput
							label="Read-only Tags"
							defaultValue={['locked', 'readonly']}
							disabled
						/>
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
							code={`import { TagInput } from '@webgame-cloud/react-components'

<TagInput
  label="Tags"
  value={tags}
  onChange={setTags}
  placeholder="Add a tag..."
/>`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default TagInputDemo
