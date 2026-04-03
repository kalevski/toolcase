import React from 'react'
import { PricingCard, Card, CodeSnippet } from '@toolcase/react-components'

const PricingCardDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">PricingCard</h1>
				<p className="text-muted mb-0">A pricing tier card with name, price, features list, highlight badge, and action button.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-4">
				<Card>
					<h2 className="h5 mb-3">Free Tier</h2>
					<PricingCard
						name="Free"
						price="$0"
						period="forever"
						description="Perfect for hobby projects and experiments."
						features={['1 project', '1 GB storage', 'Community support', 'Shared CDN']}
						action={{ label: 'Get Started', variant: 'secondary', outline: true }}
					/>
				</Card>
			</div>
			<div className="col-lg-4">
				<Card>
					<h2 className="h5 mb-3">Highlighted</h2>
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
				</Card>
			</div>
			<div className="col-lg-4">
				<Card>
					<h2 className="h5 mb-3">Enterprise</h2>
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
						code={`import { PricingCard } from '@webgame-cloud/react-components'

<PricingCard
  name="Pro"
  price="$19"
  period="/month"
  description="Everything you need to ship and scale."
  features={['10 projects', '50 GB storage', 'Priority support', 'Custom domain']}
  highlight
  badgeText="Most Popular"
  action={{ label: 'Start Free Trial', variant: 'primary' }}
/>`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default PricingCardDemo
