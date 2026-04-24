import { DashboardLayout } from '@toolcase/react-components'
import { Forms } from './Forms'

export const DashboardLayoutExample = () => {
	return (
		<DashboardLayout
			brandComponent={
				<>
					WEBGAME.<span>CLOUD</span>
				</>
			}
		>
			<Forms />
		</DashboardLayout>
	)
}
