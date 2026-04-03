import React, { useState } from 'react'
import { DatePicker, Card, CodeSnippet } from '../../src'

const DatePickerDemo: React.FC = () => {
	const [date, setDate] = useState('2025-01-15')

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">DatePicker</h1>
					<p className="text-muted mb-0">A labeled date input with min/max constraints and disabled state.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Basic</h2>
						<div className="d-flex flex-column gap-3">
							<DatePicker label="Release Date" value={date} onChange={setDate} />
							<p className="text-muted mb-0" style={{ fontSize: '0.8rem' }}>Selected: {date}</p>
						</div>
					</Card>
				</div>
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">With Min/Max</h2>
						<DatePicker
							label="Event Date"
							min="2025-01-01"
							max="2025-12-31"
							value="2025-06-15"
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Disabled</h2>
						<DatePicker label="Locked Date" value="2025-03-01" disabled />
					</Card>
				</div>
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Without Label</h2>
						<DatePicker value="2025-07-04" />
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
							code={`import { DatePicker } from '@webgame-cloud/react-components'

<DatePicker label="Start Date" value={date} onChange={setDate} />`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default DatePickerDemo
