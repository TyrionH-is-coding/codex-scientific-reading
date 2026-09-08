# DLC 使用指南

[返回项目首页](../README.md) · [跨平台安装](platforms.md) · [Excel 长期管理](excel-library.md)

DLC 是 Deep Literature for Codex 的简称。本文保留安装、首次配置、论文精读、Excel 同步和排错的完整步骤。管理能力对应当前 main；已发布安装包与开发候选的区别见[首页版本说明](../README.md#版本与路线)。

## 使用前准备

| 需要什么 | 用来做什么 |
| --- | --- |
| Windows x64、macOS 或 Linux + Codex 环境 | 安装和管理工作台；内置浏览器联动需要 Codex 提供页面操作工具，平台与架构见 [兼容性指南](platforms.md) |
| 工作台自己的模型配置 | 翻译和生成导读：使用支持的 Codex 订阅登录，或配置模型 API |
| MinerU API Key | 将 PDF 解析成正文、图表和公式；[从注册到配置的教程](mineru-api-key.md) |
| Excel 桌面版（使用总表时） | 打开文献总表、筛选和编辑个人记录；不装 Excel 也能入库和使用 Reader |

安装需要联网，**不需要预装 Node、Python、DSH 或 scansci-pdf**，安装器会准备依赖。日常使用不用单独运行 scansci-pdf 命令，也不用另装它的 MCP 服务。

可以先安装再配置模型和 MinerU。完整精读需要两者都配置好；模型和解析服务使用你自己的账号额度，项目不会附送额度。

## 第一步：下载安装

### 推荐：让 Codex 帮你安装

在 **Codex 的新对话**中复制发送：

```text
请帮我安装 Deep Literature for Codex：
https://github.com/TyrionH-is-coding/deep-literature-for-codex

请按我的操作系统和架构选择 rc.6 Release 安装包，核对 SHA256，
解压后运行安装器并安装 Skill。
完成后启动并核对实例，有内置浏览器工具时打开工作台；
没有该工具时给出浏览器访问链接。
需要账号登录时，由我本人完成。
```

后续安装、打开工作台和管理文献的指令，都发在这个 **Codex 对话**中。账号授权和模型选择则在工作台网页中完成。

### 也可以手动安装

**下面是 Windows 步骤。macOS/Linux 请按 [跨平台安装指南](platforms.md) 使用 `install.sh`。**

1. 打开 [rc.6 下载页](https://github.com/TyrionH-is-coding/deep-literature-for-codex/releases/tag/v0.1.0-rc.6)，展开 **Assets**。
2. 下载 **deep-literature-for-codex-0.1.0-rc.6-win-x64.zip** 和 **SHA256SUMS.txt**。ZIP 已内置文献引擎，无需另下 TGZ。不要下载自动生成的 Source code ZIP。
3. 在下载目录打开 PowerShell，运行下面的命令，将结果与 SHA256SUMS.txt 中 ZIP 对应的一行比较：

```powershell
Get-FileHash .\deep-literature-for-codex-0.1.0-rc.6-win-x64.zip -Algorithm SHA256
```

4. 完整解压 ZIP。进入**能看到 install.ps1 的文件夹**，在该目录打开 PowerShell，执行：

```powershell
powershell.exe -NoProfile -File .\install.ps1 -PluginArchive .\inputs\scientific-reading.tgz -InstallSkill
```

默认安装到 `%USERPROFILE%\CodexScientificReading`。等待终端返回安装结果；网络和机器速度会影响耗时，各系统的实测记录见 [安装耗时与验收](acceptance.md)。

5. 安装完成后，在 Codex 对话中发送：

```text
使用 $deep-literature-for-codex 打开 Deep Literature for Codex。
请核对实例身份，并在内置浏览器打开工作台。
```

**看到工作台页面、当前模式显示“文献模式”，就可以继续下一步。** 如果当前对话找不到刚安装的 Skill，可以新建对话再尝试，或把安装目录告诉 Codex，让它检查安装结果。

> Skill 入口已统一为 `$deep-literature-for-codex`。升级时会迁移本实例安装且未修改的旧 Skill；用户定制的旧 Skill 会保留并报告。安装根目录仍保留 `CodexScientificReading`，继续使用原文献库与实例配置。安装后请在新的 Codex 对话中使用新入口。

## 第二步：配置解析服务和模型（首次使用）

两项分别负责 PDF 解析和文字生成，**只配其中一项还不能完成精读**。

### 1. 获取并保存 MinerU Key

还没有 Key 时，先完成这几步：

1. 打开 [MinerU 官网](https://mineru.net/)，注册或登录自己的账号。
2. 进入 **API 管理 → Token**，按页面提示创建 Token；已有可用 Token 时直接复制。若页面要求申请 API 权限，先完成页面上的申请。
3. 回到工作台，保存复制的 Token。这里的 **MinerU API Key 就是这个 Token**，只粘贴密钥本身，不加 `Bearer` 前缀。

申请入口与鉴权方式见 [MinerU 官方 API 文档](https://mineru.net/apiManage/docs)。完整操作、如何确认可用及失效后的处理见 **[MinerU API Key 获取与配置教程](mineru-api-key.md)**。

在 Codex 对话中发送：

```text
请打开 Deep Literature for Codex 的“设置与状态”页面。
我来填写并保存 MinerU API Key，请检查保存后的配置状态。
```

在打开的 **“设置与状态” → “全文解析”** 设置组中，将 Token 粘贴到 **“粘贴 MinerU API Key”** 输入框，点击 **“保存密钥”**。保存成功表示已配置；首次真实解析成功后，工作台才会记录 API 调用已验证。

### 2. 选择用于翻译的模型

**使用 Codex 订阅：**

1. 对 Codex 说：“请打开这个工作台的 Codex 订阅登录与额度页面。”
2. 在实际工作台 URL 后加 `/api/codex-oauth/ui` 打开登录页，依次点击“使用 ChatGPT 登录”和“打开 OpenAI 授权页”，由你本人完成官方授权。外层 Codex 已登录不代表本实例已登录。
3. 授权成功后，返回工作台，在会话的**模型选择器**中选择 `openai-codex` 提供方及可用模型。

外层 Codex 已登录，不代表工作台也已登录。这里需要独立授权，同一账号的额度仍然共享。模型是否可用，以登录后实际显示的列表和额度为准。

**使用模型 API：** 在工作台的 **Settings（设置）** 中配置你的模型服务，再在会话模型选择器中选中它。配置的是工作台内的模型，不是外层 Codex 对话使用的模型。

## 第三步：获取并精读第一篇论文

### scansci-pdf 如何帮你取得全文？

**先给论文标识，让工作台尝试找正文。** scansci-pdf 已随安装包接入；精读任务会先检查已有 PDF，没有时尝试自动获取，再进入 MinerU 解析。

| 你手上有什么 | 操作方式 |
| --- | --- |
| DOI、arXiv 链接 | 交给 Codex 核对题录、入库并开始精读，工作台尝试获取 OA PDF |
| 已下载的正文 PDF | 提供本地路径，交给 Codex 关联到该论文；已有等待任务时补入原任务继续 |
| 需要机构访问的论文 | 告诉 Codex 你有权使用的出版社或机构入口；由你本人完成登录，再通过可用浏览器能力获取 PDF，或自行下载后补入 |

当前发行版的自动获取使用 scansci-pdf 的固定 OA 流程，默认尝试 **arXiv、Europe PMC** 的开放获取全文。找不到全文时会保留条目并等待 PDF，不会把网页当作正文继续解析。

[scansci-pdf 上游](https://github.com/Rimagination/scansci-pdf) 还提供其他来源、机构登录和独立工具能力；**本工作台 rc.6 未自动启用上游全部功能，CARSI/WebVPN 也不是安装后就已接通。** 引擎保留了 Unpaywall 支持，但本工作台尚未提供所需联系邮箱的配置入口。机构全文是否能取得，取决于你的访问权限、当前浏览器工具与网站状态。

### 复制这段，开始第一篇

配置完成后，在 **Codex 对话**中复制发送：

```text
使用 Deep Literature for Codex，创建“机器学习”分类。
把 Attention Is All You Need 加入这个分类并开始精读：
https://doi.org/10.48550/arXiv.1706.03762

请先尝试通过内置 scansci-pdf 获取开放获取 PDF；
取得后继续解析和精读，无法取得时告诉我需要补什么。
如果需要我选择模型，请打开对应会话。
请跟进任务状态，完成后打开正式 Reader。
```

Codex 会创建分类及对应的管理会话，导入论文并启动任务。已有相同论文时会去重。

**如果提示缺少 PDF：** 下载你有权使用的正文 PDF，将文件提供给 Codex，或发送实际文件路径：

```text
这篇论文的 PDF 在 C:\Users\你的用户名\Downloads\attention.pdf。
请把它补入刚才的任务，继续原任务，不要新建重复论文。
```

上面的路径只是例子，请替换成真实路径。自动获取只覆盖可取得的开放获取全文，不是所有 DOI 都能自动下载 PDF。

**如果已经选好模型，但任务还没继续：**

```text
模型已经配置好了。请检查“机器学习”分类中刚才的任务，
从当前进度继续，完成后打开 Reader。
```

精读会经过 PDF 解析、分批翻译、复核与 Reader 生成。**以正式 Reader 成功打开为完成结果**，不要只凭聊天里一句“完成了”判断。

## 第四步：用 Excel 长期管理文献

工作台维护一份 **scientific-reading.xlsx 文献总表**，将不断积累的论文、阅读状态和个人记录放在一起。你可以按年份、分类或理解程度筛选，从表中打开已有 PDF、Reader 和图表，再把自己的思考留在对应论文这一行。

### 打开总表，写下自己的记录

1. 在文献列表找到论文，点击 **“定位 Excel”**；也可以让 Codex 打开本实例的总表。系统会用本机关联的表格软件打开文件；能否自动选中对应行取决于本机 Excel 自动化支持，未选中时按论文名查找。
2. 在 **“文献”** 工作表中，填写浅黄色的六列：

   | 可编辑列 | 可以写什么 |
   | --- | --- |
   | **阅读进度** | 未读、在读、已读、待复读 |
   | **与课题的关系** | “为课题里的细胞募集假设提供一种验证方法。” |
   | **下一步** | “核对 Figure 2 的对照组，再决定是否复用方法。” |
   | **个人思考** | “可以把这里的消融实验用于我的课题；需要补一个对照组。” |
   | **个人理解程度** | “已通读，公式部分待复习”或自己的分级文字 |
   | **用户笔记** | “下次重看 Figure 2，并与另一篇方法比较。” |

3. **保存并关闭工作簿**，然后在 Codex 对话发送：

```text
我已保存并关闭 Deep Literature for Codex 的 Excel 总表。
请按仓库 docs/excel-library.md 的同步步骤导入个人记录并刷新总表，
检查结果是否为 success，再打开让我确认。
```

刷新会先核对已保存的个人记录与库内变更，再生成最新总表。**这不是实时同步**；未保存的 Excel 内容不会写回。文件占用时等待保存关闭；两边修改冲突时保留双方与原表，并说明需要处理的字段。

### 总表里还能看什么？

| 工作表 | 用途 |
| --- | --- |
| **文献** | 查看题录、分类、标签、中英摘要、阅读状态，点击来源、PDF 与精读 HTML 链接 |
| **阅读成果** | 查看研究问题、方法、关键结论、局限及确认记录；区分 AI 导读和个人确认，保留证据位置 |
| **图表索引** | 按当前 PDF 查找图表、图注和页码；截图与结构表同一行，关联有明确证据引用的成果 |
| **说明** | 查看哪些字段可编辑以及同步规则 |

**只支持上述六列个人记录回写。** 分类、标签、题录等由工作台维护，请通过 Codex 修改。支持整表筛选与排序；不要单独移动部分列、改隐藏标识或删除论文行。阅读进度由你维护，生成 Reader 不会自动标成已读。做自定义统计时另存分析副本。

默认总表在 `%USERPROFILE%\CodexScientificReading\library\library\scientific-reading.xlsx`，两个 `library` 是当前目录结构。只保存这个 XLSX 不包含完整 PDF、Reader 和任务数据；换机前要备份整个文献库。

详细的打开方式、手动刷新命令、字段范围、待同步处理和备份步骤见 **[Excel 长期管理教程](excel-library.md)**。

## 以后怎么用？

下面这些话都可以直接发给 Codex；把分类名、论文和路径换成自己的。

| 想做什么 | 可以怎么说 |
| --- | --- |
| 再打开工作台 | “打开 Deep Literature for Codex，恢复已有分类和任务。” |
| 添加论文 | “把这个 DOI 加入‘免疫学’分类并开始精读：……” |
| 处理一组论文 | “把下面这些 DOI 逐篇核对、去重并归入‘课题 A’，开始精读；列出取得全文和待补 PDF 的论文。” |
| 获取机构全文 | “这篇论文我有学校访问权限，请通过我提供的机构入口尝试获取 PDF，登录由我完成。” |
| 查看进度 | “检查‘免疫学’分类的任务，告诉我哪些完成、哪些需要我处理。” |
| 继续失败任务 | “检查这篇论文失败的原因，修正后从原任务继续。” |
| 再看阅读页 | “打开 Attention Is All You Need 的已有 Reader。” |
| 调整分类 | “把这篇论文移动到‘方法学’分类。” |
| 打开 Excel | “打开本实例的 scientific-reading.xlsx 文献总表，我要记录阅读笔记。” |
| 同步 Excel 笔记 | “我已保存关闭 Excel，请按 Excel 教程导入个人记录并刷新总表，报告同步结果。” |
| 保存整理结论 | “围绕这篇论文建立整理会话，讨论后由我确认需要长期保留的结论和证据。” |
| 关闭后台 | “停止 Deep Literature for Codex 的后台服务。” |

分类请交给 Codex 创建和管理。直接在工作台点 **New session** 创建的普通会话，没有自动绑定文献分类。

关闭浏览器标签页不会停止后台服务。下次让 Codex 打开即可；端口可能变化，请使用本次启动返回的地址，不要一直收藏某个固定端口。

## 卡住时先看这里

| 现象 | 下一步 |
| --- | --- |
| 安装下载很慢 | 看终端当前阶段和进度，检查网络；不要同时重复运行安装器 |
| 启动报告 start_timeout | 让 Codex 检查工作台 status 和日志；可能仍在加载，不要立刻重装 |
| 提示没有浏览器能力 | 让 Codex 探测当前内置浏览器工具；找不到 browser Skill 名称不等于页面工具不可用 |
| 工作台模型不可用 | 检查本工作台是否已登录/配置服务，以及当前会话是否已选中模型 |
| MinerU 凭据或额度有问题 | 在“设置与状态”检查 Key 和服务额度，修正后继续原任务 |
| 不知道在哪里申请 MinerU Key | 按 [获取与配置教程](mineru-api-key.md) 从官网 API 管理页面创建 Token |
| 一直等 PDF | 提供正文 PDF 的真实路径，并要求补入原任务 |
| Excel 没有更新或显示待同步 | 保存并关闭工作簿，按 [Excel 教程](excel-library.md) 刷新并检查结果 |
| 会话不能调用文献工具 | 让 Codex 核对分类和管理会话绑定，不要在普通新会话中反复重试 |
| 模型停在中间 | 让 Codex 检查任务状态并从当前进度继续；公测版仍可能需要继续或纠错提示 |

需要反馈时，在 [Issues](https://github.com/TyrionH-is-coding/deep-literature-for-codex/issues) 提供版本、操作步骤、错误文字，以及不含凭据的截图或日志。

## 数据保存与升级

论文、PDF 和 Reader 默认保存在 `%USERPROFILE%\CodexScientificReading\library`。模型配置和登录状态保存在该工作台自己的目录中，与其他 DSH 安装分开。

升级时，下载新发行包，将安装器指向**原来的安装目录**。备份、迁移、回退与卸载步骤见 [生命周期指南](lifecycle.md)。MinerU Key 不随文献备份迁移。
