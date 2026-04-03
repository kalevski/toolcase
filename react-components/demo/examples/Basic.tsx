import React from 'react'
import { Alert, Badge, Button, Card, CoolButton, Icon, ProgressBar } from '../../src'

const Theme: React.FC = () => (
	<div className="container my-5">
		<div className="row">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-4">Styleguide & Basic components</h1>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<h2 className="h3 mb-4">Enhanced Buttons</h2>
				<div className="d-flex flex-wrap gap-3 mb-4">
					<Button label="primary" variant="primary" />
					<Button label="secondary" variant="secondary" />
					<Button label="success" variant="success" />
					<Button label="info" variant="info" />
					<Button label="warning" variant="warning" />
					<Button label="danger" variant="danger" />
				</div>
				<div className="d-flex flex-wrap gap-3 mb-4">
					<Button label="primary" variant="primary" outline />
					<Button label="secondary" variant="secondary" outline />
					<Button label="success" variant="success" outline />
					<Button label="info" variant="info" outline />
					<Button label="warning" variant="warning" outline />
					<Button label="danger" variant="danger" outline />
				</div>
				<div className="d-flex flex-wrap gap-3 mb-4">
					<Button label="small" size="small" />
					<Button label="default" />
					<Button label="large" size="large" />
				</div>
				<div className="d-flex flex-wrap gap-3">
					<CoolButton label="With Addon" addon={<Icon name="star-fill" decorative />} />
					<CoolButton label="Left Addon" addon={<Icon name="heart-fill" decorative />} addonPosition="left" />
					<CoolButton
						variant="danger"
						label="Danger Button"
						addon={<Icon name="exclamation-triangle-fill" decorative />}
					/>
					<CoolButton
						variant="success"
						size="large"
						label="Large Success"
						addon={<Icon name="emoji-smile-fill" decorative />}
						addonPosition="left"
						showSeparator
					/>
				</div>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<h2 className="h3 mb-4">Bootstrap Icons</h2>
				<div className="d-flex flex-wrap align-items-center gap-4">
					<div className="text-center">
						<Icon name="bi bi-0-circle" size={36} decorative />
						<div className="small text-muted mt-2">Circle</div>
					</div>
					<div className="text-center">
						<Icon name="bar-chart" size={36} color="#0d6efd" decorative />
						<div className="small text-muted mt-2">Bar Chart</div>
					</div>
					<div className="text-center">
						<Icon name="emoji-smile" size={36} color="#198754" label="Smiling" />
						<div className="small text-muted mt-2">Accessible</div>
					</div>
					<div className="text-center">
						<Icon name="moon-stars" size={40} color="#6f42c1" decorative />
						<div className="small text-muted mt-2">Themed</div>
					</div>
				</div>
			</div>
		</div>
		<div className="row mb-5">
			<div className="col-12">
				<h2 className="h3 mb-4">Cards</h2>
				<div className="row g-4">
					<div className="col-md-4">
						<Card header={<h5 className="card-title">Basic Card</h5>}>
							<p className="card-text">
								This is a basic card with the new design. Notice the subtle shadows and modern border
								radius.
							</p>
							<a href="#" className="btn btn-primary">
								Learn More
							</a>
						</Card>
					</div>
					<div className="col-md-4">
						<Card>
							<h5 className="card-title">Stats Card</h5>
							<p className="card-text mb-3">Perfect for dashboard metrics and KPIs.</p>
							<div className="row text-center">
								<div className="col">
									<div className="h4 text-primary mb-0">1,234</div>
									<small className="text-muted">Users</small>
								</div>
								<div className="col">
									<div className="h4 text-success mb-0">56.7%</div>
									<small className="text-muted">Growth</small>
								</div>
							</div>
						</Card>
					</div>
					<div className="col-md-4">
						<Card variant="primary">
							<h5 className="card-title">Gradient Card</h5>
							<p className="card-text">
								Beautiful gradient backgrounds with perfect contrast ratios for accessibility.
							</p>
							<a href="#" className="btn btn-light">
								Action
							</a>
						</Card>
					</div>
				</div>
			</div>
		</div>
		<div className="row mb-5">
			<div className="col-12">
				<h2 className="h3 mb-4">Enhanced Alerts</h2>
				<Alert variant="primary">
					<strong>Primary alert!</strong> This is an enhanced alert with gradient background and modern
					styling.
				</Alert>
				<Alert variant="success">
					<strong>Success!</strong> Your action was completed successfully.
				</Alert>
				<Alert variant="warning">
					<strong>Warning!</strong> Please review the information before proceeding.
				</Alert>
				<Alert variant="danger">
					<strong>Error!</strong> Something went wrong. Please try again.
				</Alert>
				<Alert variant="info" dismissible onClose={() => alert('Alert closed!')}>
					This is a dismissible info alert using the Alert component.
				</Alert>
			</div>
		</div>
		<div className="row mb-5">
			<div className="col-md-6">
				<h2 className="h4 mb-4">Badges</h2>
				<div className="d-flex flex-wrap gap-2 mb-3">
					<Badge label="Primary" variant="primary" />
					<Badge label="Secondary" variant="secondary" />
					<Badge label="Success" variant="success" />
					<Badge label="Danger" variant="danger" />
					<Badge label="Warning" variant="warning" />
					<Badge label="Info" variant="info" />
				</div>
			</div>
			<div className="col-md-6">
				<h2 className="h4 mb-4">Enhanced Progress Bars</h2>
				<ProgressBar value={45} variant="warning" height={8} />
				<ProgressBar label="Complete" value={100} variant="warning" height={8} />
			</div>
		</div>
	</div>
)

export default Theme
