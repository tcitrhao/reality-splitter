# Chrome Web Store 发布材料

本文件对应 Reality Splitter 当前版本。正式提交前，先执行：

```bash
npm ci
npm run package:extension
```

上传文件：

```text
release/reality-splitter-chrome-v<version>.zip
```

## 开发者账号

1. 使用长期维护的 Google 账号登录 Chrome Web Store Developer Dashboard。
2. 为发布账号开启 Google 两步验证。Chrome Web Store 会在未开启时拒绝上传 ZIP。
3. 同意开发者协议并支付一次性注册费。
4. 完成开发者资料与联系邮箱设置。

当前发布账号：

```text
Google account: tcitr.feng@gmail.com
Publisher: Reality Splitter
Publisher ID: 21c24b34-8647-4212-aee6-0b3c3136b262
Trader status: Non-trader / 非交易者
```

两步验证：

```text
https://myaccount.google.com/signinoptions/two-step-verification
```

整理后的提交包：

```text
release/chrome-web-store-v0.2.1/
```

## Store Listing

### 名称

```text
Reality Splitter
```

### 简短说明

```text
把高刺激内容拆成事实、观点、推断与待核查点，帮助你在行动前恢复判断空间。
```

### 详细说明

```text
Reality Splitter 是一个帮助你拆解网页信息的 Chrome 扩展。

当一段内容让你焦虑、兴奋，或产生立即行动的冲动时，你可以选中文字，通过右键菜单发送到短文模式或长文模式。插件会在当前标签页打开分析抽屉，帮助你区分：

• 作者声称的事实
• 作者表达的观点
• 从事实延伸出的推断与预测
• 情绪刺激与传播型焦虑信号
• 仍需核查的证据与来源
• 当前最小、可逆的下一步

短文模式适合社交媒体、消息和短观点，提供拆解、降低刺激、替代解释和小实验四种分析方式。

长文模式适合较长文章，把作者声称的事实与观点分开，并在模型能力允许时辅助检索与核查。

Reality Splitter 不替你裁定真相，也不替你做决定。它的目标是把混在一起的信息重新分层，让你看清证据边界后再判断。

隐私与数据：
• 只处理你主动选中、粘贴或通过 X / Twitter 按钮提交的文本
• 不自动上传整个网页
• API Key 与模型配置保存在浏览器本地
• 分析文本会直接发送到你自行配置的模型服务
• 不出售数据，不投放广告，不加载远程代码
```

### 分类与语言

```text
分类：Productivity
主要语言：中文（简体）
成熟内容：否
```

### 网站

```text
Homepage URL:
https://tcitrhao.github.io/reality-splitter/

Support URL:
https://github.com/tcitrhao/reality-splitter/issues

Privacy policy:
https://tcitrhao.github.io/reality-splitter/privacy.html
```

## Privacy Practices

### Single purpose

```text
帮助用户把主动提交的网页文本拆分为事实、观点、推断、情绪信号和待核查点，以便在采取行动前恢复判断空间。
```

### Permission justifications

`activeTab`

```text
仅在用户点击扩展、页面按钮或右键菜单后，访问当前标签页中用户主动选择或提交的文本，并在该标签页显示分析抽屉。
```

`storage`

```text
在浏览器本地保存用户配置的模型供应商、接口地址、API Key、工作区模式和待分析文本，使设置和当前工作状态可以恢复。
```

`sidePanel`

```text
在无法注入当前页面抽屉的 Chrome 受限页面中，提供同一分析功能的降级界面。
```

`scripting`

```text
当用户主动通过工具栏或右键菜单调用扩展、但当前页面尚未加载内容脚本时，将本地打包的抽屉脚本注入当前标签页。扩展不注入远程代码。
```

`permissions`

```text
在用户保存自定义模型接口时，按需请求该接口域名的可选访问权限。权限由用户在 Chrome 授权对话框中明确批准。
```

`contextMenus`

```text
提供“发送到短文模式”和“发送到长文模式”两个右键入口，把用户主动选择的文本送入对应工作区。
```

站点访问权限：

```text
X、Twitter 和微博权限用于在这些站点加载当前标签页抽屉、读取用户主动选择的文本，并在 X / Twitter 内容区域提供提交按钮。微博不注入内容按钮。
```

可选 HTTPS 域名权限：

```text
用于连接用户自行配置的 OpenAI-Compatible 模型接口。该权限不是安装时默认授予；插件只在用户保存具体接口地址时请求对应域名授权。
```

### Remote code

选择：

```text
No, I am not using remote code.
```

说明：

```text
扩展执行的 JavaScript 与 CSS 均包含在上传包中。模型 API 返回内容仅作为数据解析和显示，不会作为代码执行。
```

### Data use disclosure

建议如实勾选：

```text
Authentication information
Website content
```

说明：

```text
API Key 保存在 chrome.storage.local，并只发送到用户配置的模型接口用于鉴权。用户主动提交的文本会发送到该接口进行分析。项目维护者不运营中转服务器，不接收这些数据，也不出售数据或用于广告。
```

## Store Assets

提交前准备：

- `128x128` PNG 商店图标：可使用 `public/icons/icon-128.png`
- `1280x800` 抽屉截图：`store-assets/screenshot-01-drawer.png`
- `1280x800` 模型后台截图：`store-assets/screenshot-02-model-admin.png`
- `440x280` small promo tile：`store-assets/promo-small-440x280.png`
- `1400x560` marquee promo tile 可选
- YouTube 演示视频可选

推荐截图顺序：

1. 当前标签页左侧短文拆解抽屉与注意力分诊结果
2. 短文模式与长文模式切换
3. 长文事实/观点核查结果
4. 模型管理后台的双模型配置

截图中不要出现真实 API Key、私人账号、邮箱或敏感网页内容。

`store-assets/*-source.html` 是可复现素材的本地源文件，不需要上传到 Chrome Web Store。

## Submit

1. 在 Developer Dashboard 点击 `Add new item`。
2. 上传 `release/reality-splitter-chrome-v<version>.zip`。
3. 完成 `Store Listing`、`Privacy`、`Distribution`。
4. 如果审核人员需要模型能力，可在 `Test instructions` 说明：用户需自行配置兼容模型 API；不应提交你自己的生产 API Key。
5. 点击 `Submit for Review`。首发建议选择 deferred publishing，审核通过后先做一次最终检查再手动发布。
6. 发布后复制 Chrome Web Store 商品页 URL。
7. 在 GitHub 仓库 `Settings → Secrets and variables → Actions → Variables` 新增：

```text
CHROME_WEB_STORE_URL=<商品页完整 URL>
```

8. 重新运行 `Publish website` 工作流。官网首页按钮会自动切换到 Chrome 商店；变量为空时继续使用 GitHub Release ZIP。

## 每次更新

1. 修改代码和 `CHANGELOG.md`。
2. 提升 `package.json` 版本。
3. 执行 `npm run package:extension`。
4. 在 Chrome Web Store 原商品中上传新的 ZIP。
5. 提交审核。
6. 创建同版本 Git tag，让 GitHub Release 与商店版本一致。
