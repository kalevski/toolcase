import { TasksClient } from '@/components/project/TasksClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { project: string } }): Metadata {
    return { title: `Tasks · ${params.project}` }
}

export default function RepoTasksPage() {
    return <TasksClient />
}
