# Security policy

Security fixes target the latest release and the current `main` branch.

Use [GitHub private vulnerability reporting](https://github.com/iruochen/replyloom/security/advisories/new)
to report a suspected vulnerability. Include affected versions, reproduction
steps, impact, and a minimal example with dummy credentials. Do not disclose
API keys, publishing credentials, or private user content in public issues.

If a credential was exposed, revoke or rotate it with its provider immediately.
Deleting a file or commit does not invalidate a credential.

See [the security and privacy design](docs/05-security-privacy.md) for the
extension's provider permissions, local credential storage, and publication
controls.
