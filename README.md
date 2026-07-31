# Reality Splitter

Reality Splitter 是一个 Chrome Extension Manifest V3 插件 MVP，用来在浏览 X / Twitter / 微博时，把高刺激内容拆成更清晰的认知层，帮助用户降低自动脑补、灾难化和冲动 all-in 的风险。

它不是心理治疗、医疗建议、投资建议、法律建议或事实核查服务，也不会自动替用户做重大判断。

## 技术栈

- TypeScript
- React
- Vite
- Chrome Extension Manifest V3
- Current-page Drawer
- Side Panel fallback
- Content Script
- Background Service Worker
- `chrome.storage.local`

## 项目结构

```text
.
├── public
│   ├── icons
│   │   └── icon.svg
│   └── manifest.json
├── src
│   ├── background
│   │   └── serviceWorker.ts
│   ├── content
│   │   ├── contentScript.ts
│   │   └── platformExtractor.ts
│   ├── shared
│   │   ├── aiClient.ts
│   │   ├── messages.ts
│   │   ├── productCopy.ts
│   │   ├── prompts.ts
│   │   ├── storage.ts
│   │   └── types.ts
│   └── sidepanel
│       ├── components
│       │   ├── ActionButtons.tsx
│       │   ├── AnalysisPanel.tsx
│       │   ├── ResultCard.tsx
│       │   └── SettingsPanel.tsx
│       ├── App.tsx
│       ├── main.tsx
│       └── styles.css
├── package.json
├── sidepanel.html
├── tsconfig.json
└── vite.config.ts
```

## 安装

```bash
npm install
```

## 构建

```bash
npm run build
```

构建完成后会生成 `dist/` 目录。

## 官网预览

如果你要看官网页，请不要直接双击打开 `dist/index.html`。

这是一个 Vite 打包出来的前端页面，依赖浏览器通过 HTTP 加载模块资源；直接用 `file://` 打开时，Chrome 往往会因为本地模块加载限制而显示空白页。

正确打开方式：

```bash
npm run build
npm run preview
```

然后在 Chrome 中访问：

```text
http://127.0.0.1:4173/
```

如果只想看插件本体，仍然按下面的 Chrome 扩展加载方式使用 `dist/` 目录即可。

官网入口是 `index.html`，插件后台配置入口是 `options.html`。两者会在构建时一起输出，但用途彼此独立。

## 模型管理后台

插件抽屉顶部提供 `模型后台` 入口，也可以在 Chrome 扩展详情页打开“扩展程序选项”。

后台支持：

- 新增和管理多个命名 API 配置；
- 快速新增 DeepSeek 和 Kimi 模型预设；
- 分别设置短文模式与长文模式的默认调用模型；
- 在保存前逐项测试 API 地址、API Key、模型名和响应耗时；
- 显示当前生效模型与未保存修改；
- 保存后让下一次分析立即读取新配置，无需重新构建插件。

旧版的短文和长文配置会在首次打开时自动迁移到配置库，已有 API Key 不会丢失。连接测试会真实请求一次模型，可能产生极少量 Token 费用。API Key 仍然只保存在本机 `chrome.storage.local`。

## 网站内容后台

官网的默认文案统一保存在 `content/website-content.json`，公开页面不会再各自维护一份文案。

启动本地内容后台：

```bash
npm run studio
```

然后访问：

```text
内容后台：http://127.0.0.1:4180/studio.html
官网预览：http://127.0.0.1:4180/
```

后台可以管理首页文案、产品更新、AI 沉思录和关于页面。点击“发布内容”后，服务会写回内容文档并重新构建网站；这个操作只更新本地项目，不会自动部署到公网。

## GitHub 发布

这个项目使用两条彼此独立的自动发布流程：

- 推送到 `main`：GitHub Actions 构建公开官网并部署到 GitHub Pages。
- 推送版本标签，例如 `v0.2.1`：GitHub Actions 打包 Chrome 插件并创建 GitHub Release。

首次上线：

1. 在 GitHub 创建一个公开仓库并推送项目。
2. 在仓库 `Settings > Pages` 中把发布源设置为 `GitHub Actions`。
3. 将准备好的分支合并或推送到 `main`，等待 `Publish website` 工作流完成。

发布新插件版本：

```bash
npm version patch
git push origin main
git push origin --tags
```

版本标签必须与 `package.json` 中的版本一致。Release 会同时生成：

```text
reality-splitter-chrome-v0.3.2.zip   # Chrome Web Store 上传包
reality-splitter-offline-v0.3.2.zip  # GitHub 用户离线安装包
```

文件名中的版本由 `package.json` 自动生成。无版本文件名只作为旧链接的兼容别名保留。

内容后台中的“发布内容”只负责写入本地内容文件。完成修改后仍需提交并推送到 `main`，公网官网才会更新。

## Chrome 加载方式

从 GitHub Release 下载时，请使用带版本号的 `reality-splitter-offline-v<version>.zip`：

1. 完整解压 ZIP，不要直接双击 ZIP，也不要把 ZIP 文件拖进 Chrome
2. 打开 Chrome，进入 `chrome://extensions/`
3. 打开右上角的 `Developer mode`
4. 点击 `Load unpacked`
5. 选择解压后包含 `manifest.json` 的 `Reality Splitter` 文件夹

本地开发时可以直接加载项目生成的 `dist/`：

1. 打开 Chrome，进入 `chrome://extensions/`
2. 打开右上角的 `Developer mode`
3. 点击 `Load unpacked`
4. 选择本项目下的 `dist/` 目录

离线安装只表示插件文件不依赖 Chrome Web Store。DeepSeek、Kimi 等云模型分析仍需要联网；如果本机运行 OpenAI-Compatible 模型服务，可以在模型后台使用 `localhost` Base URL。

## 使用方式

1. 打开 `x.com`、`twitter.com` 或 `weibo.com`
2. 选中一段正文文本，然后使用右键菜单发送；也可以点击工具栏图标后直接粘贴
3. 在 X / Twitter 上，也可以点击内容下方的 `Reality Splitter` 按钮
4. 在抽屉底部设置入口打开后台配置并选择接口类型
5. 如果使用 OpenAI 官方接口，填写 OpenAI `API Key`
6. 如果使用自定义接口，选择 `OpenAI-Compatible` 并填写：
   - `API Key`
   - `Model`
   - `Base URL`
7. 点击以下任一按钮：
   - `拆解`
   - `降低刺激`
   - `找替代解释`
   - `转成小实验`
8. 查看结构化结果

## MVP 已覆盖能力

- 监听当前页面选中文本，并送入页面内抽屉
- 只在 X / Twitter 内容区域注入小按钮
- 微博不注入任何页面按钮，只保留选中文字、右键菜单、工具栏和粘贴入口
- 使用页面内抽屉承载主要交互，受限页面才降级到 Side Panel
- 支持四种分析模式
- 支持 OpenAI 官方接口和 OpenAI-Compatible 自定义接口
- 把接口类型、Base URL、API Key 和模型名保存在 `chrome.storage.local`
- 只上传用户主动选择、粘贴或通过 X / Twitter 按钮提取的文本

## 错误处理

当前版本已覆盖以下常见情况：

- 没有可分析文本
- 当前页面不是 X / Twitter / 微博
- API Key 未设置
- API 请求失败
- 模型返回非 JSON
- 文本过长时自动压缩关键段落后继续分析
- 网络异常

## 隐私说明

- 不会自动上传整个页面内容
- 只分析用户主动选中、粘贴或通过 X / Twitter 按钮提取的文本
- 不保存完整浏览历史
- 不采集用户身份信息
- API Key 仅保存在 `chrome.storage.local`
- 代码中不会主动把 API Key 打印到控制台

公开隐私政策：

```text
https://tcitrhao.github.io/reality-splitter/privacy.html
```

Chrome Web Store 上架文案、权限说明、素材路径和发布步骤见：

```text
docs/CHROME_WEB_STORE_RELEASE.md
```

## 自定义 API 接口说明

- 当前版本支持两种接口类型：
  - `OpenAI 官方接口`
  - `OpenAI-Compatible 自定义接口`
- 自定义接口应兼容 `/chat/completions`
- `Base URL` 可以填写网关根路径，例如：
  - `https://openrouter.ai/api/v1`
  - `https://api.siliconflow.cn/v1`
  - `https://api.deepseek.com`
- 也可以直接填写完整接口地址，例如：
  - `https://your-gateway.example.com/v1/chat/completions`
- 首次保存某个新域名时，Chrome 会弹出域名访问授权；需要允许后插件才能请求这个接口

## 后续 TODO

- 优化 X 页面 DOM 选择器，提升复杂 tweet 结构的提取稳定性
- 为结果增加复制按钮和历史记录开关
- 支持 prompt 和安全文案的可配置化
- 为 Side Panel 增加更细粒度的 loading skeleton
- 补充单元测试和端到端测试
- 在需要时改成后端代理模式，避免直接从插件调用模型 API
