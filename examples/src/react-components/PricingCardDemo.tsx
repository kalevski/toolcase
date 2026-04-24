import React from 'react'
import { PricingCard } from '@toolcase/react-components'
import { DemoPage, DemoSection, DemoGrid } from './_demo'

const PricingCardDemo: React.FC = () => (
	<DemoPage
		eyebrow="Marketing"
		title="PricingCard"
		lede="A pricing tier card with name, price, features list, highlight badge, and action button."
	>
		<DemoSection title="Tiers">
			<DemoGrid minItemWidth={260}>
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
			</DemoGrid>
		</DemoSection>
	</DemoPage>
)

export default PricingCardDemo
