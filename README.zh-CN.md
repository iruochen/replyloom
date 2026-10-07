# ReplyLoom

[English](README.md) | **简体中文**

ReplyLoom 是一款需要用户审核的 Chrome 扩展，使用用户选择的 AI 服务商，为 X 帖子起草回复。它读取用户选中的帖子，生成三条角度不同、可以编辑的回复草稿，再将选中的草稿填入 X 回复框供用户检查。它不会点击最终的 Reply（回复）按钮。

## 功能

- 支持英文、简体中文界面和回复输出
- 提供简洁、洞察、幽默、支持和提问等回复风格
- 支持 Chrome 侧边栏和可移动悬浮面板
- 直接支持 OpenAI、DeepSeek、MiniMax、智谱 GLM、豆包、通义千问、Moonshot AI 和 SiliconFlow
- 可选择在本地保存 API Key；不经过开发者运营的模型代理服务
- 生成的候选回复可编辑、复制，并填入回复框
- 使用 Manifest V3，明确限定模型服务商的主机权限，不执行远程托管代码

## 本地开发

```bash
git clone https://github.com/iruochen/replyloom.git
cd replyloom
npm ci
npm run check
npm run dev
```

在 `chrome://extensions` 中开启开发者模式，选择“加载已解压的扩展程序”，加载 `dist/` 目录。

## 打包

```bash
npm run package
```

扩展安装包会生成到 `release/ReplyLoom-<version>-chrome.zip`。
本地测试时可加载 `dist/` 目录。Chrome Web Store 发布由维护者执行，需要单独的发布凭据。

## 产品视频

仓库包含 30 秒、1080p 的产品介绍视频，以及可编辑的 Remotion 源码。

```bash
npm run video:studio
npm run video:still
npm run video:render
```

- 成品视频：`store-assets/video/demo-1920x1080.mp4`
- 封面：`store-assets/video/thumbnail-1920x1080.png`
- 源码：`video/src/`

## 官网和隐私政策

双语静态网站源码位于 `site/`，通过独立仓库发布：

- [官网](https://iruochen.github.io/replyloom-site/)
- [隐私政策](https://iruochen.github.io/replyloom-site/privacy.html)

## 项目文档

以下开发文档目前为英文：

- [技术架构](docs/03-architecture.md)
- [回复生成](docs/04-llm-prompting.md)
- [安全与隐私](docs/05-security-privacy.md)
- [手动测试](docs/07-manual-testing.md)
- [发布前由用户审核的架构决策](docs/adr/0001-human-in-the-loop.md)

## 贡献与安全

开发和 Pull Request 指引请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)。漏洞私密报告方式请参阅 [SECURITY.md](SECURITY.md)。

## 许可证

ReplyLoom 的原创代码采用 [MIT License](LICENSE)。运行时依赖的版权声明、Remotion 视频工具的许可，以及品牌和媒体使用事项，请参阅[第三方许可说明](THIRD_PARTY_NOTICES.md)。
