import React from 'react'
import { Icon } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const IconDemo: React.FC = () => (
	<DemoPage
		eyebrow="Media & Files"
		title="Icon"
		lede="Renders Bootstrap Icons with configurable size, color, and accessibility labels."
	>
		<DemoSection title="Common Icons">
			<div className="d-flex flex-wrap gap-4">
				{['house', 'gear', 'person', 'folder', 'file-earmark', 'search', 'bell', 'star',
				  'heart', 'trash', 'pencil', 'download', 'upload', 'play', 'pause', 'check-circle'].map((name) => (
					<div key={name} className="d-flex flex-column align-items-center gap-1" style={{ width: 64 }}>
						<Icon name={name} size={24} />
						<span style={{ fontSize: '0.7rem' }} className="text-muted text-center">{name}</span>
					</div>
				))}
			</div>
		</DemoSection>

		<DemoSection title="Sizes">
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
		</DemoSection>

		<DemoSection title="Colors">
			<div className="d-flex flex-wrap gap-3">
				<Icon name="circle-fill" size={24} color="#6366f1" />
				<Icon name="circle-fill" size={24} color="#22c55e" />
				<Icon name="circle-fill" size={24} color="#ef4444" />
				<Icon name="circle-fill" size={24} color="#f59e0b" />
				<Icon name="circle-fill" size={24} color="#06b6d4" />
				<Icon name="circle-fill" size={24} color="#64748b" />
			</div>
		</DemoSection>

		<DemoSection title="With Accessible Label">
			<div className="d-flex gap-3 align-items-center">
				<Icon name="exclamation-triangle-fill" size={24} color="#f59e0b" label="Warning" />
				<span className="text-muted">This icon has an accessible label: "Warning"</span>
			</div>
		</DemoSection>
	</DemoPage>
)

export default IconDemo
