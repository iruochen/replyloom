# Reply generation

The generation pipeline is implemented in `src/background/provider.ts`,
`src/shared/prompts.ts`, `src/shared/candidates.ts`, and
`src/shared/naturalize.ts`.

## Input and output

Input consists of the selected post, optional quoted-post context, language,
style, length preference, and user-supplied voice or additional instructions.
Prompts ask for three distinct replies grounded in the post, without invented
facts or personal experience. Source post text is treated as untrusted data,
not instructions to follow.

The shared provider path requests JSON output when supported. MiniMax uses a
compact three-line format and provider-specific response settings. The parser
accepts supported structured and plain-text forms, removes generic openers,
normalizes duplicates, and returns three non-empty distinct candidates.
Character limits are prompt guidance, not a guaranteed hard output limit.

## Timeouts and recovery

The primary generation request has an 18-second timeout. A timeout or invalid
response triggers one compact retry with a 12-second timeout. Authentication,
quota, and other provider failures are reported to the user. Model-list requests
have a 15-second timeout. Provider-specific token budgets are defined in the
adapter.

Candidates receive deterministic text normalization before display. Model
output remains fallible: users must review and edit drafts before publication.
The extension does not perform a separate model-based quality review or publish
replies automatically.
