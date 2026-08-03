# 网站文案管理

`website-content.json` 是官网文案的唯一内容源。

你可以直接编辑这个 JSON 文档，也可以运行 `npm run studio` 使用本地内容后台。线上后台位于 `https://tcitrhao.github.io/reality-splitter/studio.html`，使用仅授权本仓库 `Contents: Read and write` 的 GitHub Fine-grained Token 登录；令牌只保存在当前标签页，发布会直接更新这份 JSON 并触发 GitHub Pages 部署。

线上后台会把未发布草稿保存在当前浏览器。发布前会重新读取 GitHub 最新内容，并把本地编辑安全合并进去，因此 Codex、Git 和另一个后台标签页的更新不会再因为旧文件 SHA 而阻断发布；发布成功后浏览器草稿会自动清除。登录时也会预先检查仓库写权限，避免编辑完成后才发现令牌只能读取。

公开页面、产品迭代和 AI 沉思录始终从同一份内容读取，因此线上后台、本地 Studio、直接编辑与 Codex 更新可以并行使用，不会产生第二套内容源。迭代的 `body`、`learning` 与 AI 沉思录的 `body` 支持 Markdown；沉思录正文留空时，页面只显示摘要。

`WEBSITE_COPY.md` 记录官网当前的信息架构、默认文案、动态内容模板和展示结构清单。它是维护参考，不会直接改变网站；实际展示内容仍以 `website-content.json` 为准。

注意：本地后台的“发布”会写回这个文件并重新构建网站，但不会直接上传到互联网。项目连接 GitHub 后，将内容变更提交并推送到 `main`，GitHub Pages 会自动更新公网官网。
