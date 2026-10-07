# ReplyLoom

**English** | [简体中文](README.zh-CN.md)

ReplyLoom is a human-in-the-loop Chrome extension for drafting thoughtful replies to X posts with a user-selected AI provider. It reads the post the user chooses, generates three distinct editable drafts, and inserts the selected draft into X for review. It never clicks the final Reply button.

## Features

- English and Simplified Chinese interfaces and reply output
- Concise, insightful, humorous, supportive, and question-led reply styles
- Docked Chrome side panel and movable floating-panel modes
- Direct support for OpenAI, DeepSeek, MiniMax, Zhipu GLM, Doubao, Qwen, Moonshot AI, and SiliconFlow
- Optional local API-key persistence; no developer-owned model proxy
- Editable generated candidates with copy and insert actions
- Manifest V3, explicit provider host permissions, and no remotely hosted code

## Local development

```bash
git clone https://github.com/iruochen/replyloom.git
cd replyloom
npm ci
npm run check
npm run dev
```

Load `dist/` as an unpacked extension from `chrome://extensions` with Developer mode enabled.

## Packaging

```bash
npm run package
```

The extension ZIP is written to `release/ReplyLoom-<version>-chrome.zip`.
Load `dist/` as an unpacked extension for local testing. Publishing to the
Chrome Web Store is a maintainer operation and requires separate credentials.

## Product video

The 30-second 1080p introduction video and editable Remotion source are included in the repository.

```bash
npm run video:studio
npm run video:still
npm run video:render
```

- Final video: `store-assets/video/demo-1920x1080.mp4`
- Cover: `store-assets/video/thumbnail-1920x1080.png`
- Source: `video/src/`

## Website and privacy policy

The bilingual static website lives in `site/` and is published separately at:

- https://iruochen.github.io/replyloom-site/
- https://iruochen.github.io/replyloom-site/privacy.html

## Documentation

- [Technical architecture](docs/03-architecture.md)
- [Reply generation](docs/04-llm-prompting.md)
- [Security and privacy](docs/05-security-privacy.md)
- [Manual testing](docs/07-manual-testing.md)
- [Human review before publication](docs/adr/0001-human-in-the-loop.md)

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and pull-request guidance,
and [SECURITY.md](SECURITY.md) for private vulnerability reporting.

## License

ReplyLoom's original code is available under the [MIT License](LICENSE).
See [third-party notices](THIRD_PARTY_NOTICES.md) for runtime attribution,
Remotion video-tooling terms, and branding and media considerations.
