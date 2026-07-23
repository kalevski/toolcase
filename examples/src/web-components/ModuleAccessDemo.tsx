import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'
import type {
    ModuleAccessRole,
    ModuleAccessRoleDraft,
    ModuleAccessLimitableResource,
} from '@toolcase/web-components'

const PERMISSIONS: string[] = [
    'admin.settings.read',
    'admin.settings.write',
    'admin.access.read',
    'admin.access.write',
    'admin.billing.read',
    'project.create',
    'project.read',
    'project.update',
    'project.delete',
    'project.archive',
    'task.create',
    'task.read',
    'task.update',
    'task.delete',
    'task.assign',
    'moderation.review',
    'moderation.suspend',
    'moderation.ban',
]

const LIMITABLE_RESOURCES: ModuleAccessLimitableResource[] = [
    { key: 'projects', label: 'Projects' },
    { key: 'tasks', label: 'Tasks per project' },
]

const ROLES: ModuleAccessRole[] = [
    {
        id: 'owner',
        name: 'Owner',
        builtin: true,
        permissions: [...PERMISSIONS],
    },
    {
        id: 'admin',
        name: 'Admin',
        builtin: true,
        permissions: PERMISSIONS.filter((p) => !p.startsWith('admin.billing')),
        limits: { projects: 50, tasks: 500 },
    },
    {
        id: 'member',
        name: 'Member',
        permissions: [
            'project.read',
            'project.update',
            'task.create',
            'task.read',
            'task.update',
            'task.assign',
        ],
        limits: { projects: 5, tasks: 100 },
    },
]

const ModuleAccessDemo: React.FC = () => {
    const [roleId, setRoleId] = useState('admin')
    const [role, setRole] = useState<ModuleAccessRole>(ROLES.find((r) => r.id === roleId)!)
    const [log, setLog] = useState<string[]>([])

    const changeRole = (id: string) => {
        setRoleId(id)
        setRole(ROLES.find((r) => r.id === id)!)
    }

    const accessRef = useTc<HTMLElement>(
        { roleData: role, permissions: PERMISSIONS, limitableResources: LIMITABLE_RESOURCES },
        {
            'tc-change': (e: Event) => {
                const draft = (e as CustomEvent).detail.role as ModuleAccessRoleDraft
                setLog((prev) =>
                    [
                        `${draft.name}: ${draft.permissions.length} permissions granted`,
                        ...prev,
                    ].slice(0, 6),
                )
            },
        },
    )

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Module Access"
                            description="A single role's live permission editor — name, quota limits, and the permission catalog grouped by domain prefix into toggle-chip cards. No role picker, no footer: every edit fires tc-change immediately with the full draft, and the host owns persistence and any surrounding navigation entirely."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Interactive">
                                <div className="d-flex align-items-center gap-2 mb-3">
                                    <label className="small text-muted">Editing role:</label>
                                    <select
                                        className="form-select form-select-sm"
                                        style={{ maxWidth: '12rem' }}
                                        value={roleId}
                                        onChange={(e) => changeRole(e.target.value)}
                                    >
                                        {ROLES.map((r) => (
                                            <option key={r.id} value={r.id}>
                                                {r.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* @ts-ignore */}
                                <tc-module-access ref={accessRef} owner-role-id="owner" />

                                {log.length > 0 && (
                                    <div className="mt-3 small text-muted font-monospace">
                                        {log.map((line, i) => (
                                            <div key={i}>{line}</div>
                                        ))}
                                    </div>
                                )}
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ModuleAccessDemo
