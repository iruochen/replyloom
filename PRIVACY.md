# ReplyLoom Privacy Policy

Effective date: June 23, 2026

ReplyLoom is a browser extension that helps users draft replies to posts on X. It does not publish replies automatically, operate an engagement bot, or run a developer-owned model proxy.

## Data ReplyLoom handles

ReplyLoom may handle the following data only to provide its core reply-drafting feature:

- The text and basic public context of the X post selected by the user, including the displayed author name, handle, quoted-post text, and post URL.
- Reply preferences entered by the user, such as language, tone, length, and optional writing instructions.
- The API key, provider, endpoint, and model selected by the user.
- Local interface preferences, provider profiles, and floating-panel positions.

## How data is used

When the user asks ReplyLoom to generate replies, the selected post context and reply preferences are sent directly from the extension to the model provider selected by the user. The API key is sent only to that provider for authentication.

ReplyLoom currently supports OpenAI, DeepSeek, MiniMax, Zhipu GLM, Volcengine Ark (Doubao), Alibaba Cloud Model Studio (Qwen), Moonshot AI, and SiliconFlow. Each provider processes requests under its own terms and privacy policy.

## Storage and retention

- API keys are stored in Chrome extension storage on the user's device only when the user enables the save-key option. When that option is disabled, the key is kept in session storage and is cleared when the browser session ends.
- Provider settings and interface preferences are stored locally in Chrome extension storage.
- Selected post context is stored in session storage so the side panel can display it during the current browser session.
- ReplyLoom does not send API keys, post content, or generated replies to a server operated by the ReplyLoom developer.

Users can remove locally stored data at any time by clearing the extension's site data or uninstalling ReplyLoom.

## Data sharing

ReplyLoom shares selected post context and generation instructions only with the model provider chosen by the user. It does not sell personal data, use data for advertising, perform creditworthiness checks, or share data with unrelated third parties.

## Permissions

ReplyLoom accesses X pages only to read the post selected by the user and insert a user-approved draft into the relevant reply editor. It requests access to a supported model provider only when the user chooses to connect that provider.

## Security

ReplyLoom limits network access to an explicit list of supported HTTPS model-provider domains. It does not execute remotely hosted code. Browser-local storage is not equivalent to a dedicated secrets manager, so users should use restricted, low-quota API keys when their provider supports them.

## User control

ReplyLoom creates editable drafts. The user must review and manually publish every reply. The extension does not click X's final Reply or Post button.

## Changes

If this policy changes, the effective date above will be updated and the revised policy will be published at the same public URL.

## Contact

Privacy questions: **ruochen.mail@gmail.com**

ReplyLoom is an independent product and is not affiliated with, endorsed by, or sponsored by X Corp. or any supported model provider.
