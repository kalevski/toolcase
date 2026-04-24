import React from 'react'
import {
	PricingCard,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const PricingCardDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Marketing</RichPageHeaderChip>}
				title="PricingCard"
				description="A pricing tier card with name, price, features list, highlight badge, and action button."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Tiers">
			<div style={{display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))'}}>
				<PricingCard
					name="Free"
					price="$0"
					period="forever"
					description="Perfect for hobby projects and experiments."
					features={['1 project', '1 GB storage', 'Community support', 'Shared CDN']}
					action={{ label: 'Get Started', variant: 'secondary', outline: true }}
				/>
				<PricingCard
					name="Pro"
					price="$19"
					period="/month"
					description="Everything you need to ship and scale your game."
					features={[
						{ label: '10 projects', iconName: 'check-circle-fill' },
						{ label: '50 GB storage', iconName: 'check-circle-fill' },
						{ label: 'Priority support', iconName: 'check-circle-fill' },
						{ label: 'Custom domain', iconName: 'check-circle-fill' },
						{ label: 'Analytics dashboard', iconName: 'check-circle-fill' },
					]}
					highlight
					badgeText="Most Popular"
					action={{ label: 'Start Free Trial', variant: 'primary' }}
				/>
				<PricingCard
					name="Enterprise"
					price="Custom"
					period="contact us"
					description="For studios with advanced requirements."
					features={[
						'Unlimited projects',
						'Unlimited storage',
						'Dedicated support',
						'SLA guarantee',
						'Custom integrations',
						'SSO & RBAC',
					]}
					action={{ label: 'Contact Sales', variant: 'info', outline: true }}
				/>
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default PricingCardDemo
