import React, { useState } from 'react'
import { TimePicker, Card, CodeSnippet } from '@toolcase/react-components'

const usageCode = `import { TimePicker } from '@toolcase/react-components'

const [time, setTime] = useState('09:00')

<TimePicker
  label="Start time"
  value={time}
  onChange={setTime}
  format="12h"
/>`

export const TimePickerDemo: React.FC = () => {
	const [time24, setTime24] = useState('')
	const [time12, setTime12] = useState('')
	const [timeSec, setTimeSec] = useState('')

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">TimePicker</h1>
					<p className="text-muted mb-0">Dropdown-based time picker with 12h/24h format and optional seconds.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-5">
					<Card>
						<h2 className="h5 mb-3">24-hour format</h2>
						<TimePicker
							label="Start time"
							value={time24}
							onChange={setTime24}
							format="24h"
							clearable
						/>
						<p className="text-muted mt-2 mb-0" style={{ fontSize: '0.85rem' }}>Value: {time24 || '—'}</p>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-5">
					<Card>
						<h2 className="h5 mb-3">12-hour format (AM/PM)</h2>
						<TimePicker
							label="Meeting time"
							value={time12}
							onChange={setTime12}
							format="12h"
							minuteStep={15}
							clearable
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-5">
					<Card>
						<h2 className="h5 mb-3">With seconds</h2>
						<TimePicker
							label="Precise time"
							value={timeSec}
							onChange={setTimeSec}
							format="24h"
							showSeconds
							minuteStep={1}
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-5">
					<Card>
						<h2 className="h5 mb-3">Error state</h2>
						<TimePicker
							label="End time"
							value="09:00"
							onChange={() => {}}
							error="End time must be after start time."
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet language="typescript" code={usageCode} />
					</Card>
				</div>
			</div>
		</div>
	)
}
