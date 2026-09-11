<p align="center">

  <img src="docs/media/dlc-banner.svg" alt="DLC：文献获取、双语精读与长期积累" width="100%">
</p>

<h1 align="center">DLC · Deep Literature for Codex</h1>

<p align="center"><strong>在 Codex 里读论文，把理解留在自己的文献库。</strong></p>

<p align="center">
  <a href="docs/platforms.md#windows"><img src="https://img.shields.io/badge/Windows-x64-0078D4?style=flat-square" alt="Windows x64"></a>
  <a href="docs/platforms.md#macos--linux"><img src="https://img.shields.io/badge/macOS-Apple%20Silicon%20%7C%20Intel-555555?style=flat-square" alt="macOS Apple Silicon / Intel"></a>
  <a href="docs/platforms.md#macos--linux"><img src="https://img.shields.io/badge/Linux-x64%20%7C%20ARM64-555555?style=flat-square" alt="Linux x64 / ARM64"></a>
  <a href="https://github.com/TyrionH-is-coding/deep-literature-for-codex/releases/tag/v0.1.0-rc.6"><img src="https://img.shields.io/badge/Release-v0.1.0--rc.6-176b63?style=flat-square" alt="Release v0.1.0-rc.6"></a>
</p>

<p align="center">
  <a href="#近期更新">近期更新</a> ·
  <a href="#项目简介">项目简介</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="docs/getting-started.md">使用指南</a> ·
  <a href="#加入交流群">加入交流群</a> ·
  <a href="https://github.com/TyrionH-is-coding/deep-literature-for-codex/issues">反馈问题</a>
</p>

## 近期更新

> **2026.09.12 · v0.2.0-rc.2 候选版** — 从“生成阅读页”走向“边读、边问、边积累”：补齐阅读问答、随记与 Excel、按步骤选择模型、图片传输，以及四套主题和右侧栏。[查看 v0.2 使用指南 →](docs/v0.2-guide.md)

| 这次更新 | 现在可以怎样用 |
| --- | --- |
| **边读边问** | 在在线阅读页选中原文、译文或图注，点击“问 AI”或按 `Alt+Shift+E` 解释，继续追问并跳回引用段落。 |
| **随手记下想法** | “随记”和“问 AI”共用侧面板；摘录、写笔记、保存后打开 Excel，接着整理本文记录。 |
| **按步骤分配模型** | 翻译、导读、要点提取与讨论分别设置模型和思考深度。连接 Codex 且相应模型可用时，翻译默认 Luna，分析与讨论默认 Sol，思考深度默认 medium；模型列表随实际连接状态更新。 |
| **让模型看到论文图片** | 原生对话和“讨论此图”支持传递真实图片，图注与相关正文一起进入本篇会话。模型和图片能力以账号返回为准，列表包含 Astra 时即可选择。 |
| **让讨论跟着论文走** | 每篇论文保留自己的会话，重开后继续；也可选取多篇讨论进行综合，并保留来源。 |
| **更清爽的阅读空间** | 暖纸、纯白、深墨、雾蓝四套主题；文献库与设置使用右侧栏，阅读页左侧目录和导览可收起，按钮与提示更简洁。 |
| **把阅读页带走** | 导出包含正文、译文、公式和图片的单文件 HTML，在电脑或手机浏览器中离线阅读、分享。个人随记与对话不随文件导出。 |
| **按课题整理和发现文献** | 自定义 Excel 列、研究字段与阅读模板；文献雷达按研究方向发现候选论文，由你决定是否入库。 |
| **缺少全文时继续获取** | OA 未取得后，Codex 询问机构访问权限，协助在本人授权的浏览器中获取 PDF，再接回原任务。[正文获取流程](skills/deep-literature-for-codex/references/download.md) |

以上为 `main` 的 v0.2 候选功能，尚未发布 v0.2 安装包；当前公开包仍为 [v0.1.0-rc.6](https://github.com/TyrionH-is-coding/deep-literature-for-codex/releases/tag/v0.1.0-rc.6)。尝试候选版请按[源码测试步骤](docs/platforms.md#从-main-源码测试)操作，升级前备份完整文献库。

<details>
<summary><strong>已验证到哪里？</strong></summary>

已完成本地自动化回归、真实 DSH 宿主中的阅读与侧栏交互、模型连接状态和四套主题检查。当前适配 DSH `0.1.5-rc.1`。Codex 图片字节已通过真实进程与本地模拟模型端点校验；真实账号的 Astra 调用与识图效果、机构访问、真实旧库升级及各平台实机使用仍需继续验证。在线问答需要工作台运行；离线 HTML 用于阅读。

</details>

## 项目简介

**组会又要分享文献？开题又得精读文章？**

希望我开发的 **DLC（Deep Literature for Codex）** 能帮到你！

DLC 是一个由 **Codex 统筹、DeepSeek Harness（DSH）承载**的文献工作台。给它 DOI、论文链接或本地 PDF，就可以建立文献记录、获取可用全文、生成双语阅读页，再把证据和自己的思考积累下来。

**只需 Codex 订阅 + MinerU 免费 API Key，即可开始。** 支持 Windows、macOS 和 Linux，安装器会准备独立运行环境。

**DeepSeek API Key 可选**，用于切换翻译模型；**高校图书馆认证可选**，用于本人有权限访问的非 OA 论文。开放论文和手动导入 PDF 都可以直接开始。

## 我们的优势

1. **可读性强。** 生成交互式 HTML 阅读器，中文译文可按段点击展开或收起；AI 重点标注与原文跳转帮助定位证据，Figure / Table 支持统一预览，让正文、译文和图表连起来读。

2. **文献下载更便捷。** OA 全文优先自动获取；你完成高校或机构认证后，Codex 可通过已授权的浏览器会话，协助下载你有权访问的论文 PDF。登录与人机验证由本人完成，无法获取时也可以手动补入，接着精读。

3. **支持长期管理。** 论文的研究问题、方法、关键结论与证据、局限等 key points 保存到本地数据库，并汇总到 Excel。结合阅读进度、课题关系和个人笔记，便于长期管理、复习，逐步形成自己的知识沉淀。

4. **兼顾使用成本。** 支持在工作台授权接入已有的 Codex 订阅额度；v0.2 可将翻译交给 **GPT-5.6 Luna**，导读、重点提取和讨论交给 **GPT-5.6 Sol**，也可按步骤另选模型。MinerU 提供免费解析额度，其他模型 API 按需选配。同一 Codex 账号的额度共享。

**导入论文 → 获取正文 → 双语精读 → 记录与回顾 → 下次接着读。**

### 看看生成的阅读页

下面是此前用《[Attention Is All You Need](https://arxiv.org/abs/1706.03762)》实际生成的 HTML Reader：按章节导航，查看中文译文与英文原文，在正文中阅读图表。

![Attention Is All You Need 实测 HTML Reader：论文题名、章节目录、阅读导览与正文重点标注](docs/media/attention-reader.png)

截图来自既有阅读成果；[配图来源](docs/media/README.md)记录对应文件与截图方式。

## 快速开始

### 1. 让 Codex 帮你安装

在 Codex 新对话中复制发送：

```text
请帮我安装 DLC（Deep Literature for Codex）：
https://github.com/TyrionH-is-coding/deep-literature-for-codex

按我的系统和架构选择最新公开 Release 的安装包，核对 SHA256，
运行安装器并安装 Skill，然后启动工作台。
有内置浏览器工具时打开页面；需要账号授权时由我本人完成。
```

安装需要联网，无需预装 Node、Python 或 DSH。安装后使用 **`$deep-literature-for-codex`** 打开和管理工作台；新安装的 Skill 需要在新对话中使用。

<details>
<summary><strong>手动安装与源码测试</strong></summary>

从 [Releases](https://github.com/TyrionH-is-coding/deep-literature-for-codex/releases) 下载与你的系统和架构对应的压缩包，核对 `SHA256SUMS.txt`，解压后进入安装包目录。

| 系统 | 安装包后缀 | 安装入口 |
| --- | --- | --- |
| Windows x64 | `win-x64.zip` | `install.ps1` |
| macOS Apple Silicon / Intel | `darwin-arm64.tar.gz` / `darwin-x64.tar.gz` | `install.sh` |
| Linux ARM64 / x64 | `linux-arm64.tar.gz` / `linux-x64.tar.gz` | `install.sh` |

Windows：

```powershell
powershell.exe -NoProfile -File .\install.ps1 -PluginArchive .\inputs\scientific-reading.tgz -InstallSkill
```

macOS / Linux：

```sh
sh ./install.sh --plugin-archive ./inputs/scientific-reading.tgz --install-skill
```

**测试主线：** 按[源码测试步骤](docs/platforms.md#从-main-源码测试)取得 `main`，再运行对应安装器。源码已包含固定 SHA 的引擎包；仅 `git pull` 不会更新已安装的实例。升级时指向原来的安装目录。

详细的下载校验、运行条件、自定义目录与启停命令见[平台指南](docs/platforms.md)。

</details>

### 2. 配置模型与解析服务

v0.2 从工作台右上角打开 **“文献设置”**，连接 Codex 订阅并保存 MinerU Key；公开 v0.1 安装包的入口为“设置与状态”。

| 配置 | 用途 | 如何开始 |
| --- | --- | --- |
| **Codex 订阅** | 翻译、导读与讨论 | 打开工作台自己的 Codex 订阅入口，完成本人授权，再从实际返回的列表选择模型。[操作步骤](docs/getting-started.md#2-选择用于翻译的模型) |
| **MinerU 免费 API Key** | 将 PDF 解析成正文、图表与公式 | 在 MinerU 官网注册并取得 Token，在“全文解析”中保存。[配置教程](docs/mineru-api-key.md) |

MinerU 当前提供每天 **1,000 页最高优先级解析额度**，超出后降低优先级；单文件最多 **200 页、200 MB**。按每篇 10–20 页估算，约相当于每天 50–100 篇论文的高优先级解析。额度以账号页面为准，以上信息核对于 2026-09-08。[官方 API 说明](https://mineru.net/apiManage/docs)

v0.2 在“各步骤的模型与思考深度”中分别配置翻译、导读和讨论。连接 Codex 且相应模型可用时，翻译默认 **Luna**，分析与讨论默认 **Sol**；也可选择其他已连接服务的模型。思考深度默认 **medium**，不支持该档位的模型请选其支持的档位或“模型默认”。保存后从下一次请求生效。

工作台的订阅接入需要单独授权，与外层 Codex 使用同一账号时共享额度。高校认证只在需要获取受订阅保护的论文时，由本人在浏览器中完成。

### 3. 读第一篇论文

配置完成后，告诉 Codex：

```text
使用 DLC，创建“机器学习”分类。
把 Attention Is All You Need 加入这个分类并开始精读：
https://doi.org/10.48550/arXiv.1706.03762

先尝试获取开放获取 PDF，取得后继续解析、翻译与复核。
无法取得时告诉我需要补什么；完成后打开正式 Reader。
```

缺少全文时，提供自己有权使用的 PDF 路径，让 Codex **补入原任务并继续**。详细的模型选择、补 PDF 与中断续接步骤见[第一篇论文指南](docs/getting-started.md#第三步获取并精读第一篇论文)。

## 把阅读变成长久积累

读完以后，可以在 Excel 里留下：**阅读进度、与课题的关系、下一步、个人思考、个人理解程度、用户笔记**。以后按分类、关键词或阅读进度找回论文，从同一条记录打开 PDF、Reader 和图表。

![Excel 长期管理设计示例：文献、阅读进度、课题关联和下一步并列显示](docs/media/excel-library-demo.png)

*上图为合成数据的设计 Demo，展示长期管理方式；实际安装使用正式引擎生成总表。[示例说明](docs/media/README.md)*

| 工作表 | 你可以查看 |
| --- | --- |
| **文献** | 题录、分类、摘要、六项个人记录及阅读入口 |
| **阅读成果** | 研究问题、方法、关键结论、局限及其证据位置 |
| **图表索引** | 图表、图注、页码和有证据引用的关联成果 |
| **说明** | 可编辑字段与同步规则 |

修改个人记录后，**保存并关闭工作簿，再让 Codex 同步与刷新**。遇到文件占用或两边修改冲突时保留原表并提示处理。生成 Reader 不会自动把论文标成“已读”。[完整 Excel 教程 →](docs/excel-library.md)

## 我们的设计理念

### Agent-native：把重复劳动交给 Agent

让 Codex 统筹文献获取、整理入库、解析、翻译和记录同步，把能自动化的步骤串起来。用户把精力留给理解论文、提出问题和个人成长；需要本人授权或判断学术结论时，流程会回到你手中。

### 一切皆插件：用最小工具链组合所需能力

**DLC** 是 **Deep Literature for Codex** 的简称，也呼应了“扩展包”的意思：给 Codex 补上文献工作的能力。

它沿用 DSH“一切皆插件”的思路：文献流程由插件提供，DSH 承载会话与模型，Codex 通过 Skill 统筹整个文献库。尽量复用宿主已有能力，减少重复建设与安装负担；安装器为 DLC 准备独立的运行环境、配置和数据目录，与你已有的 DSH 安装分开。

```mermaid
flowchart LR
    C["Codex + DLC Skill<br/>文献库总管理"] --> D["独立 DSH 工作台<br/>分类会话 · 模型接入"]
    D --> P["文献插件<br/>入库 · 解析 · 精读"]
    P --> L[("本地文献库")]
    L --> R["Reader · 图表 · Excel"]
```

文献库以 SQLite 保存记录，Excel 是便于查看和有限回写的入口。程序和文献资产保存在本机；使用 MinerU API 时会上传 PDF，模型请求会将所需内容发送给所选服务。

已有 DSH、希望单独使用文献插件，可以查看 [Deep Literature for DSH](https://github.com/TyrionH-is-coding/deep-literature-for-dsh)。该插件只自动获取 OA 全文或接收本地 PDF；DLC 中的机构访问由外层 Codex 配合可用浏览器与本人授权处理。

## 版本进展

v0.2 的阅读问答、单篇会话、Figure 讨论、随记、模型分工、主题和文献雷达已进入候选版。后续重点是用真实账号与文献验证模型调用、识图和升级，再补齐各平台实机验收。[使用与迁移指南](docs/v0.2-guide.md) · [版本路线与验收范围](docs/roadmap-v0.2.md)

安装包与主线改动的区别见[平台指南](docs/platforms.md#从-main-源码测试)，更新详情见[发布说明](docs/release-notes.md)。实际使用中仍可能需要继续或纠错提示，译文与结论请结合原文判断。[验证记录](docs/acceptance.md) · [模型测试](docs/model-tests.md)

## 常见问题

<details>
<summary><strong>所有论文都能自动下载吗？</strong></summary>

自动流程只获取有开放来源依据的 OA 全文，当前固定流程默认使用 arXiv 和 Europe PMC。机构文献取决于本人访问权限、浏览器工具和网站状态；遇到登录或验证时由本人处理，也可以手动下载后补入原任务。

ScanSci PDF 上游的所有来源和登录功能并未全部启用；Unpaywall 所需的联系邮箱尚无工作台配置入口。[全文获取说明](docs/getting-started.md#scansci-pdf-如何帮你取得全文)

</details>

<details>
<summary><strong>已经安装了 DSH，或已经登录 Codex，还需要配置吗？</strong></summary>

DLC 使用独立 DSH 实例，不自动读取其他 DSH 的配置或外层 Codex 登录。请在工作台配置模型 API，或通过工作台订阅页完成本人授权；可用模型以实际账号返回为准。

</details>

<details>
<summary><strong>以后怎么继续？换机器怎么带走文献？</strong></summary>

告诉 Codex“使用 DLC 打开原来的工作台，从这篇论文当前进度继续”。关闭浏览器不会停止后台，端口也可能变化，请使用本次启动返回的地址。

迁移时备份完整文献库；只复制 Excel 不包含 PDF、Reader 和任务数据。模型授权与 MinerU Key 需要在新机器重新配置。[备份、升级与恢复](docs/lifecycle.md)

</details>

## 加入交流群

欢迎加入 **Deep Literature 用户交流群**，交流安装配置、论文精读和 Excel 文献管理经验，也欢迎分享使用反馈与改进建议。

使用微信扫描下方二维码入群；如需查看大图，点击图片即可。

<p align="center">
  <a href="docs/media/wechat-community-qr.jpg">
    <img src="docs/media/wechat-community-qr.jpg" alt="Deep Literature 用户交流群微信入群二维码，2026 年 9 月 15 日前有效" width="360">
  </a>
</p>

当前二维码标注 **2026 年 9 月 15 日前有效**。如果二维码已失效或无法入群，请通过 [GitHub Issues](https://github.com/TyrionH-is-coding/deep-literature-for-codex/issues) 提醒我们更新。需要跟踪处理的 Bug，也请在 Issues 中留下复现步骤。

## 文档与参与

| 我想…… | 从这里开始 |
| --- | --- |
| 从安装到第一篇精读完整走一遍 | [使用指南](docs/getting-started.md) |
| 在 Windows、Mac 或 Linux 安装、测试主线 | [平台指南](docs/platforms.md) |
| 配置解析与模型 | [MinerU Key](docs/mineru-api-key.md) · [订阅接入](docs/oauth.md) |
| 管理笔记、同步总表与迁移数据 | [Excel 教程](docs/excel-library.md) · [生命周期](docs/lifecycle.md) |
| 了解后续计划或参与改进 | [v0.2 路线](docs/roadmap-v0.2.md) · [Issues](https://github.com/TyrionH-is-coding/deep-literature-for-codex/issues) |

欢迎提交使用反馈、文档改进与修复。报告问题时附上版本、系统、复现步骤、错误文字及去除凭据的截图；工程验证可运行 `npm test`，OAuth 测试和跨平台安装步骤见 [CI](https://github.com/TyrionH-is-coding/deep-literature-for-codex/blob/main/.github/workflows/ci.yml) 与[安装工作流](https://github.com/TyrionH-is-coding/deep-literature-for-codex/blob/main/.github/workflows/platform-install.yml)。

## 致谢与许可

DLC 基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 构建，使用 [MinerU](https://github.com/opendatalab/MinerU) 解析论文；OA 获取接入 [ScanSci PDF](https://github.com/Rimagination/scansci-pdf) 的固定模块（Apache-2.0），订阅接入基于 [DSH OpenAI OAuth](https://github.com/DGPisces/dsh-openai-oauth) 与官方 Codex CLI。

本项目控制代码与 Skill 使用 **[BSD-3-Clause](LICENSE)**。各依赖保留其原有许可，完整说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
