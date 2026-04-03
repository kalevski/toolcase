import React from 'react'
import { Icon, Card, CodeSnippet } from '../../src'

const IconDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">Icon</h1>
				<p className="text-muted mb-0">Renders Bootstrap Icons with configurable size, color, and accessibility labels.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<Card>
					<h2 className="h5 mb-3">Common Icons</h2>
					<div className="d-flex flex-wrap gap-4">
						{['house', 'gear', 'person', 'folder', 'file-earmark', 'search', 'bell', 'star',
						  'heart', 'trash', 'pencil', 'download', 'upload', 'play', 'pause', 'check-circle'].map((name) => (
							<div key={name} className="d-flex flex-column align-items-center gap-1" style={{ width: 64 }}>
								<Icon name={name} size={24} />
								<span style={{ fontSize: '0.7rem' }} className="text-muted text-center">{name}</span>
							</div>
						))}
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<Card>
					<h2 className="h5 mb-3">Sizes</h2>
					<div className="d-flex align-items-end gap-4">
						<div className="d-flex flex-column align-items-center gap-1">
							<Icon name="star-fill" size={14} />
							<span className="text-muted" style={{ fontSize: '0.75rem' }}>14px</span>
						</div>
						<div className="d-flex flex-column align-items-center gap-1">
							<Icon name="star-fill" size={20} />
							<span className="text-muted" style={{ fontSize: '0.75rem' }}>20px</span>
						</div>
						<div className="d-flex flex-column align-items-center gap-1">
							<Icon name="star-fill" size={28} />
							<span className="text-muted" style={{ fontSize: '0.75rem' }}>28px</span>
						</div>
						<div className="d-flex flex-column align-items-center gap-1">
							<Icon name="star-fill" size={40} />
							<span className="text-muted" style={{ fontSize: '0.75rem' }}>40px</span>
						</div>
						<div className="d-flex flex-column align-items-center gap-1">
							<Icon name="star-fill" size={56} />
							<span className="text-muted" style={{ fontSize: '0.75rem' }}>56px</span>
						</div>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<Card>
					<h2 className="h5 mb-3">Colors</h2>
					<div className="d-flex flex-wrap gap-3">
						<Icon name="circle-fill" size={24} color="#6366f1" />
						<Icon name="circle-fill" size={24} color="#22c55e" />
						<Icon name="circle-fill" size={24} color="#ef4444" />
						<Icon name="circle-fill" size={24} color="#f59e0b" />
						<Icon name="circle-fill" size={24} color="#06b6d4" />
						<Icon name="circle-fill" size={24} color="#64748b" />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<Card>
					<h2 className="h5 mb-3">With Accessible Label</h2>
					<div className="d-flex gap-3 align-items-center">
						<Icon name="exclamation-triangle-fill" size={24} color="#f59e0b" label="Warning" />
						<span className="text-muted">This icon has an accessible label: "Warning"</span>
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
					code={`import { Icon } from '@webgame-cloud/react-components'

<Icon name="star-fill" size="1.5rem" color="#f59e0b" />
<Icon name="check-circle" label="Success" />`}
				/>
			</Card>
		</div>
	</div>
	</div>
)

export default IconDemo
