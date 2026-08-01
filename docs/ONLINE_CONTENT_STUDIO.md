# Reality Splitter 在线内容后台

访问地址：

```text
https://tcitrhao.github.io/reality-splitter/studio.html
```

## 第一次登录

1. 打开 [GitHub Fine-grained Token 创建页](https://github.com/settings/personal-access-tokens/new)。
2. `Resource owner` 选择 `tcitrhao`。
3. `Repository access` 选择 `Only select repositories`，只勾选 `reality-splitter`。
4. 在 `Repository permissions` 中找到 `Contents`，选择 `Read and write`。
5. 其他权限保持默认，设置合理的有效期后创建 Token。
6. 回到内容后台，粘贴 Token 并登录。

Token 只保存在当前标签页的 `sessionStorage`。退出后台或关闭标签页后会被清除，不会进入网站代码、GitHub 仓库或本地内容文件。

## 编辑与发布

- `迭代`：管理日期、版本、标题、更新内容和阶段学习；正文支持 Markdown。
- `AI 沉思录`：管理编号、状态、标题、摘要和 Markdown 正文。
- 编辑后顶部会显示“有未发布修改”。
- 点击“发布修改”会更新 `main` 分支中的 `content/website-content.json`。
- GitHub Pages 工作流会自动运行，通常几分钟内更新公网网站。

后台提交时会携带读取时的文件 SHA。如果内容已被其他方式更新，GitHub 会拒绝覆盖；此时重新载入最新内容后再编辑即可。

## 与其他编辑方式协同

以下方式始终修改同一份 `content/website-content.json`：

- 在线内容后台；
- `npm run studio` 本地后台；
- 直接编辑 JSON；
- 由 Codex 修改并提交。

因此不需要做内容同步，也不会产生第二套数据库。在线发布前如果 Codex 或本地 Git 已经更新内容，请先在后台点击“重新载入”。
