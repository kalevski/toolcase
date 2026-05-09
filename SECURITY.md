# Security Policy

## Supported versions

Only the latest published version of each `@toolcase/*` package on npm receives security updates. Older majors are not patched.

| Package | Status |
|---|---|
| `@toolcase/base` | latest only |
| `@toolcase/logging` | latest only |
| `@toolcase/serializer` | latest only |
| `@toolcase/node` | latest only |
| `@toolcase/react-components` | latest only |
| `@toolcase/game-components` | latest only |
| `@toolcase/phaser-plus` | latest only |

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report privately via one of the following:

- **Email:** `dakalevski@gmail.com` with the subject `[toolcase][security] <short summary>`.
- **GitHub Security Advisory:** https://github.com/kalevski/toolcase/security/advisories/new (preferred — supports private discussion and CVE assignment).

Please include:

- Affected package(s) and version(s).
- A description of the issue and the impact.
- Reproduction steps or a minimal proof-of-concept.
- Any suggested mitigation.

## What to expect

- **Acknowledgement** within 5 business days.
- **Initial assessment** within 10 business days.
- A fix will be released as a patch version of the affected package, with a security advisory and credit (unless you request anonymity).

## Scope

In scope:

- Vulnerabilities in any `@toolcase/*` package source code.
- Supply-chain risks introduced by this repository's published artifacts.

Out of scope:

- Issues in third-party dependencies (please report upstream).
- Vulnerabilities that require already-compromised developer machines or already-elevated privileges.
- The `examples/` site beyond what affects the published packages.
