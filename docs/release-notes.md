# Codex 文献工作台 0.1.0-rc.1

首个 Windows x64 发布候选。用户在 Codex 中管理文献全库，在 Codex 内置浏览器中的 DSH 会话管理单个分类。

## 这一版

- 独立安装 Node、Python、DSH 与固定 A 插件，文献库、会话、模型配置和订阅凭据与用户原 DSH 分开。
- Codex Skill 负责实例核对、分类绑定、题录入库、任务交接与恢复；分类主管使用原生 DSH 工具和模型选择。
- 自动获取 OA 正文，支持合法取得或手动提供的正文 PDF。重复交接、补 PDF 和重试保留原任务；完成须核对实际 Reader 文件。
- 分类权限在查询、工具调用、子会话、后台作业和最后写回处校验。移动或归档后，旧任务不能继续写入新分类。
- 原生 LLM 配置与独立 Codex 订阅登录入口；同账号额度共享，未登录或额度不可用时明确显示。
- 升级失败恢复旧程序，回退保留当前数据；迁移复用 A 的备份合同，卸载保留文献与用户修改的 Skill。
- 正常关闭撤销的主管排队消息会在再次核对时显示 canceled；崩溃后从原生持久队列恢复。缺乏证据时显示 uncertain，同一交接不盲目重发。

文献设置保存 MinerU API Key；固定 Excel 字段支持有限的用户笔记写回。自定义字段、Reader 模板和文献雷达留在 0.2。

## 安装与验证

从公开 prerelease 下载 zip 与 `SHA256SUMS.txt`：https://github.com/TyrionH-is-coding/codex-scientific-reading/releases/tag/v0.1.0-rc.1 。对应源码为 `645d41a19fc879b0dd362245aaf8b03f5961651e`。GitHub 自动生成的 Source code 压缩包不是安装器。

解压 zip 后按照 [安装说明](../README.md) 执行安装器，首次使用调用 `$codex-scientific-reading`。程序需联网获取清单中的固定依赖。

附件的 SHA 在同一 Release 的 `SHA256SUMS.txt`；zip 内 `BUILD-MANIFEST.json` 包含逐文件源码校验。具体已测组合和未测项目见 `ACCEPTANCE.md`。本候选的安装、离线回归及本地模型工具回合，不代表真实账号授权、网络资源可用性或论文内容已全面验收。

自动化无法取得非 OA 正文时会等待用户提供 PDF。登录、人机验证和个人阅读确认由用户完成。
