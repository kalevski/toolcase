import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const basicRules = [
    {
        icon: 'Star',
        title: 'First contribution',
        description: 'Submit your first accepted pull request to any public repository.',
        points: '+100',
        suffix: 'pts',
    },
    {
        icon: 'GitPullRequest',
        title: 'Pull request merged',
        description: 'Earn points for each pull request that gets merged.',
        points: '+25',
        suffix: 'pts',
    },
    {
        icon: 'MessageCircle',
        title: 'Issue comment',
        description: 'Leave a helpful comment on an open issue.',
        points: '+5',
        suffix: 'pts',
    },
    {
        icon: 'BookOpen',
        title: 'Documentation update',
        description: 'Improve or extend the project documentation.',
        points: '+15',
        suffix: 'pts',
    },
]

const accentRules = [
    {
        icon: 'Trophy',
        title: 'Top contributor badge',
        description: 'Rank in the top 3 contributors for the month.',
        points: '+500',
        suffix: 'pts',
        accent: 'yellow' as const,
    },
    {
        icon: 'Shield',
        title: 'Security fix',
        description: 'Report or patch a confirmed security vulnerability.',
        points: '+200',
        suffix: 'pts',
        accent: 'red' as const,
    },
    {
        icon: 'Zap',
        title: 'Performance improvement',
        description: 'Measurable speed or memory improvement merged to main.',
        points: '+75',
        suffix: 'pts',
        accent: 'cyan' as const,
    },
    {
        icon: 'Leaf',
        title: 'Bug squashed',
        description: 'Fix a confirmed bug with a reproducible test case.',
        points: '+50',
        suffix: 'pts',
        accent: 'green' as const,
    },
    {
        icon: 'Heart',
        title: 'Community support',
        description: 'Answer a question in the forum that gets marked as solved.',
        points: '+10',
        suffix: 'pts',
        accent: 'pink' as const,
    },
]

const noIconRules = [
    {
        title: 'Daily login',
        description: 'Log in on any day to maintain your streak.',
        points: '+1',
        suffix: 'pt',
    },
    {
        title: 'Weekly streak (7 days)',
        description: 'Log in every day for 7 consecutive days.',
        points: '+10',
        suffix: 'pts',
    },
    {
        title: 'Monthly streak (30 days)',
        description: 'Maintain a daily login streak for 30 days.',
        points: '+50',
        suffix: 'pts',
    },
]

const ScoringRulesDemo: React.FC = () => {
    const basicRef = useTc<HTMLElement>({ rules: basicRules })
    const accentRef = useTc<HTMLElement>({ rules: accentRules })
    const noIconRef = useTc<HTMLElement>({ rules: noIconRules })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ScoringRules"
                            description="Presentational list of scoring rules with optional icons, titles, descriptions, point values, and accent color markers. Set rules via the rules JS property."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic rules (with icons)">
                                <div style={{ maxWidth: 560 }}>
                                    {/* @ts-ignore */}
                                    <tc-scoring-rules ref={basicRef} />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Accent color markers">
                                <div style={{ maxWidth: 560 }}>
                                    {/* @ts-ignore */}
                                    <tc-scoring-rules ref={accentRef} />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="No icons">
                                <div style={{ maxWidth: 560 }}>
                                    {/* @ts-ignore */}
                                    <tc-scoring-rules ref={noIconRef} />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ScoringRulesDemo
