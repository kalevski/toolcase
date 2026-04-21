import React, { useState } from 'react'
import { Tag, Card, CodeSnippet } from '@toolcase/react-components'

const TagDemo: React.FC = () => {
	const [tags, setTags] = useState(['React', 'TypeScript', 'SCSS', 'Bootstrap'])

	return (
		<div className="container my-5">
			<div className="row">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-4">Tag</h1>
					<p className="text-muted mb-5">
						Small label with optional variant color and removable support.
					</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h3 mb-4">Variants</h2>
						<div className="d-flex gap-2 flex-wrap">
							<Tag variant="primary">Primary</Tag>
							<Tag variant="secondary">Secondary</Tag>
							<Tag variant="info">Info</Tag>
							<Tag variant="success">Success</Tag>
							<Tag variant="warning">Warning</Tag>
							<Tag variant="danger">Danger</Tag>
						</div>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h3 mb-4">Removable</h2>
						<div className="d-flex gap-2 flex-wrap">
							{tags.map((t) => (
								<Tag
									key={t}
									variant="primary"
									removable
									onRemove={() => setTags((prev) => prev.filter((x) => x !== t))}
								>
									{t}
								</Tag>
							))}
							{tags.length === 0 && <span className="text-muted">All tags removed</span>}
						</div>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h3 mb-4">Using label prop</h2>
						<div className="d-flex gap-2 flex-wrap">
							<Tag label="v1.0.0" variant="info" />
							<Tag label="stable" variant="success" />
							<Tag label="deprecated" variant="danger" />
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
							code={`import { Tag } from '@toolcase/react-components'

<Tag>Default</Tag>
<Tag variant="primary" removable onRemove={handleRemove}>React</Tag>`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default TagDemo
