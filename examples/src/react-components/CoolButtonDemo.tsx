import React from 'react'
import { CoolButton } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const CoolButtonDemo: React.FC = () => (
	<DemoPage
		eyebrow="Marketing"
		title="CoolButton"
		lede="An enhanced button with addon element, separator, and position control."
	>
		<DemoSection title="With Addon (Right)">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
				<CoolButton variant="primary" addon={<i className="bi bi-arrow-right" />}>
					Get Started
				</CoolButton>
				<CoolButton variant="success" addon={<i className="bi bi-download" />}>
					Download
				</CoolButton>
				<CoolButton variant="danger" addon={<i className="bi bi-trash" />}>
					Delete
				</CoolButton>
			</div>
		</DemoSection>

		<DemoSection title="With Addon (Left)">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
				<CoolButton variant="primary" addon={<i className="bi bi-rocket-takeoff" />} addonPosition="left">
					Launch
				</CoolButton>
				<CoolButton variant="info" addon={<i className="bi bi-search" />} addonPosition="left">
					Search
				</CoolButton>
			</div>
		</DemoSection>

		<DemoSection title="Without Separator">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
				<CoolButton variant="primary" addon={<i className="bi bi-arrow-right" />} showSeparator={false}>
					Continue
				</CoolButton>
				<CoolButton variant="secondary" addon={<i className="bi bi-gear" />} showSeparator={false}>
					Settings
				</CoolButton>
			</div>
		</DemoSection>

		<DemoSection title="Sizes">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
				<CoolButton variant="primary" size="small" addon={<i className="bi bi-plus" />}>Small</CoolButton>
				<CoolButton variant="primary" addon={<i className="bi bi-plus" />}>Default</CoolButton>
				<CoolButton variant="primary" size="large" addon={<i className="bi bi-plus" />}>Large</CoolButton>
			</div>
		</DemoSection>

		<DemoSection title="No Addon (plain)">
			<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
				<CoolButton variant="primary">Primary</CoolButton>
				<CoolButton variant="secondary">Secondary</CoolButton>
				<CoolButton variant="warning" outline>Warning Outline</CoolButton>
			</div>
		</DemoSection>
	</DemoPage>
)

export default CoolButtonDemo
