import {
	Button,
	Checkbox,
	CheckboxGroup,
	Input,
	Radio,
	RadioGroup,
	Select,
	DatePicker,
	TagInput,
	Card,
	Form,
	Textarea,
} from '../../src'
import { ColorPicker, IconPicker } from '../../src'
import { useState } from 'react'

export const Forms = () => {
	const [interests, setInterests] = useState<string[]>([])
	const [preferences, setPreferences] = useState<string[]>(['notifications'])
	const [gender, setGender] = useState<string>('')

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Form Components</h1>
					<p className="text-muted mb-4">A comprehensive showcase of all form input components: Input, Select, DatePicker, ColorPicker, IconPicker, RadioGroup, CheckboxGroup, TagInput, Textarea, and Checkbox.</p>
				</div>
			</div>
			<div className="row mb-5">
				<div className="col-md-8">
					<Form onSubmit={(data) => console.log(data)}>
						<div className="row g-3">
							<div className="col-md-6">
								<Input
									label="First name"
									type="text"
									id="firstName"
									placeholder="Enter first name"
									defaultValue={'test'}
								/>
							</div>
							<div className="col-md-6">
								<Input label="Last name" type="text" id="lastName" placeholder="Enter last name" />
							</div>
							<div className="col-12">
								<Input label="Email Address" type="email" id="email" placeholder="name@example.com" />
							</div>
							<div className="col-md-6">
								<ColorPicker
									label="Favorite Color"
									colors={[
										{ hex: '#4f46e5', label: 'Indigo' },
										{ hex: '#e11d48', label: 'Red' },
										{ hex: '#10b981', label: 'Green' },
										{ hex: '#f59e0b', label: 'Yellow' },
										{ hex: '#3b82f6', label: 'Blue' },
										{ hex: '#8b5cf6', label: 'Purple' },
									]}
									value="#4f46e5"
									onChange={(color) => console.log('Selected color:', color)}
								/>
							</div>
							<div className="col-md-6">
								<IconPicker
									label="Favorite Icon"
									icons={[
										{
											icon: (
												<span role="img" aria-label="star">
													⭐
												</span>
											),
											label: 'Star',
											value: 'star',
										},
										{
											icon: (
												<span role="img" aria-label="heart">
													❤️
												</span>
											),
											label: 'Heart',
											value: 'heart',
										},
										{
											icon: (
												<span role="img" aria-label="rocket">
													🚀
												</span>
											),
											label: 'Rocket',
											value: 'rocket',
										},
										{
											icon: (
												<span role="img" aria-label="fire">
													🔥
												</span>
											),
											label: 'Fire',
											value: 'fire',
										},
										{
											icon: (
												<span role="img" aria-label="check">
													✅
												</span>
											),
											label: 'Check',
											value: 'check',
										},
										{
											icon: (
												<span role="img" aria-label="sun">
													🌞
												</span>
											),
											label: 'Sun',
											value: 'sun',
										},
									]}
									value="star"
									onChange={(icon) => console.log('Selected icon:', icon)}
								/>
							</div>
							<div className="col-md-6">
								<DatePicker
									label="Date of Birth"
									value=""
									onChange={(date) => console.log('Selected date:', date)}
								/>
							</div>
							<div className="col-md-6">
								<Select
									label="Country"
									id="country"
									options={[
										{ value: '', label: 'Choose...' },
										{ value: 'us', label: 'United States' },
										{ value: 'uk', label: 'United Kingdom' },
										{ value: 'ca', label: 'Canada' },
									]}
									className=""
									selectClassName="form-select"
								/>
							</div>
							<div className="col-md-6">
								<Select
									label="State"
									id="state"
									options={[
										{ value: '', label: 'Choose...' },
										{ value: 'ca', label: 'California' },
										{ value: 'ny', label: 'New York' },
										{ value: 'tx', label: 'Texas' },
									]}
									className=""
									selectClassName="form-select"
								/>
							</div>
							<div className="col-12">
								<RadioGroup
									label="Gender"
									name="gender"
									options={[
										{ value: 'male', label: 'Male' },
										{ value: 'female', label: 'Female' },
										{ value: 'other', label: 'Other' },
									]}
									value={gender}
									onChange={setGender}
								/>
							</div>
							<div className="col-12">
								<CheckboxGroup
									label="Interests"
									name="interests"
									inline
									options={[
										{ value: 'sports', label: 'Sports' },
										{ value: 'music', label: 'Music' },
										{ value: 'travel', label: 'Travel' },
									]}
									value={interests}
									onChange={setInterests}
								/>
							</div>
							<div className="col-12">
								<CheckboxGroup
									label="Preferences"
									name="preferences"
									options={[
										{ value: 'notifications', label: 'Receive email notifications' },
										{ value: 'marketing', label: 'Receive marketing emails' },
										{ value: 'updates', label: 'Receive product updates' },
									]}
									value={preferences}
									onChange={setPreferences}
								/>
							</div>
							<div className="col-12">
								<TagInput
									label="Skills / Tags"
									recommendations={[
										'React',
										'TypeScript',
										'Bootstrap',
										'Design',
										'UI',
										'Frontend',
										'Backend',
										'Node.js',
										'SCSS',
									]}
									placeholder="Add a skill or tag..."
									defaultValue={['React', 'TypeScript']}
									allowCreate
									onChange={(tags) => console.log('Selected tags:', tags)}
								/>
							</div>
							<div className="col-12">
								<Textarea
									label="About You"
									id="about"
									rows={3}
									placeholder="Tell us about yourself..."
								/>
							</div>
							<div className="col-12">
								<Checkbox
									id="newsletter"
									label="Subscribe to our newsletter"
									inputClassName="form-check-input"
								/>
							</div>
							<div className="col-12">
								<Button className="me-2" type="submit" variant="primary">
									Submit Form
								</Button>
								<Button type="reset" outline variant="secondary">
									Reset
								</Button>
							</div>
						</div>
					</Form>
				</div>
			</div>
		</div>
	)
}
