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

- 分别管理短文模型与长文模型；
- 快速应用 DeepSeek 和 Kimi 模型预设；
- 单独保存一套模型，避免覆盖另一套尚未完成的编辑；
- 保存前真实测试 API 地址、API Key、模型名和响应耗时；
- 显示当前生效配置与未保存修改；
- 保存后让下一次分析立即读取新配置，无需重新构建插件。

连接测试会真实请求一次模型，可能产生极少量 Token 费用。API Key 仍然只保存在本机 `chrome.storage.local`。

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

## Chrome 加载方式

1. 打开 Chrome，进入 `chrome://extensions/`
2. 打开右上角的 `Developer mode`
3. 点击 `Load unpacked`
4. 选择本项目下的 `dist/` 目录

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
