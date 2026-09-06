# Codex 文献工作台

由 Codex 对话管理全库，在 Codex 内置浏览器中运行独立 DeepSeek Harness（DSH）；每个文献分类绑定一个持久 DSH 管理会话。文献处理复用 DSH Scientific Reading 的固定发布包，SQLite 保存事实，Excel 是派生视图。

当前版本为 **[0.1.0-rc.1](https://github.com/TyrionH-is-coding/codex-scientific-reading/releases/tag/v0.1.0-rc.1) 发布候选**。首版支持 Windows x64、PowerShell 5.1+，需要联网安装。无需预装全局 DSH、Node 或 Python。Codex 桌面端必须提供可打开、读取页面的内置浏览器能力；Skill 会实际检查。本仓库为私有，请从该 Release 下载 zip 与 `SHA256SUMS.txt`，不要使用 GitHub 自动生成的 Source code 压缩包。

## 安装与打开

解压发行包，在其目录执行：

```powershell
powershell.exe -NoProfile -File .\install.ps1 -PluginArchive .\inputs\scientific-reading.tgz -InstallSkill
```

默认安装到 `%USERPROFILE%\CodexScientificReading`。可用 `-Root 'D:\文献工作台'` 指定新目录；未知非空目录会被拒绝。安装器校验 Node、Python、A 插件和依赖的版本/哈希，建立私有运行环境，并实际启动、停止一次确认可用。同名 Skill 若被用户修改，会保留并报告冲突。

安装后在 Codex 调用 `$codex-scientific-reading`，例如：

> 打开文献工作台。创建“抗磷脂综合征”分类，把这篇论文加入该分类并开始精读。

Codex 核对当前实例身份后，在内置浏览器打开 DSH。分类绑定由 Codex 完成；直接在 DSH 新建的未绑定会话不能调用文献管理工具。关闭标签页保留后台宿主，重开会复用原实例和会话。

也可使用安装目录里的管理脚本：

```powershell
$readingRoot = Join-Path $env:USERPROFILE 'CodexScientificReading'
& "$readingRoot\workbench.ps1" start
& "$readingRoot\workbench.ps1" status
& "$readingRoot\workbench.ps1" stop
```

返回 JSON 包含实际地址和实例 ID；端口每次选择空闲回环端口，不要固定使用 `3080`。

## 模型与 PDF

DSH 保留原生 LLM 配置和模型选择。使用普通 API 时在本实例配置；使用 Codex 订阅时，从实例入口打开“Codex 订阅登录与额度”，完成本实例的官方登录，再选择 `openai-codex` 提供方。凭据存于本实例，和外层 Codex、原 DSH 分开；同一账号的额度仍然共享。未登录或额度信息不可用会明确显示，不静默切换计费方式。细节见 [订阅接入](docs/oauth.md)。

文献设置保存 MinerU API Key，并显示资产位置及状态。Key 不随文献备份迁移。全文解析、模型翻译可能使用用户配置的服务。

自动下载仅走明确的 OA 来源。非 OA 论文由外层 Codex 使用用户授权的浏览器能力获取，登录、条款和人机验证交给用户；无法取得时保留“待补 PDF”。用户手动提供正文 PDF 后，经 A 的 PDF 校验、SHA 和同一任务续接入口处理。程序不读取、导出或搬运 Chrome 密码、Cookie、Profile 或登录文件。

Codex 交接和重试使用幂等键。分类会话只可访问本分类；跨分类移动和归档交给 Codex 总管理员。论文被移动或分类被归档后，旧后台任务的最后写回会重新校验。任务“完成”还要校验正式 Reader 的清单和实际 HTTP 字节，聊天回复不作为完成证据。

## 隔离与数据保留

| 安装根内位置 | 内容 |
| --- | --- |
| `runtime` | 固定版本 Node、Python 基础解释器和私有下载缓存 |
| `releases/<构建SHA前16位>` | 每个版本的代码、npm、Python venv、固定 A 包和 OAuth 组件；描述符校验完整 SHA |
| `state/dsh-home` | 专用 DSH 设置、preset 和对话 |
| `state/codex-home` | 本实例 Codex 订阅登录与官方 CLI 状态 |
| `state/handoff.json` | 分类会话绑定和交接回执，文献事实仍在 SQLite |
| `library` | 唯一文献库、PDF、Reader、Excel 和长期资产 |
| `workspace` | DSH 工作目录 |

不继承用户原 DSH 的插件、补丁、文献库或模型凭据，不更新系统 PATH。实例使用应用层配置/依赖隔离及分类权限控制，不是操作系统沙箱。

升级时将新发行包的安装器指向同一根目录；先准备新依赖，再备份和切换，失败恢复旧程序。`rollback` 回退程序而保留新文献。`uninstall.ps1` 停止和备份后移除程序及未修改的自有 Skill，保留文献、工作区和账号状态。迁移必须先将 A 的备份恢复到新目录，不共享活动数据库。完整命令见 [生命周期指南](docs/lifecycle.md)。

## 范围与验证

0.1 使用固定 Excel 字段和 Reader 模板；自定义字段、HTML/CSS 模板、文献雷达均留在 0.2。

开发回归：`npm test`。真实安装、浏览器、隔离、恢复以及尚需本人登录的覆盖边界，以发行包随附的验收记录为准。不能用模拟 OAuth 多轮通过代替真实账号已验收，也不能用 Reader 哈希一致代替论文语义准确。

上游许可与固定来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。安装过程只使用发行包固定的 A tarball；源码克隆者需取得 `runtime/pins.json` 所指的相同文件，不能任意替换。
