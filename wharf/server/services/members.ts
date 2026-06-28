// Project membership service (planning §2.2, §10). Owner-only management of who
// belongs to a project and at what project role.

import 'server-only'
import * as memberRepo from '@/server/data/repositories/project-member-repo'
import * as userRepo from '@/server/data/repositories/user-repo'
import * as projectRepo from '@/server/data/repositories/project-repo'
import { ID } from '@/server/infrastructure/ids'
import type { ProjectMember, ProjectMemberRow, ProjectRole } from '@/server/domain/types'

export class MemberExistsError extends Error {}
export class UserNotFoundError extends Error {}
export class ProjectNotFoundError extends Error {}

export function listMembers(projectId: string): ProjectMemberRow[] {
    return memberRepo.listByProject(projectId)
}

/** Grant a user (who must already have signed in) a role on a project. */
export function addMember(
    projectId: string,
    githubId: number,
    role: ProjectRole,
    grantedBy: number,
): ProjectMember {
    if (!projectRepo.byId(projectId)) throw new ProjectNotFoundError()
    if (!userRepo.get(githubId)) throw new UserNotFoundError()
    if (memberRepo.getMembership(projectId, githubId)) throw new MemberExistsError()
    const member: ProjectMember = {
        id: ID.member(),
        projectId,
        githubId,
        projectRole: role,
        grantedBy,
        grantedAt: new Date().toISOString(),
    }
    memberRepo.insert(member)
    return member
}

export function updateMemberRole(projectId: string, githubId: number, role: ProjectRole): void {
    if (!memberRepo.getMembership(projectId, githubId)) throw new UserNotFoundError()
    memberRepo.updateRole(projectId, githubId, role)
}

export function removeMember(projectId: string, githubId: number): void {
    memberRepo.remove(projectId, githubId)
}
