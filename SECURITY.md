# Security Policy

## Supported versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

portmap reads local filesystem and OS process information. It does not send
data over the network, but a vulnerability could still affect users who run
untrusted code or scan malicious project layouts.

To report a security issue:

1. Open a [GitHub Security Advisory](https://github.com/paladini/portmap/security/advisories/new) (preferred), or
2. Contact [@paladini](https://github.com/paladini) via GitHub with details and reproduction steps.

We aim to acknowledge reports within 72 hours and provide a fix or mitigation
timeline when confirmed.

## Scope

In scope:

- Command injection via malicious project files parsed by portmap
- Path traversal outside the scan root
- Unsafe handling of MCP tool inputs

Out of scope:

- Incorrect port detection heuristics (file a [false positive issue](https://github.com/paladini/portmap/issues/new?template=false_positive.yml) instead)
- Local dev misconfiguration (PRT-* findings working as designed)
