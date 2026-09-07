# Deep Literature for Codex

**在 Codex 里交代阅读任务，把论文整理成可以反复打开的中英双语阅读页。**

给它论文 DOI、链接或本地 PDF，让 Codex 建立分类、导入论文并安排精读。工作台保存论文、翻译、导读和重点标记，下次打开时可以接着处理原来的任务。

**当前版本：Windows 公测版 rc.3。** [下载安装包](https://github.com/TyrionH-is-coding/deep-literature-for-codex/releases/tag/v0.1.0-rc.3) · [反馈问题](https://github.com/TyrionH-is-coding/deep-literature-for-codex/issues)

## 你会得到什么？

以 *Attention Is All You Need* 为例，完整使用过程是：

**创建“机器学习”分类 → 导入论文 → 提供 PDF → 解析与翻译 → 打开 Reader。**

Reader 是保存在本机的论文阅读页。你可以切换英文/中英显示，查看导读与目录，阅读带重点标记的正文。已有阅读页可以再次打开，不用每次重新处理。

## 使用前准备

| 需要什么 | 用来做什么 |
| --- | --- |
| Windows x64 + Codex 桌面端 | 安装和管理工作台；Codex 需要能打开并操作内置浏览器页面 |
| 工作台自己的模型配置 | 翻译和生成导读：使用支持的 Codex 订阅登录，或配置模型 API |
| MinerU API Key | 将 PDF 解析成正文、图表和公式 |

安装需要联网，**不需要预装 Node、Python 或 DSH**，安装器会准备依赖。

可以先安装再配置模型和 MinerU。完整精读需要两者都配置好；模型和解析服务使用你自己的账号额度，项目不会附送额度。

## 第一步：下载安装

### 推荐：让 Codex 帮你安装

在 **Codex 桌面端的新对话**中复制发送：

```text
请帮我安装 Deep Literature for Codex：
https://github.com/TyrionH-is-coding/deep-literature-for-codex

请下载 rc.3 Release 中的 Windows 安装包，核对 SHA256，
解压后运行安装器并安装 Skill。
完成后启动工作台，在内置浏览器打开并核对实例。
需要账号登录时，由我本人完成。
```

后续安装、打开工作台和管理文献的指令，都发在这个 **Codex 对话**中。账号授权和模型选择则在工作台网页中完成。

### 也可以手动安装

1. 打开 [rc.3 下载页](https://github.com/TyrionH-is-coding/deep-literature-for-codex/releases/tag/v0.1.0-rc.3)，展开 **Assets**。
2. 下载 **deep-literature-for-codex-0.1.0-rc.3-win-x64.zip** 和 **SHA256SUMS.txt**。ZIP 已内置文献引擎，无需另下 TGZ。不要下载自动生成的 Source code ZIP。
3. 在下载目录打开 PowerShell，运行下面的命令，将结果与 SHA256SUMS.txt 中 ZIP 对应的一行比较：

```powershell
Get-FileHash .\deep-literature-for-codex-0.1.0-rc.3-win-x64.zip -Algorithm SHA256
```

4. 完整解压 ZIP。进入**能看到 install.ps1 的文件夹**，在该目录打开 PowerShell，执行：

```powershell
powershell.exe -NoProfile -File .\install.ps1 -PluginArchive .\inputs\scientific-reading.tgz -InstallSkill
```

默认安装到 `%USERPROFILE%\CodexScientificReading`。等待终端返回安装结果；一次实测约 3 分 36 秒，网络和机器速度会影响耗时。

5. 安装完成后，在 Codex 对话中发送：

```text
使用 $codex-scientific-reading 打开 Deep Literature for Codex。
请核对实例身份，并在内置浏览器打开工作台。
```

**看到工作台页面、当前模式显示“文献模式”，就可以继续下一步。** 如果当前对话找不到刚安装的 Skill，可以新建对话再尝试，或把安装目录告诉 Codex，让它检查安装结果。

> 产品已改名，但 `$codex-scientific-reading` 仍是兼容调用入口，安装目录也保留旧名称。这是正常的。

## 第二步：配置解析服务和模型（首次使用）

两项分别负责 PDF 解析和文字生成，**只配其中一项还不能完成精读**。

### 1. 保存 MinerU Key

在 Codex 对话中发送：

```text
请打开 Deep Literature for Codex 的“设置与状态”页面。
我来填写并保存 MinerU API Key，请检查保存后的配置状态。
```

在打开的页面中填写并保存 Key。保存成功表示已配置；首次真实解析成功后，工作台才会记录 API 调用已验证。

### 2. 选择用于翻译的模型

**使用 Codex 订阅：**

1. 对 Codex 说：“请打开这个工作台的 Codex 订阅登录与额度页面。”
2. 在页面发起登录，由你本人完成官方授权。
3. 授权成功后，返回工作台，在会话的**模型选择器**中选择 `openai-codex` 提供方及可用模型。

外层 Codex 已登录，不代表工作台也已登录。这里需要独立授权，同一账号的额度仍然共享。模型是否可用，以登录后实际显示的列表和额度为准。

**使用模型 API：** 在工作台的 **Settings（设置）** 中配置你的模型服务，再在会话模型选择器中选中它。配置的是工作台内的模型，不是外层 Codex 对话使用的模型。

## 第三步：处理第一篇论文

配置完成后，在 **Codex 对话**中复制发送：

```text
使用 Deep Literature for Codex，创建“机器学习”分类。
把 Attention Is All You Need 加入这个分类并开始精读：
https://doi.org/10.48550/arXiv.1706.03762

如果缺少 PDF，请告诉我；如果需要我选择模型，请打开对应会话。
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

## 以后怎么用？

下面这些话都可以直接发给 Codex；把分类名、论文和路径换成自己的。

| 想做什么 | 可以怎么说 |
| --- | --- |
| 再打开工作台 | “打开 Deep Literature for Codex，恢复已有分类和任务。” |
| 添加论文 | “把这个 DOI 加入‘免疫学’分类并开始精读：……” |
| 查看进度 | “检查‘免疫学’分类的任务，告诉我哪些完成、哪些需要我处理。” |
| 继续失败任务 | “检查这篇论文失败的原因，修正后从原任务继续。” |
| 再看阅读页 | “打开 Attention Is All You Need 的已有 Reader。” |
| 调整分类 | “把这篇论文移动到‘方法学’分类。” |
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
| 一直等 PDF | 提供正文 PDF 的真实路径，并要求补入原任务 |
| 会话不能调用文献工具 | 让 Codex 核对分类和管理会话绑定，不要在普通新会话中反复重试 |
| 模型停在中间 | 让 Codex 检查任务状态并从当前进度继续；公测版仍可能需要继续或纠错提示 |

需要反馈时，在 [Issues](https://github.com/TyrionH-is-coding/deep-literature-for-codex/issues) 提供版本、操作步骤、错误文字，以及不含凭据的截图或日志。

## 数据保存与升级

论文、PDF 和 Reader 默认保存在 `%USERPROFILE%\CodexScientificReading\library`。模型配置和登录状态保存在该工作台自己的目录中，与其他 DSH 安装分开。

升级时，下载新发行包，将安装器指向**原来的安装目录**。备份、迁移、回退与卸载步骤见 [生命周期指南](docs/lifecycle.md)。MinerU Key 不随文献备份迁移。

## 当前版本的范围

目前支持 Windows x64。已验证真实 MinerU 解析、订阅 Luna 翻译与复核、Reader 生成和重启恢复；测试过程中有管理员继续及纠错提示，**尚未保证全程无人干预**。译文、公式与导读仍需读者结合原文判断。

当前使用固定 Reader 模板和 Excel 字段；自定义模板、自定义字段、文献雷达尚未提供。

[详细验收记录](docs/acceptance.md) · [版本说明](docs/release-notes.md) · [订阅接入技术说明](docs/oauth.md) · [第三方许可](THIRD_PARTY_NOTICES.md)
