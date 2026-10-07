# Security and privacy

For user-facing data disclosures, see [PRIVACY.md](../PRIVACY.md). Report
vulnerabilities privately as described in [SECURITY.md](../SECURITY.md).

## Data flow

The extension sends selected post context and generation instructions directly
to the provider chosen by the user. The API key is sent to that provider for
authentication. There is no developer-operated model proxy or analytics service
in the extension.

Provider calls require HTTPS, an allowlisted official endpoint, and the relevant
Chrome host permission. API keys are used by extension settings and background
code; they are not intentionally injected into X page content.

## Local storage

Remembered API keys and provider profiles are stored in extension-owned local
storage. Session-only keys and selected post context use session storage.
Credentials do not use Chrome sync storage. Browser storage is not a dedicated
secrets manager: device compromise or a vulnerable extension context can expose
stored credentials. Use restricted keys and appropriate quotas when available.

To remove extension data, clear the extension's stored data or uninstall it.
There is no generation-history feature in the current implementation.

## Untrusted content and publication

Prompts tell models to treat source posts as data. This reduces prompt-injection
risk but does not guarantee model behavior. Drafts remain editable and require
user review. Insertion into X's editor is separate from publication: ReplyLoom
never activates the final Reply or Post control.

## Contributing safely

Use dummy values in tests and screenshots. Never commit credentials, local
`.env` files, private post content, or raw diagnostic output containing secrets.
Review changes to provider endpoints, permissions, storage, and extension
messaging carefully. Keep remotely hosted code out of extension bundles.
