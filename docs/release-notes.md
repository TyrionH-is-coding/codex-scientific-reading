# v0.2.0-rc.2 候选版：边读、边问、边积累（2026-09-12）

- 在线阅读页支持选区解释、追问与来源跳转；“随记”共用侧面板，保存后可直接打开 Excel。
- 翻译、导读、要点提取与讨论可分别选择模型及思考深度；模型选项跟随实际连接状态，默认分工为 Luna 翻译、Sol 分析与讨论。
- Codex 接入补齐图片传输，Figure 讨论保留图注和相关正文；每篇论文有独立的持续会话，也可选择多篇讨论综合。
- 暖纸、纯白、深墨、雾蓝四套主题统一应用于文献库与 Reader；文献和设置移至宿主右侧栏，左侧阅读目录可收起。
- 支持离线 HTML 分享、Excel 列与研究字段、阅读模板和文献雷达；OA 未取得后可按本人授权继续机构全文获取。
- 固定适配 DSH 0.1.5-rc.1；源码内置引擎关联明确的来源提交、包审计与依赖锁。

本次更新已进入 `main`，尚未发布 v0.2 Release。真实账号的 Astra 调用与识图效果、机构访问、旧库升级和各平台实机验收仍需继续验证。[使用与迁移指南](v0.2-guide.md) · [验收记录](v0.2-acceptance.md)

# rc.8 本地候选：设置页、模型恢复与翻译续接

- 设置页使用四组纵向设置行：模型与连接、PDF 解析、文献库、关于；复用 DSH 原生模型配置，显示当前实例 Codex 登录状态。
- 修复模型子进程退出后永久 closed；下一次请求可重新连接，保留会话与工具结果的恢复边界，不自动重放失败请求。
- 随包引擎 A rc.7 新增精简翻译输入，服务端绑定原文及批次 SHA。已验证部分保留到草稿，只补剩余块；本批初次提交后最多两次补试，随后暂停等待用户继续。
- 清理旧空设置表单，合并重复的翻译输入校验；新增不含凭据与论文正文的有限生命周期日志。

验收范围见[发布前工程审视](release-engineering-review.md)。这是新的本地候选，不能据此宣称 GitHub 已发布或 Mac/真实模型已全部通过。此前附件不覆盖。

# rc.7 开发版：Excel 长期管理与首次配置引导

- 文献总表支持独立阅读进度、课题关系、下一步及原有三项个人记录；个人检索和更新时间由真实修改驱动。
- 阅读成果复用带来源的导读与确认记录，图表索引合并同一表格的截图和结构表，去掉用户表中的会话字段。
- 保存关闭后通过正式 Codex 接口同步；整表排序按稳定标识回写，并发冲突保留双方，旧工作簿按哈希归档。
- 新引擎 A rc.6 升级数据库格式到 5；安装前备份，迁移失败按新格式恢复，禁止旧程序回退覆盖新成果。
- 首次入口解释独立模型配置与 MinerU，Skill 停留引导页；同步状态读取真实导出与子任务回执。

本节描述已合并的开发改动，未表示候选附件已公开。验证结果见 [Excel 整合验收](excel-v0.1-acceptance.md)。[macOS 实装报告](macos-first-run-followup.md)中的 provider 生命周期、翻译回传协议及新表的 Mac 原生回写仍需跟进。已发布附件保持不变。

# rc.6：修复 MinerU 空图表阻断归一化（#6）

随包引擎升级到 rc.5。无可用内容的空图表条目改为带页码、原始索引和人工复核要求的警告，继续处理正文；缺图但有内容时明确报完整性错误。原始 JSON、来源哈希和资产路径/哈希校验保持可追溯。该判断不能证明原 PDF 区域无内容或跨页合并无损。

五平台安装验收增加直接调用已安装 wheel 的空图表回归。按用户确认，本轮以通用修复为准，未复验 PMID 40835971 原论文的 MinerU 导出和最终 Reader。详见 [修复范围与证据](issue-6.md)。此前 rc.5 附件保持不变。

# rc.5：Skill 改名、跨平台 OAuth 与 Excel 占用保护

- Skill 入口和显示名统一为 Deep Literature for Codex；迁移未修改的旧入口，保留定制内容与原实例数据。
- 安装结束和首次使用主动提醒选择 DSH 原生模型 API 或 Codex OAuth，并配置 MinerU。
- 修复 OAuth 启动器仍限定 Windows x64 的问题；按 macOS/Linux 的 x64、ARM64 架构解析官方原生程序。
- Excel/LibreOffice 占用标记存在时保留工作簿，等待保存关闭后再同步；补齐跨平台 Skill 操作说明。
- 五平台验收新增已安装 Skill 启停、真实 OAuth 未登录状态、三列 Excel 笔记回写及重启重装保留检查。

本人 OAuth、macOS/Linux 桌面表格编辑与模型完整调用仍需实机验收。Luna 已有用户成功报告；Spark、GPT-6 Astra 待后续测试，见 [模型测试记录](model-tests.md)。旧版本附件不覆盖。

# rc.4：macOS / Linux 适配

- 增加 macOS Intel/Apple Silicon、Linux x64/ARM64 的安装、启动、恢复、回退与卸载入口。
- 各平台使用固定版本和 SHA256 校验的私有 Node/Python 与 Python wheel。
- MinerU Key 使用 Windows DPAPI、macOS Keychain 或 Linux Secret Service，按实例隔离。
- Excel 总表在 macOS/Linux 使用系统关联软件打开；没有自动选行时准确提示手动查找。
- 修复 Unix 已退出进程误判为运行中、长路径控制 socket，以及 Windows 中文安装目录解压和长路径卸载问题。
- 增加五个平台的工作台、OAuth、引擎与插件 CI，并提供记录耗时的真实安装检查。真实模型和 MinerU 调用仍按账号单独验收。

按平台选择安装包，见 [Windows / macOS / Linux 安装指南](platforms.md)。完整检查、安装/启动耗时与问题记录见 [rc.4 验收](acceptance.md)。

# Deep Literature for Codex 0.1.0-rc.3

Windows x64 公测候选。本版统一更名为 Deep Literature for Codex，更新仓库地址、安装包名、实例页面、订阅页面和 Skill 展示说明；文献引擎与 rc.2 相同，旧实例和文库兼容。修复新用户安装与真实文献精读流程的阻断；保留 rc.1 历史附件。

## 变化

- 自动注册自有工作区，默认文献模式；完善启动反馈与安装进度。
- 保留失败任务原父任务身份；状态工具透传失败原因并保留原生输出格式，后台提交后明确轮询。
- 隔离中断前的 Codex turn 事件。
- MinerU 成功调用后持久验证状态，配置补齐后可续接；旧未完成解析事务升级，保留公式并恢复标题层级。
- full-review-v3 支持最终高亮替换初步标记；同步 Reader 渲染和发布校验，兼容 v2。
- Windows 状态文件短暂占用重试，重复入库回执保留分类。

## 下载和安装

下载本 Release 的 win-x64.zip、SHA256SUMS.txt、RELEASE-MANIFEST.json 和 ACCEPTANCE.md。ZIP 已内置配套 A 包；单独 TGZ 供开发和核对。不要使用自动生成的 Source code ZIP 安装。

解压后运行：

~~~powershell
powershell.exe -NoProfile -File .\install.ps1 -PluginArchive .\inputs\scientific-reading.tgz -InstallSkill
~~~

B/A 的准确源码提交与文件 SHA 见 RELEASE-MANIFEST.json，ZIP 内 BUILD-MANIFEST.json 逐文件校验。

## 已测与边界

同台 Windows 空目录安装、默认文献模式、分类与去重、PDF 续接、真实 MinerU、订阅 Luna 三批翻译与复核、正式 Reader 发布、HTTP SHA 和重启恢复已验证。最终候选空目录安装约216秒，启动约4.5秒；单次测试，网络和负载影响耗时。

真实模型流程中有管理员继续及纠错提示，尚未证明全程无人干预。Spark额度、其他 Windows 环境、逐句译文质量不在已完成验收内。没有替用户确认已读。详细记录见 docs/acceptance.md。
