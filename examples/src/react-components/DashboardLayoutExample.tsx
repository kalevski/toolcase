import { DashboardLayout, Card, Heading, Text } from '@toolcase/react-components'

export const DashboardLayoutExample = () => {
	return (
		<DashboardLayout
			brandComponent={
				<>
					WEBGAME.<span>CLOUD</span>
				</>
			}
		>
			<div className="container py-4">
				<div className="row g-3">
					<div className="col-12">
						<Card>
							<Heading as="h2">Welcome back</Heading>
							<Text as="p" variant="muted">
								This is placeholder content inside the DashboardLayout chrome. Swap it for any
								page content — forms, tables, charts.
							</Text>
						</Card>
					</div>
				</div>
			</div>
		</DashboardLayout>
	)
}
