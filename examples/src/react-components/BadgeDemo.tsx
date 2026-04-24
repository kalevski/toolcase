import React from 'react'
import { Badge } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const BadgeDemo: React.FC = () => (
	<DemoPage
		eyebrow="Feedback"
		title="Badge"
		lede="A small colored label for status indicators, counts, and tags."
	>
		<DemoSection title="Variants">
			<div className="d-flex flex-wrap gap-2">
				<Badge variant="primary">Primary</Badge>
				<Badge variant="secondary">Secondary</Badge>
				<Badge variant="success">Success</Badge>
				<Badge variant="danger">Danger</Badge>
				<Badge variant="warning">Warning</Badge>
				<Badge variant="info">Info</Badge>
			</div>
		</DemoSection>

		<DemoSection title="Pill">
			<div className="d-flex flex-wrap gap-2">
				<Badge variant="primary" pill>Primary</Badge>
				<Badge variant="secondary" pill>Secondary</Badge>
				<Badge variant="success" pill>Success</Badge>
				<Badge variant="danger" pill>Danger</Badge>
				<Badge variant="warning" pill>Warning</Badge>
				<Badge variant="info" pill>Info</Badge>
			</div>
		</DemoSection>

		<DemoSection title="With Label Prop">
			<div className="d-flex flex-wrap gap-2">
				<Badge variant="primary" label="v2.4.0" />
				<Badge variant="info" label="New" pill />
				<Badge variant="success" label="Active" />
				<Badge variant="danger" label="3 errors" pill />
			</div>
		</DemoSection>

		<DemoSection title="Sizes">
			<div className="d-flex flex-wrap align-items-center gap-2">
				<Badge variant="primary" size="sm">Small</Badge>
				<Badge variant="primary" size="md">Medium</Badge>
				<Badge variant="primary" size="lg">Large</Badge>
			</div>
		</DemoSection>

		<DemoSection title="In Context">
			<div className="d-flex flex-column gap-2">
				<p className="mb-0">Notifications <Badge variant="danger" pill>4</Badge></p>
				<p className="mb-0">Build Status: <Badge variant="success">Passing</Badge></p>
				<p className="mb-0">Environment: <Badge variant="warning">Staging</Badge></p>
			</div>
		</DemoSection>
	</DemoPage>
)

export default BadgeDemo
