# Contributing to ReplyLoom

For bugs and feature requests, open an issue with reproduction steps, expected
behavior, and your Chrome and extension versions. Remove API keys, credentials,
and private post content from reports and screenshots.

For code changes:

1. Fork and clone the repository, then run `npm ci`.
2. Keep changes focused and add tests appropriate to behavior changes.
3. Run `npm run check` and load `dist/` as an unpacked Chrome extension for UI changes.
4. Open a pull request describing the change and validation.

Live model tests are optional and require your own credentials and model quota.
Normal tests use mocks. Never commit local environment files, credentials, or
release archives. Chrome Web Store publishing is a maintainer-only operation;
contributors do not need publishing credentials.

Preserve user review before publication: ReplyLoom must never click X's final
Reply or Post button. Contributions are made under the project's MIT License;
third-party software and media retain their own terms.

Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
