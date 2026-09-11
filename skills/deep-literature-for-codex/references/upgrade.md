# 更新已有工作台

用户提出更新即授权执行以下升级流程；不重复询问是否升级。明确版本优先于自动选择，不安装草稿 Release，不用源码压缩包代替发行安装包。

1. 读取当前 Skill 目录的 `installation.json` 定位原安装根，核对该根的 `.workbench.json`、`installation.json` 和 `workbench status`。记录实例 ID、原版本、数据格式、会话格式与运行状态；只读取所需字段，不输出凭据。找不到记录时查已知安装位置；存在多个实例且无法判断时，先询问更新哪一个。
2. 用户指定版本时读取对应的官方 [Release](https://github.com/TyrionH-is-coding/deep-literature-for-codex/releases)；未指定时选择非草稿的新版本，保留当前预发布渠道。升级至 v0.2 时可选择 `v0.2.0-rc.2`。公开测试包可能全部标为 prerelease，不能仅依赖 GitHub 的 `/releases/latest` 接口。
3. 按系统和架构下载 Release 中的安装包与 `SHA256SUMS.txt`，逐项校验；下载至独立临时目录并解压。核对 `BUILD-MANIFEST.json`、版本和固定引擎 SHA。不要改旧实例的 pin 或用不匹配的引擎绕过校验。
4. 提醒保存并关闭 Excel，等待正在写入的文献任务结束。使用新包的安装器，显式指定原安装根、`inputs/scientific-reading.tgz`、`InstallSkill` 及当前 Skill 的父目录。让安装器完成依赖准备、一致文献备份和版本切换，不手工复制覆盖程序目录、不另建空库。
5. 核验安装结果为成功，实例 ID 和原安装根不变，所选版本及引擎 SHA 与 Release 一致，已有文献与笔记可读。安装器保留原运行状态；需要展示时使用当前启动返回的 `entryUrl`。仅为验证升级不发起模型或 MinerU 请求。
6. 报告新版本、备份位置和 Skill 更新结果。定制过的 Skill 会被保留；需要合并时只补本轮升级指引，保留用户内容。新 Skill 在新 Codex 对话中生效。模型连接状态应核对，已有有效配置不要求重新填写。

## 迁移与失败

v0.2 将数据格式 4/5 升至 6，并使用 DSH V3 会话。切换前备份失败或任务忙时，保持旧程序并说明如何继续。已经迁移后不能通过 `rollback` 让旧程序读取新格式；出现 `release_recovery_required` 时运行当前根的 `recover`，继续恢复新版。不要把旧数据库复制回来覆盖新增记录。

完整退回旧版需使用升级前备份，在另一个独立目录恢复；现有文献库备份不包含模型凭据，也不能当作完整旧会话备份。
