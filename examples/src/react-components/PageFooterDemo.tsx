import React from 'react'
import { PageFooter, Brand } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const PageFooterDemo: React.FC = () => (
	<DemoPage
		eyebrow="Marketing"
		title="PageFooter"
		lede="A page footer with navigation menus, social links, legal links, and optional CTA."
	>
		<DemoSection title="Full Featured">
			<PageFooter
				brand={<Brand primaryText="webgame" secondaryText=".cloud" color="#6366f1" />}
				tagline="Ship web games faster"
				description="A cloud platform built for indie game developers."
				menus={[
					{
						heading: 'Product',
						links: [
							{ label: 'Features', href: '#' },
							{ label: 'Pricing', href: '#' },
							{ label: 'Changelog', href: '#' },
						],
					},
					{
						heading: 'Resources',
						links: [
							{ label: 'Documentation', href: '#' },
							{ label: 'API Reference', href: '#' },
							{ label: 'Status', href: '#', external: true },
						],
					},
					{
						heading: 'Company',
						links: [
							{ label: 'About', href: '#' },
							{ label: 'Blog', href: '#' },
							{ label: 'Contact', href: '#' },
						],
					},
				]}
				socialLinks={[
					{ label: 'GitHub', href: '#', icon: <i className="bi bi-github" /> },
					{ label: 'Twitter', href: '#', icon: <i className="bi bi-twitter-x" /> },
					{ label: 'Discord', href: '#', icon: <i className="bi bi-discord" /> },
				]}
				legalLinks={[
					{ label: 'Privacy Policy', href: '#' },
					{ label: 'Terms of Service', href: '#' },
				]}
				legalText="© 2025 webgame.cloud. All rights reserved."
			/>
		</DemoSection>

		<DemoSection title="Minimal">
			<PageFooter
				menus={[
					{
						heading: 'Links',
						links: [
							{ label: 'Home', href: '#' },
							{ label: 'Docs', href: '#' },
						],
					},
				]}
				legalText="© 2025 Example Inc."
			/>
		</DemoSection>
	</DemoPage>
)

export default PageFooterDemo
