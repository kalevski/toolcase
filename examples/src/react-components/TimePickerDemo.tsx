import React, { useState } from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	TimePicker
} from '@toolcase/react-components'

export const TimePickerDemo: React.FC = () => {
	const [time24, setTime24] = useState('')
	const [time12, setTime12] = useState('')
	const [timeSec, setTimeSec] = useState('')

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="TimePicker"
				description="Dropdown-based time picker with 12h/24h format and optional seconds."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="24-hour format">
				<TimePicker
					label="Start time"
					value={time24}
					onChange={setTime24}
					format="24h"
					clearable
				/>
				<p style={{ color: '#64748b', marginTop: 8, marginBottom: 0, fontSize: '0.85rem' }}>Value: {time24 || '—'}</p>
			</SectionCard>

			<SectionCard title="12-hour format (AM/PM)">
				<TimePicker
					label="Meeting time"
					value={time12}
					onChange={setTime12}
					format="12h"
					minuteStep={15}
					clearable
				/>
			</SectionCard>

			<SectionCard title="With seconds">
				<TimePicker
					label="Precise time"
					value={timeSec}
					onChange={setTimeSec}
					format="24h"
					showSeconds
					minuteStep={1}
				/>
			</SectionCard>

			<SectionCard title="Error state">
				<TimePicker
					label="End time"
					value="09:00"
					onChange={() => {}}
					error="End time must be after start time."
				/>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}
