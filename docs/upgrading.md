# 更新已有工作台

**沿用原安装目录更新，文献、笔记、会话和模型配置继续保留。** 安装器会准备新依赖、备份文献库，再切换程序并验证启动。

## 推荐：交给 Codex

在能使用 DLC 的 Codex 对话中发送：

```text
帮我把已有的 Deep Literature for Codex 更新到 v0.2.0-rc.2。
按官方升级指南操作：
https://github.com/TyrionH-is-coding/deep-literature-for-codex/blob/main/docs/upgrading.md

从当前 Skill 的安装记录找到原工作台，下载对应系统的 Release 并核对 SHA256。
使用新版安装器更新原目录和 Skill，保留文献、笔记、会话及配置。
完成后核对新版本、原实例身份和已有文献，告诉我备份位置。
```

开始前保存并关闭 Excel，等待正在解析或写入的任务结束。找不到原安装位置，或发现多个工作台时，Codex 会先核对目标。

## 手动更新

1. 从 [Releases](https://github.com/TyrionH-is-coding/deep-literature-for-codex/releases) 下载与你系统和架构相符的安装包及 `SHA256SUMS.txt`，核对后解压到临时目录。
2. 找到原工作台根目录，其中应有 `.workbench.json`、`installation.json` 和 `workbench.ps1` / `workbench.sh`。也可读取已安装 Skill 中的 `installation.json` 确认位置。
3. 在**新安装包目录**运行下面的命令，将示例路径换成原工作台位置。

Windows：

```powershell
powershell.exe -NoProfile -File .\install.ps1 -Root 'D:\原文献工作台' -PluginArchive .\inputs\scientific-reading.tgz -InstallSkill
```

macOS / Linux：

```sh
sh ./install.sh --root "$HOME/CodexScientificReading" --plugin-archive ./inputs/scientific-reading.tgz --install-skill
```

默认目录为用户目录下的 `CodexScientificReading`；曾使用自定义路径时，以实际安装位置为准。定制过 Skill 安装位置的用户，还需传入原来的 `-SkillsDirectory` / `--skills-directory`。

更新后检查版本与已有文献。原来运行中的实例会恢复运行；原来停止的实例仍保持停止。新 Skill 在新 Codex 对话中生效，用户修改过的 Skill 会保留并提示合并。有效的模型连接与 MinerU 配置无需重新填写。

当前通过新版安装包执行更新，没有 `workbench update` 命令。拉取 GitHub 源码或更新 Skill 本身，都不会更新已安装的工作台程序。

## 从 v0.1 升级需要知道

- 文献数据格式由 4/5 升至 6，会话升级为 DSH V3。升级前的一致文献备份保存在原目录的 `state/library-backups/`，包括数据库、PDF、Reader 和相关资产；它不包含模型凭据，也不是完整旧会话备份。
- 备份失败或文献任务忙时，安装器保留旧版本并提示处理。请先解决占用，再重试同一个安装命令。
- 已迁移后不能直接 `rollback` 到 v0.1。若出现 `release_recovery_required`，使用原目录的 `workbench.ps1 recover` 或 `sh workbench.sh recover` 恢复新版；不要用旧数据库覆盖升级后新增的笔记。
- 如确需恢复升级前状态，请将升级前备份恢复到另一个独立目录，再核对所需资料。[恢复与迁移](lifecycle.md)

v0.2.0-rc.2 是预发布版。真实账号的模型效果、机构访问和特定桌面软件兼容性，以对应 [Release 说明](https://github.com/TyrionH-is-coding/deep-literature-for-codex/releases/tag/v0.2.0-rc.2)为准。
