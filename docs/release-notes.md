# Codex 文献工作台 0.1.0-rc.2

Windows x64 公测候选。修复新用户安装与真实文献精读流程的阻断；保留 rc.1 历史附件。

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
