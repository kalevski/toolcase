import React from 'react'
import {
	Brand,
	Button,
	Card,
	CoolNav,
	Hero,
	Icon,
	Changelog,
	PageFooter,
	PinnedFeatureShowcase,
	CoolButton,
	PricingCard,
	EarlySignupForm,
} from '@toolcase/react-components'
import type { PricingCardProps } from '@toolcase/react-components'

const navItems = [
	{ key: 'features', label: 'Features', href: '#features' },
	{ key: 'showcase', label: 'Showcase', href: '#showcase' },
	{ key: 'pricing', label: 'Pricing', href: '#pricing' },
]

const pricingPlans: PricingCardProps[] = [
	{
		name: 'Starter',
		price: '$0',
		period: 'month',
		description: 'Individual creators launching a first live preview or MVP.',
		features: ['Hosted demo page', '5 navigation items', 'Email support'],
		action: {
			label: 'Choose Starter',
			variant: 'primary',
			outline: true,
		},
	},
	{
		name: 'Growth',
		price: '$29',
		period: 'month',
		description: 'Scaling teams ready to add theme presets and collaborative workflows.',
		features: ['Unlimited navigation items', 'Theme presets', 'Priority support'],
		highlight: true,
		action: {
			label: 'Choose Growth',
			variant: 'primary',
		},
	},
	{
		name: 'Scale',
		price: '$99',
		period: 'month',
		description: 'Established studios needing guidance, A/B tooling, and dedicated success.',
		features: ['Custom design reviews', 'A/B testing toolkit', 'Dedicated success guide'],
		action: {
			label: 'Contact Sales',
			variant: 'secondary',
		},
	},
	{
		name: 'Scale2',
		price: '$99',
		period: 'month',
		description: 'Established studios needing guidance, A/B tooling, and dedicated success.',
		features: ['Custom design reviews', 'A/B testing toolkit', 'Dedicated success guide'],
		action: {
			label: 'Contact Sales',
			variant: 'secondary',
		},
	},
]

const pinnedFeatureShowcaseItems = [
	{
		eyebrow: 'World-building',
		title: 'Narrative-driven progressions',
		description:
			'Design story arcs that surface as players unlock milestones, complete with reactive UI states and telemetry hooks.',
		icon: <Icon name="book" decorative />,
	},
	{
		eyebrow: 'World-building',
		title: 'Narrative-driven progressions',
		description:
			'Design story arcs that surface as players unlock milestones, complete with reactive UI states and telemetry hooks.',
		icon: <Icon name="book" decorative />,
	},
	{
		eyebrow: 'World-building',
		title: 'Narrative-driven progressions',
		description:
			'Design story arcs that surface as players unlock milestones, complete with reactive UI states and telemetry hooks.',
		icon: <Icon name="book" decorative />,
	},
	{
		eyebrow: 'World-building',
		title: 'Narrative-driven progressions',
		description:
			'Design story arcs that surface as players unlock milestones, complete with reactive UI states and telemetry hooks.',
		icon: <Icon name="book" decorative />,
	},
	{
		eyebrow: 'Live Ops',
		title: 'Automated spotlight drops',
		description:
			'Schedule cinematic reveals, gated events, and FOMO moments with a single configuration that syncs to your CMS.',
		icon: <Icon name="lightning-charge" decorative />,
	},
	{
		eyebrow: 'Insights',
		title: 'Player sentiment overlays',
		description:
			'Blend survey pulses, voice chat analytics, and heatmap summaries into shareable dashboards for stakeholders.',
		icon: <Icon name="bar-chart" decorative />,
	},
	{
		eyebrow: 'Collaboration',
		title: 'Pixel-perfect review rooms',
		description:
			'Invite art, audio, and QA squads to annotate builds, track sign-offs, and ship aligned experiences faster.',
		icon: <Icon name="people" decorative />,
	},
]

const changelogEntries = [
	{
		date: 'Dec 22, 2025',
		title: 'PinnedFeatureShowcase beta',
		description: 'Introduce the new pinned layout experience with scroll-aware feature callouts for launch pages.',
		tag: 'New',
	},
	{
		date: 'Dec 10, 2025',
		title: 'Hero metrics refresh',
		description: 'Ship modern metric cards and stat stacks for cinematic above-the-fold storytelling.',
		tag: 'Improvement',
	},
	{
		date: 'Nov 28, 2025',
		title: 'PageFooter simplification',
		description: 'Streamline the footer with focused menus, social links, and legal copy that fit any brand.',
		tag: 'Update',
	},
	{
		date: 'Nov 12, 2025',
		title: 'Timeline overlap modes',
		description: 'Add overlap-friendly timeline layouts for dense product roadmaps and release histories.',
		tag: 'New',
	},
	{
		date: 'Oct 30, 2025',
		title: 'Accessibility polish',
		description: 'Improve keyboard navigation, aria labelling, and contrast defaults across the component set.',
		tag: 'Improvement',
	},
]

const footerMenus = [
	{
		heading: 'Platform',
		description: 'Accelerate every launch surface with reusable layouts, data hooks, and motion-ready components.',
		links: [
			{ label: 'Features', href: '#features' },
			{ label: 'Showcase', href: '#showcase' },
			{ label: 'Pricing', href: '#pricing' },
			{ label: 'Changelog', href: '#changelog' },
		],
	},
	{
		heading: 'Solutions',
		links: [
			{ label: 'Game studios', href: '#platform' },
			{ label: 'Live ops', href: '#cta' },
			{ label: 'Agency partners', href: '#' },
			{ label: 'Enterprise', href: '#' },
		],
	},
	{
		heading: 'Resources',
		links: [
			{ label: 'Documentation', href: '#' },
			{ label: 'Component kit', href: '#platform' },
			{ label: 'Design tokens', href: '#' },
			{ label: 'Status page', href: '#' },
		],
	},
	{
		heading: 'Company',
		links: [
			{ label: 'About', href: '#' },
			{ label: 'Careers', href: '#' },
			{ label: 'Newsletter', href: '#' },
			{ label: 'Contact', href: '#cta' },
		],
	},
]

const footerSocialLinks = [
	{
		label: 'Twitter',
		href: 'https://twitter.com',
		external: true,
		icon: <Icon name="twitter" decorative />,
	},
	{
		label: 'Discord',
		href: 'https://discord.com',
		external: true,
		icon: <Icon name="discord" decorative />,
	},
	{
		label: 'YouTube',
		href: 'https://youtube.com',
		external: true,
		icon: <Icon name="youtube" decorative />,
	},
]

const footerLegalLinks = [
	{ label: 'Privacy', href: '#' },
	{ label: 'Terms', href: '#' },
	{ label: 'Security', href: '#' },
]

export const FullLandingPageDemo: React.FC = () => {
	const handleNavLoginClick = (event: React.MouseEvent<HTMLButtonElement>) => {
		event.preventDefault()
		const target = document.getElementById('cta')
		target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
	}

	return (
		<div className="bg-light min-vh-100">
			<CoolNav
				brand={<Brand primaryText="WEBGAME" secondaryText=".CLOUD" label="demo" />}
				items={navItems}
				rightEl={
					<CoolButton
						size="small"
						variant="primary"
						addon={<Icon name="person" decorative />}
						onClick={handleNavLoginClick}
					>
						Login & Register
					</CoolButton>
				}
			/>

			<main>
				<Hero
					eyebrow="Realtime launch metrics"
					title="Hero sections that feel cinematic right out of the box"
					description="Blend immersive imagery, animated stat cards, and data-backed proof without wrestling CSS. Drop in your product shot and tweak copy to launch a visually rich above-the-fold story."
					primaryAction={{
						label: 'Start building',
						variant: 'primary',
						size: 'large',
					}}
					secondaryAction={{
						label: 'Watch product tour',
						variant: 'secondary',
						outline: true,
						size: 'large',
					}}
					backgroundPatternSrc="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNDAiIGhlaWdodD0iMjQwIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNNjAgMEgwVjYwIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoNzksNzAsMjI5LDAuMjUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIyNDAiIGhlaWdodD0iMjQwIiBmaWxsPSJyZ2JhKDc5LDcwLDIyOSwwLjA1KSIvPjxyZWN0IHdpZHRoPSIyNDAiIGhlaWdodD0iMjQwIiBmaWxsPSJ1cmwoI2dyaWQpIiBvcGFjaXR5PSIwLjciLz48L3N2Zz4="
					statCards={[{ label: 'Live dashboards', value: '64', helper: 'Auto-calibrated' }]}
					metrics={[
						{ label: 'studios building', value: '2,450+', helper: 'Indie to AAA teams' },
						{ label: 'deploy speed', value: '3 min', helper: 'from idea to hero' },
						{ label: 'global uptime', value: '99.99%', helper: 'multi-region edge' },
					]}
				/>

				<section id="platform" className="py-5 bg-white border-top border-bottom">
					<div className="container py-4">
						<PinnedFeatureShowcase
							eyebrow="Workflow platform"
							title="Keep your launch story anchored while details scroll by"
							description="Pin a cinematic overview beside expandable feature callouts. PinnedFeatureShowcase handles the layout so teams can focus on narrative, not CSS hacks."
							imageSrc="https://i.ibb.co/5Mv6bc0/wgc-workflow.jpg"
							imageAlt="Creative team collaborating inside workflow dashboards"
							ctas={<Button variant="primary" size="large" label="Preview templates" />}
							items={pinnedFeatureShowcaseItems}
						/>
					</div>
				</section>

				<section id="features" className="py-5 py-lg-6">
					<div className="container py-4">
						<div className="row mb-5 text-center">
							<div className="col-lg-8 mx-auto">
								<h2 className="fw-bold mb-3">Tailored for modern launches</h2>
								<p className="text-muted">
									Pair CoolNav with your hero, sections, and calls to action. It stays readable,
									compact, and on-brand across devices.
								</p>
							</div>
						</div>
						<div className="row g-4">
							<div className="col-md-4">
								<Card>
									<div className="p-4">
										<h3 className="h5 fw-semibold mb-3">Scroll-aware</h3>
										<p className="text-muted mb-0">
											Automatically adds blur, shadow, and size adjustments to spotlight your
											content while keeping navigation handy.
										</p>
									</div>
								</Card>
							</div>
							<div className="col-md-4">
								<Card>
									<div className="p-4">
										<h3 className="h5 fw-semibold mb-3">Mobile-ready</h3>
										<p className="text-muted mb-0">
											Built on Bootstrap NAV UI patterns with a collapsible menu, accessible
											toggles, and roomy tap targets.
										</p>
									</div>
								</Card>
							</div>
							<div className="col-md-4">
								<Card>
									<div className="p-4">
										<h3 className="h5 fw-semibold mb-3">Plug and play</h3>
										<p className="text-muted mb-0">
											Pass your brand component and navigation items, choose a CTA, and you are
											ready to publish.
										</p>
									</div>
								</Card>
							</div>
						</div>
					</div>
				</section>

				<section id="showcase" className="py-5 bg-white border-top border-bottom">
					<div className="container py-4">
						<div className="row g-4 align-items-center">
							<div className="col-lg-6">
								<div className="border rounded-3 p-4 shadow-sm bg-light">
									<h3 className="h5 fw-semibold mb-3">Blend with any theme</h3>
									<p className="text-muted mb-0">
										CoolNav respects your palette. Switch to dark mode, adjust background classes,
										or drop in gradients using utility classes.
									</p>
								</div>
							</div>
							<div className="col-lg-6">
								<div className="border rounded-3 p-4 shadow-sm bg-light">
									<h3 className="h5 fw-semibold mb-3">Flexible alignment</h3>
									<p className="text-muted mb-0">
										Keep key links centered and highlight your primary call to action on the right
										with a bold, branded button.
									</p>
								</div>
							</div>
						</div>
					</div>
				</section>

				<section id="pricing" className="py-5 py-lg-6">
					<div className="container py-4">
						<div className="row mb-5 text-center">
							<div className="col-lg-8 mx-auto">
								<h2 className="fw-bold mb-3">Launch-ready bundles</h2>
								<p className="text-muted">
									Simple options to match your marketing timeline. Upgrade anytime as your audience
									grows.
								</p>
							</div>
						</div>
						<div className="row g-4">
							{pricingPlans.map((plan) => (
								<div className="col-md-3" key={plan.name}>
									<PricingCard {...plan} />
								</div>
							))}
						</div>
					</div>
				</section>

				<section id="changelog" className="py-5 bg-light border-top">
					<div className="container py-4">
						<Changelog entries={changelogEntries} readMoreHref="#changelog-full" maxVisible={4} />
					</div>
				</section>

				<section id="cta" className="py-5 bg-light">
					<div className="container py-4">
						<div className="row mb-4">
							<div className="col-lg-8">
								<h2 className="fw-bold mb-3">Get on the early access list</h2>
								<p className="mb-0 text-muted">
									Sign up now to be notified the moment WEBGAME.CLOUD launches and claim early adopter
									perks.
								</p>
							</div>
						</div>
						<EarlySignupForm
							className="bg-white border-0 shadow-sm"
							benefits={[
								'Lock in early adopter pricing when we launch.',
								'Be invited to the first closed beta tests.',
								'Help shape the roadmap with direct feedback loops.',
							]}
							helperText="You will get a single email as soon as the platform is launched. No spam, ever."
						/>
					</div>
				</section>
			</main>
			<PageFooter
				menus={footerMenus}
				socialLinks={footerSocialLinks}
				legalLinks={footerLegalLinks}
				legalText="(c) 2026 Webgame Cloud. All rights reserved."
			/>
		</div>
	)
}
