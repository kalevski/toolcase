import type { FC, HTMLAttributes, ReactNode } from 'react'

export interface TeamMember {
	initials: string
	email: ReactNode
	role: ReactNode
	gradient?: [string, string]
}

export interface TeamListProps extends HTMLAttributes<HTMLDivElement> {
	members: TeamMember[]
}

export const TeamList: FC<TeamListProps> = ({ members, className, ...rest }) => {
	const rootClassName = ['component', 'component-team-list', className].filter(Boolean).join(' ')
	return (
		<div className={rootClassName} {...rest}>
			{members.map((member, index) => {
				const gradient = member.gradient
					? `linear-gradient(135deg, ${member.gradient[0]}, ${member.gradient[1]})`
					: undefined
				return (
					<div key={index} className="component-team-list__row">
						<span
							className="component-team-list__avatar"
							style={gradient ? { background: gradient } : undefined}
							aria-hidden="true"
						>
							{member.initials}
						</span>
						<span className="component-team-list__email">{member.email}</span>
						<span className="component-team-list__role">{member.role}</span>
					</div>
				)
			})}
		</div>
	)
}

TeamList.displayName = 'TeamList'
