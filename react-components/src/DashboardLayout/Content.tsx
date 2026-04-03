export interface ContentProps {
	children: React.ReactNode
}

export const Content: React.FC<ContentProps> = ({ children }) => {
	return <main className="layout--dashboard__content">{children}</main>
}
