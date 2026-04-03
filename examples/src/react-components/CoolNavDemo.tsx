import React from 'react'
import { CoolNav, Brand, Card, CodeSnippet } from '@toolcase/react-components'

const CoolNavDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">CoolNav</h1>
				<p className="text-muted mb-0">A responsive navigation bar with brand, nav items, login action, and theme support.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Light Theme</h2>
					<CoolNav
						brand={<Brand primaryText="webgame" secondaryText=".cloud" color="#6366f1" />}
						items={[
							{ key: 'features', label: 'Features', href: '#' },
							{ key: 'pricing', label: 'Pricing', href: '#' },
							{ key: 'docs', label: 'Docs', href: '#' },
						]}
						loginLabel="Sign In"
						loginVariant="primary"
						onLoginClick={() => alert('Login clicked')}
						sticky={false}
						theme="light"
					/>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Dark Theme</h2>
					<div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0' }}>
						<CoolNav
							brand={<Brand primaryText="pixel" secondaryText="forge" color="#f59e0b" />}
							items={[
								{ key: 'games', label: 'Games', href: '#' },
								{ key: 'assets', label: 'Assets', href: '#' },
								{ key: 'community', label: 'Community', href: '#' },
								{ key: 'blog', label: 'Blog', href: '#' },
							]}
							loginLabel="Get Started"
							loginVariant="warning"
							onLoginClick={() => alert('Get Started clicked')}
							sticky={false}
							theme="dark"
						/>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Minimal (No Login)</h2>
					<CoolNav
						brand={<Brand primaryText="docs" secondaryText=".dev" />}
						items={[
							{ key: 'guide', label: 'Guide', href: '#' },
							{ key: 'api', label: 'API', href: '#' },
							{ key: 'examples', label: 'Examples', href: '#' },
						]}
						sticky={false}
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
						code={`import { CoolNav, Brand } from '@webgame-cloud/react-components'

<CoolNav
  brand={<Brand primaryText="webgame" secondaryText=".cloud" />}
  items={[
    { key: 'features', label: 'Features', href: '/features' },
    { key: 'pricing', label: 'Pricing', href: '/pricing' },
    { key: 'docs', label: 'Docs', href: '/docs' },
  ]}
  loginLabel="Sign In"
  onLoginClick={handleLogin}
/>`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default CoolNavDemo
