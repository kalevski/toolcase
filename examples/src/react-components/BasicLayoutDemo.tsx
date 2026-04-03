import React, { useState } from 'react'
import { BasicLayout } from '@toolcase/react-components'
import { Brand } from '@toolcase/react-components'
import { FormWizard, FormWizardStep } from '@toolcase/react-components'
import { Input } from '@toolcase/react-components'
import { Textarea } from '@toolcase/react-components'
import { Select } from '@toolcase/react-components'
import { Card, CodeSnippet } from '@toolcase/react-components'

const BasicLayoutDemo: React.FC = () => {
	const [displayName, setDisplayName] = useState('')
	const [firstName, setFirstName] = useState('')
	const [lastName, setLastName] = useState('')
	const [email, setEmail] = useState('')
	const [bio, setBio] = useState('')
	const [website, setWebsite] = useState('')
	const [timezone, setTimezone] = useState('')
	const [language, setLanguage] = useState('')

	const steps: FormWizardStep[] = [
		{
			key: 'personal',
			label: 'Personal Info',
			canNext: firstName.trim().length > 0 && lastName.trim().length > 0,
			content: (
				<div className="d-flex flex-column gap-3">
					<h5>Personal Information</h5>
					<p className="text-muted small">Tell us a bit about yourself.</p>
					<div className="row g-3">
						<div className="col-md-6">
							<Input
								label="First Name"
								value={firstName}
								onChange={(e) => setFirstName(e.target.value)}
								placeholder="John"
							/>
						</div>
						<div className="col-md-6">
							<Input
								label="Last Name"
								value={lastName}
								onChange={(e) => setLastName(e.target.value)}
								placeholder="Doe"
							/>
						</div>
						<div className="col-12">
							<Input
								label="Display Name"
								value={displayName}
								onChange={(e) => setDisplayName(e.target.value)}
								placeholder="johndoe"
							/>
						</div>
					</div>
				</div>
			),
		},
		{
			key: 'contact',
			label: 'Contact',
			canNext: email.trim().length > 0,
			content: (
				<div className="d-flex flex-column gap-3">
					<h5>Contact Details</h5>
					<p className="text-muted small">How can others reach you?</p>
					<Input
						label="Email"
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="john@example.com"
					/>
					<Input
						label="Website"
						type="url"
						value={website}
						onChange={(e) => setWebsite(e.target.value)}
						placeholder="https://yoursite.com"
					/>
				</div>
			),
		},
		{
			key: 'preferences',
			label: 'Preferences',
			content: (
				<div className="d-flex flex-column gap-3">
					<h5>Preferences</h5>
					<p className="text-muted small">Customize your experience.</p>
					<Select
						label="Timezone"
						value={timezone}
						onChange={(e) => setTimezone(e.target.value)}
						options={[
							{ label: 'Select timezone...', value: '' },
							{ label: 'UTC-8 Pacific', value: 'America/Los_Angeles' },
							{ label: 'UTC-5 Eastern', value: 'America/New_York' },
							{ label: 'UTC+0 London', value: 'Europe/London' },
							{ label: 'UTC+1 Berlin', value: 'Europe/Berlin' },
							{ label: 'UTC+9 Tokyo', value: 'Asia/Tokyo' },
						]}
					/>
					<Select
						label="Language"
						value={language}
						onChange={(e) => setLanguage(e.target.value)}
						options={[
							{ label: 'Select language...', value: '' },
							{ label: 'English', value: 'en' },
							{ label: 'Spanish', value: 'es' },
							{ label: 'German', value: 'de' },
							{ label: 'Japanese', value: 'ja' },
						]}
					/>
					<Textarea
						label="Bio"
						value={bio}
						onChange={(e) => setBio(e.target.value)}
						placeholder="A short bio about yourself..."
						rows={4}
					/>
				</div>
			),
		},
		{
			key: 'review',
			label: 'Review',
			content: (
				<div className="d-flex flex-column gap-3">
					<h5>Review Your Profile</h5>
					<p className="text-muted small">Make sure everything looks good.</p>
					<div className="p-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
						<div className="row g-2" style={{ fontSize: '0.9rem' }}>
							<div className="col-sm-4 fw-semibold">Name</div>
							<div className="col-sm-8">{firstName} {lastName}</div>
							<div className="col-sm-4 fw-semibold">Display Name</div>
							<div className="col-sm-8">{displayName || '—'}</div>
							<div className="col-sm-4 fw-semibold">Email</div>
							<div className="col-sm-8">{email}</div>
							<div className="col-sm-4 fw-semibold">Website</div>
							<div className="col-sm-8">{website || '—'}</div>
							<div className="col-sm-4 fw-semibold">Timezone</div>
							<div className="col-sm-8">{timezone || '—'}</div>
							<div className="col-sm-4 fw-semibold">Language</div>
							<div className="col-sm-8">{language || '—'}</div>
							<div className="col-sm-4 fw-semibold">Bio</div>
							<div className="col-sm-8">{bio || '—'}</div>
						</div>
					</div>
				</div>
			),
		},
	]

	return (
		<BasicLayout
			brand={<Brand primaryText="webgame" secondaryText="cloud" color="#4f46e5" />}
		>
			<div style={{ width: '100%', maxWidth: 640 }}>
				<FormWizard
					steps={steps}
					onComplete={() => alert('Profile saved!')}
					completeLabel="Save Profile"
					completeIcon="bi-check-lg"
				/>
			</div>

			<div style={{ width: '100%', maxWidth: 640, marginTop: '2rem' }}>
				<Card>
					<h2 className="h5 mb-3">Usage</h2>
					<CodeSnippet
						language="typescript"
						code={`import { BasicLayout } from '@webgame-cloud/react-components'

<BasicLayout
  brand={<Brand primaryText="webgame" secondaryText="cloud" />}
>
  <main>Page content</main>
</BasicLayout>`}
					/>
				</Card>
			</div>		</BasicLayout>
	)
}

export default BasicLayoutDemo