<!--
Thanks for the PR! Please fill out the sections below so reviewers can move quickly.
For first-time contributors: read CONTRIBUTING.md for repo conventions.
-->

## Summary

<!-- One or two sentences. What does this PR change and why? -->

## Affected packages

<!-- Tick all that apply. Delete the rest. -->

- [ ] `@toolcase/base`
- [ ] `@toolcase/logging`
- [ ] `@toolcase/serializer`
- [ ] `@toolcase/node`
- [ ] `@toolcase/react-components`
- [ ] `@toolcase/game-components`
- [ ] `@toolcase/phaser-plus`
- [ ] `examples/` site
- [ ] Repo / CI / tooling

## Change type

- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking, additive)
- [ ] Breaking change (API removal, behavior change)
- [ ] Refactor / internal cleanup
- [ ] Docs / SKILL.md / examples
- [ ] Build / CI / tooling

## Test plan

<!-- How did you verify the change? Be specific. -->

- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run lint:exports` (when public surface changes)
- [ ] Manual check in `examples/` (when UI changes)

## Checklist

- [ ] PR is focused on a single logical change
- [ ] Public API changes are reflected in the relevant `examples/public/<pkg>/SKILL.md`
- [ ] New component / export is added to its package's `src/index.ts`
- [ ] No `border-radius` introduced in `react-components` (except intentional circles)
- [ ] New `game-components` entries register a `disconnectedCallback` if they install listeners or observers

## Related issues

<!-- e.g. Closes #123, Refs #456 -->
