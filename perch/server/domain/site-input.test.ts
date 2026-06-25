// Unit coverage for the pure site-source input rules (§9, §16). These validate the
// GitHub coordinates and build subdir before a site reaches a git URL, a fragment, or
// the DB; the hostname half is covered by `hostname.test.ts` (§729).

import { describe, it, expect } from 'vitest'
import { checkBranch, checkRepoName, checkRepoOwner, checkSubdir } from './site-input'

describe('checkRepoOwner', () => {
    it('accepts a valid GitHub login, trimming surrounding space', () => {
        expect(checkRepoOwner('alice')).toEqual({ ok: true, value: 'alice' })
        expect(checkRepoOwner('  My-Org  ')).toEqual({ ok: true, value: 'My-Org' })
        expect(checkRepoOwner('a1b2')).toEqual({ ok: true, value: 'a1b2' })
    })

    it('rejects empty, over-long, and bad-hyphen / bad-charset logins', () => {
        expect(checkRepoOwner('   ')).toMatchObject({ ok: false, reason: 'empty' })
        expect(checkRepoOwner('a'.repeat(40))).toMatchObject({ ok: false, reason: 'too_long' })
        expect(checkRepoOwner('-leading')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkRepoOwner('trailing-')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkRepoOwner('two--hyphens')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkRepoOwner('has space')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkRepoOwner('a/b')).toMatchObject({ ok: false, reason: 'charset' })
    })
})

describe('checkRepoName', () => {
    it('accepts dotted/underscored/hyphenated names', () => {
        expect(checkRepoName('portfolio')).toEqual({ ok: true, value: 'portfolio' })
        expect(checkRepoName('my.cool_repo-1')).toEqual({ ok: true, value: 'my.cool_repo-1' })
    })

    it('rejects empty, over-long, traversal-ish, and bad-charset names', () => {
        expect(checkRepoName('')).toMatchObject({ ok: false, reason: 'empty' })
        expect(checkRepoName('a'.repeat(101))).toMatchObject({ ok: false, reason: 'too_long' })
        expect(checkRepoName('.')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkRepoName('..')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkRepoName('a/b')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkRepoName('repo name')).toMatchObject({ ok: false, reason: 'charset' })
    })
})

describe('checkBranch', () => {
    it('accepts plain and slashed refs', () => {
        expect(checkBranch('main')).toEqual({ ok: true, value: 'main' })
        expect(checkBranch('gh-pages')).toEqual({ ok: true, value: 'gh-pages' })
        expect(checkBranch('release/1.0')).toEqual({ ok: true, value: 'release/1.0' })
    })

    it('rejects empty, traversal, bad slashes, and bad charset', () => {
        expect(checkBranch('')).toMatchObject({ ok: false, reason: 'empty' })
        expect(checkBranch('a'.repeat(256))).toMatchObject({ ok: false, reason: 'too_long' })
        expect(checkBranch('feat/../etc')).toMatchObject({ ok: false, reason: 'traversal' })
        expect(checkBranch('/leading')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkBranch('trailing/')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkBranch('double//slash')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkBranch('-dash')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkBranch('has space')).toMatchObject({ ok: false, reason: 'charset' })
    })
})

describe('checkSubdir', () => {
    it('treats null / undefined / empty as "no subdir"', () => {
        expect(checkSubdir(undefined)).toEqual({ ok: true, value: undefined })
        expect(checkSubdir(null)).toEqual({ ok: true, value: undefined })
        expect(checkSubdir('   ')).toEqual({ ok: true, value: undefined })
    })

    it('accepts relative build dirs', () => {
        expect(checkSubdir('dist')).toEqual({ ok: true, value: 'dist' })
        expect(checkSubdir('dist/')).toEqual({ ok: true, value: 'dist/' })
        expect(checkSubdir('packages/web/build')).toEqual({ ok: true, value: 'packages/web/build' })
    })

    it('rejects absolute paths, traversal, and bad charset', () => {
        expect(checkSubdir('/etc')).toMatchObject({ ok: false, reason: 'traversal' })
        expect(checkSubdir('../secret')).toMatchObject({ ok: false, reason: 'traversal' })
        expect(checkSubdir('a//b')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkSubdir('has space')).toMatchObject({ ok: false, reason: 'charset' })
    })
})
