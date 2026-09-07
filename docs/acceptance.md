# Deep Literature for Codex 验收记录

## rc.4 跨平台发行包验收（2026-09-07）

代码基线：工作台 B `47b2202a44a34adfeb04d15367ea284f679a2b72`；文献引擎 A `5a1566267fff0b5ef65564ae794ac85f61d7b88c`。最终发行在此基础上补充文档；运行代码不再变化。发行包的准确源码提交、每个文件及压缩包 SHA256 见发行附件 `RELEASE-MANIFEST.json`、`PACKAGE-VERIFY.json` 和包内 `BUILD-MANIFEST.json`。

### 结果与证据

- [引擎、插件与资源 CI](https://github.com/TyrionH-is-coding/dsh-scientific-reading/actions/runs/34089305824)：Windows、两种 macOS 架构、两种 Linux 架构，5/5 通过。
- [工作台和 OAuth CI](https://github.com/TyrionH-is-coding/deep-literature-for-codex/actions/runs/34090648055)：五个平台共 10/10 作业通过。
- [发行包真实安装 CI](https://github.com/TyrionH-is-coding/deep-literature-for-codex/actions/runs/34090648053)：5/5 通过。先打包、解压并逐文件核对，再从解压目录运行安装器；涵盖发行文件布局和 BUILD-MANIFEST 校验。
- 用户当前 Windows 机器另外执行相同发行包流程，使用独立空目录与独立 Skill 目录：通过。安装目录包含中文和空格，原有文库与真实账号配置未用于该测试。

每个平台均通过 15 项检查：运行时架构、真实服务启动、HTTP 实例身份、网页响应、重复启动复用进程、引擎入库、生成 XLSX、原生凭据保存/读取/删除、刷新总表、笔记写回数据库、完整备份、重启身份保持、重装数据保持、卸载后文库与 XLSX 保留、安装状态退役。

凭据检查实际调用 Windows DPAPI、macOS Keychain 和 Linux Secret Service，使用合成测试 Token。macOS runner 使用临时解锁钥匙串，Linux runner 使用 D-Bus 会话与 GNOME Keyring。测试没有把不可用的密钥服务替换为明文文件。

### 耗时（秒）

| 环境 | 空目录安装 | 首次启动 | 停止 | 再次启动 | 原目录重装 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Windows x64（GitHub runner） | 354.51 | 2.96 | 0.69 | 2.91 | 0.81 |
| macOS 14 · Apple Silicon | 23.14 | 0.89 | 0.09 | 0.89 | 2.01 |
| macOS 15 · Intel | 49.55 | 1.47 | 0.18 | 1.48 | 3.47 |
| Ubuntu 22.04 · x64 | 30.89 | 1.23 | 0.16 | 1.25 | 2.06 |
| Ubuntu 24.04 · ARM64 | 23.00 | 1.10 | 0.12 | 1.10 | 1.50 |
| Windows x64（本次用户机器、独立空目录） | 243.53 | 5.75 | 1.44 | 6.87 | 1.51 |

以上为各环境的一次实测。安装计时包含下载与依赖安装；重装使用原运行时和缓存。网络位置、下载速度、磁盘与安全软件会影响结果，不能据此比较操作系统性能或承诺固定耗时。完整原始检查列表和毫秒精度的秒数见发行附件 `ACCEPTANCE.json`；CI 日志保存在该次运行的 Artifacts 中。

### 本次遇到并修复的问题

| 问题 | 修复与验证 |
| --- | --- |
| 安装器和启动入口只覆盖 Windows | 增加四个 Unix 平台的安装包、固定运行时、启动/停止、恢复/回退和卸载入口；五个平台真实安装通过 |
| MinerU 密钥只支持 Windows DPAPI | macOS Keychain、Linux Secret Service 按实例保存；未配置时不主动访问钥匙串；真实原生服务回读通过 |
| Excel 打开依赖 Windows，且总提示已选中对应行 | macOS/Linux 使用系统关联软件，未选行时提示手动查找；XLSX 生成和笔记回写在五个平台通过 |
| Unix 退出后的僵尸进程被当作仍在运行 | 修正 Linux/macOS 进程存活检查和 macOS 进程身份识别；后台任务与完整引擎回归通过 |
| 安装路径太长会超出 Unix socket 长度限制 | 使用当前用户专用的短 socket 目录，并检查所有权与遗留连接；原生长路径/异常退出测试通过 |
| Windows 中文目录解压失败 | 为系统 tar 使用 ASCII 相对归档路径；中文与空格安装目录实测通过 |
| Windows PowerShell 5.1 卸载超长依赖路径失败 | 使用 .NET 扩展路径并保留边界校验；回归验证长路径、只读文件与不遍历文库 junction，完整卸载再验通过 |
| 旧插件测试使用 where.exe，Unix 测试误改全局系统平台 | 改为跨平台 Python 定位，并隔离 Windows API 模拟；五个平台完整回归通过 |

### 验收范围

本次新增的是各系统原生环境中的安装、服务、系统凭据和文库/表格数据链路验收。XLSX 通过真实引擎与 openpyxl 编辑/刷新；没有人工打开各系统的 Excel 界面，也未在 macOS/Linux 完成 Codex 桌面浏览器操作、订阅模型调用和真实 MinerU 云解析。下方保留之前 Windows 上真实 MinerU + Luna + Reader 的验收记录，不能把它当作这次所有系统均已重跑的证明。

Linux 使用 glibc 发行版，保存密钥需要可用且已解锁的 Secret Service；平台选择、安装命令与文件打开差异见 [跨平台指南](platforms.md)。

---

rc.3 为产品改名版本，A 引擎与 rc.2 完全相同。下方保留 rc.2 的真实模型验收证据，rc.3 的安装及展示核验见发行附件。

# rc.2 修复与真实验收（2026-09-06）

基线：B 695a301；A 5c6fc0c。候选安装包已在原实例升级运行，原数据、分类与主管会话保留。

## 修复
- 原 full_read_parent_mismatch 的丢失/被替换父任务恢复，严格保留 scope 和 PDF 身份检查。
- sr_job_status 原生工具回执和错误透传；继续操作返回 accepted/poll，避免旧状态误判。
- 中断后过滤旧 Codex turn 的 started/delta/completed 事件。
- MinerU 首次真实 API 成功后持久记录 verified；保存 Key 后允许原任务继续。
- 未完成旧解析事务升级到 normalization v4：正文保留 5 个公式，24 个标题层级复核；失败可回滚。
- full-review-v3 允许最终复核替换过密的初始高亮；保持 v2 兼容，Reader 渲染与文库发布均验证版本及哈希。
- Windows 短暂文件占用读写重试；去重回执保留分类；工作区/文献默认模式、安装及发布说明。

## 实测
- 空目录安装并启动：通过。默认文献模式、分类自动关联工作区、入库去重、公开 PDF 补入同一任务：通过。
- 新实例真实 MinerU 云解析：通过，api_call_verified=true；没有复制其他实例的订阅凭据。
- 原失败 Attention Is All You Need 任务使用已登录订阅的 Luna：3 批、117 条翻译，12 个最终高亮与 4 类导读，正式任务 completed。
- 此过程包含管理员提示模型继续和纠正提交，不能视为全程无人干预测试。
- 原任务 Reader 已通过原生接口 HTTP SHA 校验，在 Codex 内置浏览器打开，中英切换正常，所查页面无 console error。
- 停止后重新启动：实例身份保留，Reader URL 可用，Reader SHA 不变。
- PDF SHA256: bdfaa68d8984f0dc02beaca527b76f207d99b666d31d1da728ee0728182df697
- Reader SHA256: aa40cdb443dd1d22392d97bfcbda1b095375e9966ad77b2b933c8949dea4c9d1
- A 完整回归 404 passed / 1 skipped；最后 Reader 发布修正相关 25 passed；离线与资源检查通过。
- B 44/44、OAuth 32/32、实际 DSH 原生交接与隔离 20/20 通过。


## 最终空目录安装补验（2026-09-07）

最终候选07再次安装到空目录，初始文库为空、默认文献模式、分类绑定、去重、重启恢复通过。安装215.59秒，首次start 4.533秒，停止0.301秒，再次启动4.754秒；应用与配置隔离，不是OS虚拟机。前半安装阶段用日志时间估算，应用调用用单调时钟计时。测试脚本的内部回执断言修正后通过，保留真实首次启动计时。

发行构建若只修改文档和源码溯源元数据，以上真实模型验收适用于相同A包与运行时代码。发行ZIP的逐文件回读另记录于PACKAGE-VERIFY.json。仍须校验该发行构建的安装自检与启动。
