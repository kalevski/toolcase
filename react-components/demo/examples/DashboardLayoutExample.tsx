import { DashboardLayout } from '../../src/DashboardLayout'
import { Card, CodeSnippet } from '../../src'
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

			<div className="container mt-5 mb-5">
				<div className="row">
					<div className="col-12">
						<Card>
							<h2 className="h5 mb-3">Usage</h2>
							<CodeSnippet
								language="typescript"
								code={`import { DashboardLayout } from '@webgame-cloud/react-components'

<DashboardLayout
  brandComponent={<>WEBGAME.<span>CLOUD</span></>}
>
  <main>Dashboard content</main>
</DashboardLayout>`}
							/>
						</Card>
					</div>
				</div>
			</div>
		</DashboardLayout>
	)
}
