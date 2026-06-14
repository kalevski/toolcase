import { Brand } from './Brand'
import { Avatar } from './Avatar'
import { ActionHeader } from './ActionHeader'
import { ActionItems } from './ActionItems'
import { ActionRowList } from './ActionRowList'
import { Theme } from './Theme'
import { Container } from './Container'
import { Row } from './Row'
import { Col } from './Col'
import { Accordion } from './Accordion'
import { AccordionItem } from './AccordionItem'
import { Alert } from './Alert'
import { AnnouncementBar } from './AnnouncementBar'
import { Badge } from './Badge'
import { BadgeRow } from './BadgeRow'
import { Breadcrumb } from './Breadcrumb'
import { BreadcrumbItem } from './BreadcrumbItem'
import { Button } from './Button'
import { ButtonGroup } from './ButtonGroup'
import { Card } from './Card'
import { Carousel } from './Carousel'
import { CloseButton } from './CloseButton'
import { Collapse } from './Collapse'
import { Dropdown } from './Dropdown'
import { DropdownItem } from './DropdownItem'
import { ListGroup } from './ListGroup'
import { ListGroupItem } from './ListGroupItem'
import { Modal } from './Modal'
import { Offcanvas } from './Offcanvas'
import { Nav } from './Nav'
import { NavItem } from './NavItem'
import { Navbar } from './Navbar'
import { Pagination } from './Pagination'
import { Placeholder } from './Placeholder'
import { Popover } from './Popover'
import { Progress } from './Progress'
import { ProgressBar } from './ProgressBar'
import { Scrollspy } from './Scrollspy'
import { Spinner } from './Spinner'
import { Toast } from './Toast'
import { Tooltip } from './Tooltip'
import { Input } from './Input'
import { Textarea } from './Textarea'
import { Select } from './Select'
import { Option } from './Option'
import { Check } from './Check'
import { CheckboxGroup } from './CheckboxGroup'
import { Radio } from './Radio'
import { Switch } from './Switch'
import { Range } from './Range'
import { FloatingLabel } from './FloatingLabel'
import { InputGroup } from './InputGroup'
import { InputGroupText } from './InputGroupText'
import { Divider } from './Divider'
import { Form } from './Form'
import { Heading } from './Heading'
import { HelperText } from './HelperText'
import { Icon } from './Icon'
import { IconButton } from './IconButton'
import { Kbd } from './Kbd'
import { Label } from './Label'
import { Link } from './Link'
import { Spacer } from './Spacer'
import { Text } from './Text'
import { VisuallyHidden } from './VisuallyHidden'
import { PulseIndicator } from './PulseIndicator'
import { SectionFlag } from './SectionFlag'
import { Skeleton } from './Skeleton'
import { SocialLinks } from './SocialLinks'
import { Stamp } from './Stamp'
import { StatusDot } from './StatusDot'
import { Tag } from './Tag'
import { AssetRow } from './AssetRow'
import { AssetRowList } from './AssetRowList'
import { BasicLayout } from './BasicLayout'
import { BriefCard } from './BriefCard'
import { BundleBar } from './BundleBar'
import { CalloutQuote } from './CalloutQuote'
import { ChartContainer } from './ChartContainer'
import { Sparkline } from './Sparkline'
import { TrendIndicator } from './TrendIndicator'
import { CodeLabelCell } from './CodeLabelCell'
import { CodeWithOutput } from './CodeWithOutput'
import { CommunityLinks } from './CommunityLinks'
import { ConfigPreview } from './ConfigPreview'
import { ContributorWall } from './ContributorWall'
import { CookbookGrid } from './CookbookGrid'
import { CoolButton } from './CoolButton'
import { ActivityCard } from './ActivityCard'
import { BasicCard } from './BasicCard'
import { ColoredCard } from './ColoredCard'
import { DifferenceCard } from './DifferenceCard'
import { ListCard } from './ListCard'
import { StatusCard } from './StatusCard'
import { DashboardContent } from './DashboardContent'
import { DownloadStats } from './DownloadStats'
import { EmptyState } from './EmptyState'
import { EntityCell } from './EntityCell'
import { FeatureCard } from './FeatureCard'
import { GoodFirstIssues } from './GoodFirstIssues'
import { HeroStatsBar } from './HeroStatsBar'
import { LeaderboardTrend } from './LeaderboardTrend'
import { LinkedProvidersCard } from './LinkedProvidersCard'
import { LogoCloud } from './LogoCloud'
import { MaintainerCard } from './MaintainerCard'
import { MetricTile } from './MetricTile'
import { MetricGrid } from './MetricGrid'
import { MigrationGuide } from './MigrationGuide'
import { PageFooter } from './PageFooter'
import { PhaseGrid } from './PhaseGrid'
import { PinnedFeatureShowcase } from './PinnedFeatureShowcase'
import { Pipeline } from './Pipeline'
import { PluginGrid } from './PluginGrid'
import { PricingCard } from './PricingCard'
import { QueuedFile } from './QueuedFile'
import { QuickStart } from './QuickStart'
import { RankCell } from './RankCell'
import { RichPageHeader } from './RichPageHeader'
import { ScoringRules } from './ScoringRules'
import { SectionCard } from './SectionCard'
import { SimpleFile } from './SimpleFile'
import { SponsorWall } from './SponsorWall'
import { SprintChain } from './SprintChain'
import { StatCard } from './StatCard'
import { StateMachine } from './StateMachine'
import { Stepper } from './Stepper'
import { TeamList } from './TeamList'
import { TierLadder } from './TierLadder'
import { Timeline } from './Timeline'
import { UsageSummaryPanel } from './UsageSummaryPanel'
import { WelcomeGuide } from './WelcomeGuide'
import { ApiReferenceTable } from './ApiReferenceTable'
import { Banner } from './Banner'
import { Build } from './Build'
import { CardOptions } from './CardOptions'
import { CdnMap } from './CdnMap'
import { Changelog } from './Changelog'
import { Chip } from './Chip'
import { ChipGroup } from './ChipGroup'
import { CodeSnippet } from './CodeSnippet'
import { ColorPicker } from './ColorPicker'
import { CommandReference } from './CommandReference'
import { Comparator } from './Comparator'
import { CompatibilityMatrix } from './CompatibilityMatrix'
import { ContextMenu } from './ContextMenu'
import { CoolNav } from './CoolNav'
import { CountdownTimer } from './CountdownTimer'
import { DangerZoneActions } from './DangerZoneActions'
import { MetricCard } from './MetricCard'
import { SlicesCard } from './SlicesCard'
import { DashboardSidebar } from './DashboardSidebar'
import { DashboardLayout } from './DashboardLayout'
import { DatePicker } from './DatePicker'
import { DiffViewer } from './DiffViewer'
import { Drawer } from './Drawer'
import { EarlySignupForm } from './EarlySignupForm'

export function register(): void {
    if (customElements.get('tc-button') !== undefined) {
        return
    }
    customElements.define('tc-brand', Brand)
    customElements.define('tc-avatar', Avatar)
    customElements.define('tc-action-header', ActionHeader)
    customElements.define('tc-action-items', ActionItems)
    customElements.define('tc-action-row-list', ActionRowList)
    customElements.define('tc-theme', Theme)
    customElements.define('tc-container', Container)
    customElements.define('tc-row', Row)
    customElements.define('tc-col', Col)
    customElements.define('tc-accordion', Accordion)
    customElements.define('tc-accordion-item', AccordionItem)
    customElements.define('tc-alert', Alert)
    customElements.define('tc-announcement-bar', AnnouncementBar)
    customElements.define('tc-badge', Badge)
    customElements.define('tc-badge-row', BadgeRow)
    customElements.define('tc-breadcrumb', Breadcrumb)
    customElements.define('tc-breadcrumb-item', BreadcrumbItem)
    customElements.define('tc-button', Button)
    customElements.define('tc-button-group', ButtonGroup)
    customElements.define('tc-card', Card)
    customElements.define('tc-carousel', Carousel)
    customElements.define('tc-close-button', CloseButton)
    customElements.define('tc-collapse', Collapse)
    customElements.define('tc-dropdown', Dropdown)
    customElements.define('tc-dropdown-item', DropdownItem)
    customElements.define('tc-list-group', ListGroup)
    customElements.define('tc-list-group-item', ListGroupItem)
    customElements.define('tc-modal', Modal)
    // Cast: tc-offcanvas's boolean `scroll` accessor intentionally shadows
    // HTMLElement.scroll(), which breaks structural assignability.
    customElements.define('tc-offcanvas', Offcanvas as unknown as CustomElementConstructor)
    customElements.define('tc-nav', Nav)
    customElements.define('tc-nav-item', NavItem)
    customElements.define('tc-navbar', Navbar)
    customElements.define('tc-pagination', Pagination)
    customElements.define('tc-placeholder', Placeholder)
    customElements.define('tc-popover', Popover)
    customElements.define('tc-progress', Progress)
    customElements.define('tc-progress-bar', ProgressBar)
    customElements.define('tc-scrollspy', Scrollspy)
    customElements.define('tc-spinner', Spinner)
    customElements.define('tc-toast', Toast)
    customElements.define('tc-tooltip', Tooltip)
    customElements.define('tc-input', Input)
    customElements.define('tc-textarea', Textarea)
    customElements.define('tc-select', Select)
    customElements.define('tc-option', Option)
    customElements.define('tc-check', Check)
    customElements.define('tc-checkbox-group', CheckboxGroup)
    customElements.define('tc-radio', Radio)
    customElements.define('tc-switch', Switch)
    customElements.define('tc-range', Range)
    customElements.define('tc-floating-label', FloatingLabel)
    customElements.define('tc-input-group', InputGroup)
    customElements.define('tc-input-group-text', InputGroupText)
    customElements.define('tc-form', Form)
    customElements.define('tc-divider', Divider)
    customElements.define('tc-heading', Heading)
    customElements.define('tc-helper-text', HelperText)
    customElements.define('tc-icon', Icon)
    customElements.define('tc-icon-button', IconButton)
    customElements.define('tc-kbd', Kbd)
    customElements.define('tc-label', Label)
    customElements.define('tc-link', Link)
    customElements.define('tc-spacer', Spacer)
    customElements.define('tc-text', Text)
    customElements.define('tc-visually-hidden', VisuallyHidden)
    customElements.define('tc-pulse-indicator', PulseIndicator)
    customElements.define('tc-section-flag', SectionFlag)
    customElements.define('tc-skeleton', Skeleton)
    customElements.define('tc-social-links', SocialLinks)
    customElements.define('tc-stamp', Stamp)
    customElements.define('tc-status-dot', StatusDot)
    customElements.define('tc-tag', Tag)
    customElements.define('tc-asset-row', AssetRow)
    customElements.define('tc-asset-row-list', AssetRowList)
    customElements.define('tc-basic-layout', BasicLayout)
    customElements.define('tc-brief-card', BriefCard)
    customElements.define('tc-bundle-bar', BundleBar)
    customElements.define('tc-callout-quote', CalloutQuote)
    customElements.define('tc-chart-container', ChartContainer)
    customElements.define('tc-sparkline', Sparkline)
    customElements.define('tc-trend-indicator', TrendIndicator)
    customElements.define('tc-code-label-cell', CodeLabelCell)
    customElements.define('tc-code-with-output', CodeWithOutput)
    customElements.define('tc-community-links', CommunityLinks)
    customElements.define('tc-config-preview', ConfigPreview)
    customElements.define('tc-contributor-wall', ContributorWall)
    customElements.define('tc-cookbook-grid', CookbookGrid)
    customElements.define('tc-cool-button', CoolButton)
    customElements.define('tc-activity-card', ActivityCard)
    customElements.define('tc-basic-card', BasicCard)
    customElements.define('tc-colored-card', ColoredCard)
    customElements.define('tc-difference-card', DifferenceCard)
    customElements.define('tc-list-card', ListCard)
    customElements.define('tc-status-card', StatusCard)
    customElements.define('tc-dashboard-content', DashboardContent)
    customElements.define('tc-download-stats', DownloadStats)
    customElements.define('tc-empty-state', EmptyState)
    customElements.define('tc-entity-cell', EntityCell)
    customElements.define('tc-feature-card', FeatureCard)
    customElements.define('tc-good-first-issues', GoodFirstIssues)
    customElements.define('tc-hero-stats-bar', HeroStatsBar)
    customElements.define('tc-leaderboard-trend', LeaderboardTrend)
    customElements.define('tc-linked-providers-card', LinkedProvidersCard)
    customElements.define('tc-logo-cloud', LogoCloud)
    customElements.define('tc-maintainer-card', MaintainerCard)
    customElements.define('tc-metric-tile', MetricTile)
    customElements.define('tc-metric-grid', MetricGrid)
    customElements.define('tc-migration-guide', MigrationGuide)
    customElements.define('tc-page-footer', PageFooter)
    customElements.define('tc-phase-grid', PhaseGrid)
    customElements.define('tc-pinned-feature-showcase', PinnedFeatureShowcase)
    customElements.define('tc-pipeline', Pipeline)
    customElements.define('tc-plugin-grid', PluginGrid)
    customElements.define('tc-pricing-card', PricingCard)
    customElements.define('tc-queued-file', QueuedFile)
    customElements.define('tc-quick-start', QuickStart)
    customElements.define('tc-rank-cell', RankCell)
    customElements.define('tc-rich-page-header', RichPageHeader)
    customElements.define('tc-scoring-rules', ScoringRules)
    customElements.define('tc-section-card', SectionCard)
    customElements.define('tc-simple-file', SimpleFile)
    customElements.define('tc-sponsor-wall', SponsorWall)
    customElements.define('tc-sprint-chain', SprintChain)
    customElements.define('tc-stat-card', StatCard)
    customElements.define('tc-state-machine', StateMachine)
    customElements.define('tc-stepper', Stepper)
    customElements.define('tc-team-list', TeamList)
    customElements.define('tc-tier-ladder', TierLadder)
    customElements.define('tc-timeline', Timeline)
    customElements.define('tc-usage-summary-panel', UsageSummaryPanel)
    customElements.define('tc-welcome-guide', WelcomeGuide)
    customElements.define('tc-api-reference-table', ApiReferenceTable)
    customElements.define('tc-banner', Banner)
    customElements.define('tc-build', Build)
    customElements.define('tc-card-options', CardOptions)
    customElements.define('tc-cdn-map', CdnMap)
    customElements.define('tc-changelog', Changelog)
    customElements.define('tc-chip', Chip)
    customElements.define('tc-chip-group', ChipGroup)
    customElements.define('tc-code-snippet', CodeSnippet)
    customElements.define('tc-color-picker', ColorPicker)
    customElements.define('tc-command-reference', CommandReference)
    customElements.define('tc-comparator', Comparator)
    customElements.define('tc-compatibility-matrix', CompatibilityMatrix)
    customElements.define('tc-context-menu', ContextMenu)
    customElements.define('tc-cool-nav', CoolNav)
    customElements.define('tc-countdown-timer', CountdownTimer)
    customElements.define('tc-danger-zone-actions', DangerZoneActions)
    customElements.define('tc-metric-card', MetricCard)
    customElements.define('tc-slices-card', SlicesCard)
    customElements.define('tc-dashboard-sidebar', DashboardSidebar)
    customElements.define('tc-dashboard-layout', DashboardLayout)
    customElements.define('tc-date-picker', DatePicker)
    customElements.define('tc-diff-viewer', DiffViewer)
    customElements.define('tc-drawer', Drawer)
    customElements.define('tc-early-signup-form', EarlySignupForm)
}
