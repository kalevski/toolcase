import React, { useState } from 'react'
import {
	DatePicker,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const DatePickerDemo: React.FC = () => {
	const [date, setDate] = useState('2025-01-15')

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="DatePicker"
				description="A labeled date input with min/max constraints and disabled state."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Basic">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<DatePicker label="Release Date" value={date} onChange={setDate} />
					<p className="text-muted mb-0" style={{ fontSize: '0.8rem' }}>Selected: {date}</p>
				</div>
			</SectionCard>

			<SectionCard title="With Min/Max">
				<DatePicker
					label="Event Date"
					min="2025-01-01"
					max="2025-12-31"
					value="2025-06-15"
				/>
			</SectionCard>

			<SectionCard title="Disabled">
				<DatePicker label="Locked Date" value="2025-03-01" disabled />
			</SectionCard>

			<SectionCard title="Without Label">
				<DatePicker value="2025-07-04" />
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default DatePickerDemo
