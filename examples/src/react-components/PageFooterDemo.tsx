import React from 'react'
import { PageFooter, Card, Brand, CodeSnippet } from '@toolcase/react-components'

const PageFooterDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">PageFooter</h1>
				<p className="text-muted mb-0">A page footer with navigation menus, social links, legal links, and optional CTA.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Full Featured</h2>
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
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Minimal</h2>
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
						code={`import { PageFooter, Brand } from '@webgame-cloud/react-components'

<PageFooter
  brand={<Brand primaryText="webgame" secondaryText=".cloud" />}
  menus={[
    { heading: 'Product', links: [{ label: 'Features', href: '/features' }] },
    { heading: 'Company', links: [{ label: 'About', href: '/about' }] },
  ]}
  legalLinks={[
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
  ]}
  legalText="© 2025 webgame.cloud. All rights reserved."
/>`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default PageFooterDemo
