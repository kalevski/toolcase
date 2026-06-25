import { CreateSiteWizard } from './CreateSiteWizard'

// Dashboard content region (§14). The site list and quota panels arrive with the
// site-dashboard task (734); for now the home surface hosts the create-site wizard
// (733) so a signed-in user can publish their first static site end-to-end.
export function DashboardHome() {
    return (
        <section className="perch-home">
            <header className="perch-home-header">
                <h1 className="perch-home-title">Create a site</h1>
                <p className="perch-home-lead">
                    Publish a branch of one of your GitHub repositories as a static website. Pick the
                    repository and branch, choose a hostname, and Perch deploys it.
                </p>
            </header>
            <CreateSiteWizard />
        </section>
    )
}
