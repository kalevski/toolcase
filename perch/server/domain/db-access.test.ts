import { describe, it, expect } from 'vitest'
import { grantPlan, classifyPrivileges } from '@/server/domain/db-access'

describe('grantPlan (postgres)', () => {
    it('emits a full reset for none', () => {
        expect(grantPlan('postgres', 'app_ro', 'shop', 'none')).toEqual({
            admin: ['REVOKE ALL ON DATABASE "shop" FROM "app_ro"'],
            target: [
                'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "app_ro"',
                'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM "app_ro"',
                'REVOKE ALL ON SCHEMA public FROM "app_ro"',
                'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM "app_ro"',
                'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM "app_ro"',
            ],
        })
    })

    it('emits reset + read-only grants for read', () => {
        const plan = grantPlan('postgres', 'app_ro', 'shop', 'read')
        expect(plan.admin).toEqual([
            'REVOKE ALL ON DATABASE "shop" FROM "app_ro"',
            'GRANT CONNECT ON DATABASE "shop" TO "app_ro"',
        ])
        expect(plan.target.slice(5)).toEqual([
            'GRANT USAGE ON SCHEMA public TO "app_ro"',
            'GRANT SELECT ON ALL TABLES IN SCHEMA public TO "app_ro"',
            'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO "app_ro"',
        ])
    })

    it('emits DML + sequence + temp grants for readwrite', () => {
        const plan = grantPlan('postgres', 'app_rw', 'shop', 'readwrite')
        expect(plan.admin).toContain('GRANT CONNECT, TEMPORARY ON DATABASE "shop" TO "app_rw"')
        expect(plan.target).toContain(
            'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "app_rw"',
        )
        expect(plan.target).toContain(
            'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "app_rw"',
        )
        expect(plan.target).toContain(
            'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "app_rw"',
        )
    })

    it('emits GRANT ALL for owner and never transfers catalog ownership', () => {
        const plan = grantPlan('postgres', 'boss', 'shop', 'owner')
        expect(plan.admin).toContain('GRANT ALL PRIVILEGES ON DATABASE "shop" TO "boss"')
        expect(plan.target).toContain('GRANT ALL ON ALL TABLES IN SCHEMA public TO "boss"')
        const all = [...plan.admin, ...plan.target].join('\n')
        expect(all).not.toContain('OWNER TO')
    })
})

describe('grantPlan (mysql)', () => {
    it('emits a reset revoke first, then nothing for none', () => {
        expect(grantPlan('mysql', 'svc', 'shop', 'none')).toEqual({
            admin: ["REVOKE ALL PRIVILEGES ON `shop`.* FROM 'svc'@'%'"],
            target: [],
        })
    })

    it('emits SELECT, SHOW VIEW for read', () => {
        expect(grantPlan('mysql', 'svc', 'shop', 'read').admin[1]).toBe(
            "GRANT SELECT, SHOW VIEW ON `shop`.* TO 'svc'@'%'",
        )
    })

    it('emits the DML set for readwrite', () => {
        expect(grantPlan('mysql', 'svc', 'shop', 'readwrite').admin[1]).toBe(
            "GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE, SHOW VIEW, CREATE TEMPORARY TABLES ON `shop`.* TO 'svc'@'%'",
        )
    })

    it('emits ALL PRIVILEGES for owner and honours a custom host', () => {
        expect(grantPlan('mysql', 'svc', 'shop', 'owner', '10.0.0.5').admin).toEqual([
            "REVOKE ALL PRIVILEGES ON `shop`.* FROM 'svc'@'10.0.0.5'",
            "GRANT ALL PRIVILEGES ON `shop`.* TO 'svc'@'10.0.0.5'",
        ])
    })

    it('never runs target-connection statements on mysql', () => {
        for (const level of ['none', 'read', 'readwrite', 'owner'] as const) {
            expect(grantPlan('mysql', 'svc', 'shop', level).target).toEqual([])
        }
    })
})

describe('classifyPrivileges (postgres)', () => {
    it('classifies the canonical level snapshots', () => {
        expect(classifyPrivileges('postgres', { connect: false, privs: [] })).toBe('none')
        expect(classifyPrivileges('postgres', { connect: true, privs: ['SELECT'] })).toBe('read')
        expect(
            classifyPrivileges('postgres', {
                connect: true,
                privs: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
            }),
        ).toBe('readwrite')
        expect(
            classifyPrivileges('postgres', {
                connect: true,
                privs: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'],
            }),
        ).toBe('owner')
    })

    it('treats catalog ownership as owner regardless of table privs', () => {
        expect(classifyPrivileges('postgres', { connect: true, privs: [], isOwner: true })).toBe(
            'owner',
        )
    })

    it('falls back to default privileges when the db has no tables yet', () => {
        expect(
            classifyPrivileges('postgres', { connect: true, privs: [], defaultPrivs: ['SELECT'] }),
        ).toBe('read')
    })

    it('reports anything off-pattern as custom', () => {
        expect(classifyPrivileges('postgres', { connect: true, privs: ['INSERT'] })).toBe('custom')
        expect(classifyPrivileges('postgres', { connect: true, privs: [] })).toBe('custom')
        expect(classifyPrivileges('postgres', { connect: false, privs: ['SELECT'] })).toBe('custom')
        // postgres 17 GRANT ALL adds MAINTAIN — still a superset, still owner
        expect(
            classifyPrivileges('postgres', {
                connect: true,
                privs: [
                    'SELECT',
                    'INSERT',
                    'UPDATE',
                    'DELETE',
                    'TRUNCATE',
                    'REFERENCES',
                    'TRIGGER',
                    'MAINTAIN',
                ],
            }),
        ).toBe('owner')
    })

    it('is case-insensitive on privilege names', () => {
        expect(classifyPrivileges('postgres', { connect: true, privs: ['select'] })).toBe('read')
    })
})

describe('classifyPrivileges (mysql)', () => {
    it('classifies the canonical level snapshots', () => {
        expect(classifyPrivileges('mysql', { connect: false, privs: [] })).toBe('none')
        expect(classifyPrivileges('mysql', { connect: true, privs: ['SELECT', 'SHOW VIEW'] })).toBe(
            'read',
        )
        expect(
            classifyPrivileges('mysql', {
                connect: true,
                privs: [
                    'SELECT',
                    'INSERT',
                    'UPDATE',
                    'DELETE',
                    'EXECUTE',
                    'SHOW VIEW',
                    'CREATE TEMPORARY TABLES',
                ],
            }),
        ).toBe('readwrite')
        expect(classifyPrivileges('mysql', { connect: true, privs: ['ALL PRIVILEGES'] })).toBe(
            'owner',
        )
    })

    it('reports partial/odd sets as custom', () => {
        expect(classifyPrivileges('mysql', { connect: true, privs: ['SELECT'] })).toBe('custom')
        expect(classifyPrivileges('mysql', { connect: true, privs: ['SELECT', 'DROP'] })).toBe(
            'custom',
        )
    })
})
