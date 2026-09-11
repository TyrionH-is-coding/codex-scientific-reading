# Windows、macOS 与 Linux 安装指南

[返回 README](../README.md)

v0.2 提供 Windows、macOS 与 Linux 安装包，包含文献库、双语 Reader、阅读问答、随记和模型分工。安装器、运行时、密钥保存与文件打开方式按平台适配。已有用户请看[升级指南](upgrading.md)。

## 选择安装包

| 系统 | 安装包名称后缀 | 安装入口 |
| --- | --- | --- |
| Windows x64 | `win-x64.zip` | `install.ps1` |
| macOS Apple Silicon | `darwin-arm64.tar.gz` | `install.sh` |
| macOS Intel | `darwin-x64.tar.gz` | `install.sh` |
| Linux x64 | `linux-x64.tar.gz` | `install.sh` |
| Linux ARM64 | `linux-arm64.tar.gz` | `install.sh` |

macOS/Linux 可在终端运行 `uname -m`：`arm64` 或 `aarch64` 对应 ARM64，`x86_64` 对应 x64。Linux 面向 glibc 发行版（Ubuntu 22.04 及同等或更新环境）；Alpine/musl、32 位与 Windows ARM64 未提供发行包。macOS 自动化验证使用 macOS 14 Apple Silicon 和 macOS 15 Intel。

每个包都包含文献引擎。安装器从官方来源下载固定版本的 Node/Python，核对 SHA256 后安装到自己的目录，不要求预装这两个运行时。

## 从 main 源码测试

当前版本为 **v0.2.0-rc.2 预发布版**，详见 [v0.2 指南](v0.2-guide.md)。日常使用优先下载 [Release 安装包](https://github.com/TyrionH-is-coding/deep-literature-for-codex/releases/tag/v0.2.0-rc.2)；下面的源码安装步骤用于开发测试。

Mac/Linux 首次取得源码：

```sh
git clone https://github.com/TyrionH-is-coding/deep-literature-for-codex.git
cd deep-literature-for-codex
```

已有源码仓库时，在该仓库目录运行 `git pull --ff-only origin main`。若本地也有修改或提交，先保留并整合自己的工作。

源码已包含 `inputs/scientific-reading.tgz`，安装器会核对它与 `runtime/pins.json` 中的 SHA256。进入源码根目录执行：

```sh
sh ./install.sh --plugin-archive ./inputs/scientific-reading.tgz --root "$HOME/CodexScientificReading" --install-skill
sh "$HOME/CodexScientificReading/workbench.sh" start
```

已有实例时，将 `--root` 指向原来的安装根；单独试装可使用新的空目录。仅拉取源码不会升级已安装的实例。固定引擎包校验失败时停止安装，不能改成使用不匹配的旧包。

## Windows

按[使用指南中的 Windows 安装步骤](getting-started.md#也可以手动安装)下载、核对 SHA256、解压后执行：

```powershell
powershell.exe -NoProfile -File .\install.ps1 -PluginArchive .\inputs\scientific-reading.tgz -InstallSkill
```

默认目录为 `%USERPROFILE%\CodexScientificReading`，使用 `workbench.ps1` 启停。

## macOS / Linux

1. 从 Release 下载对应 `.tar.gz` 包和 `SHA256SUMS.txt`。
2. 用 macOS 的 `shasum -a 256 安装包.tar.gz` 或 Linux 的 `sha256sum 安装包.tar.gz` 核对下载文件。
3. 解压并在终端进入含有 `install.sh` 的目录。
4. 执行：

```sh
sh ./install.sh --plugin-archive ./inputs/scientific-reading.tgz --install-skill
```

默认目录为 `$HOME/CodexScientificReading`。指定其他目录时加 `--root '/你的目录/文献工作台'`。安装需要 `sh`、`curl`、`tar` 与 SHA256 校验工具，通常由系统提供。

启动、查看状态和停止：

```sh
sh "$HOME/CodexScientificReading/workbench.sh" start
sh "$HOME/CodexScientificReading/workbench.sh" status
sh "$HOME/CodexScientificReading/workbench.sh" stop
```

`start` 返回 `ok: true`、`status: running` 和当前 `url`。在浏览器打开返回的 URL；端口由本次启动决定。与 Codex 联动时，先让 Codex 检查自己可用的浏览器工具。工作台服务可以独立运行，内置浏览器自动操作还需要 Codex 宿主提供相应工具；没有该工具时使用返回的链接手动打开，不把它报告成已完成内置浏览器验收。

## 密钥保存在什么地方？

首次启动后还需要选择模型接入。使用订阅时，在实际启动 URL 后加 `/api/codex-oauth/ui`，依次点击“使用 ChatGPT 登录”和“打开 OpenAI 授权页”，本人完成授权后返回 DSH 选择 OpenAI Codex。三个系统都启动各自架构的官方 Codex 可执行文件，凭据保存在实例内，外层 Codex 登录不会自动同步。也可以直接使用 DSH 原生模型 API。

| 系统 | MinerU Token 保存方式 |
| --- | --- |
| Windows | 当前用户 DPAPI 加密文件，保留现有实例兼容性 |
| macOS | 当前用户 Keychain，每个工作台实例使用独立条目 |
| Linux | 当前桌面会话的 Secret Service，例如 GNOME Keyring 或提供该接口的钱包 |

首次配置按 [MinerU Key 教程](mineru-api-key.md) 从右上角“文献设置”保存。系统可能要求本人解锁钥匙串。没有配置密钥的实例不会主动打开钥匙串。

Linux 若保存时报 `secure_store_unavailable`，检查 Secret Service 是否已安装、运行和解锁，并从当前登录的桌面会话启动工作台。无桌面的 SSH/服务器环境需要自行提供可用的 D-Bus/Secret Service 会话；安装器不会自动改用明文文件保存 Token。不要用 `sudo` 启动个人工作台，否则会改变用户和凭据库归属。

完整文献备份不包含这些凭据；跨系统恢复后重新登录模型并保存 MinerU Token。

## Excel 与默认文件打开

总表在安装根下的 `library/library/scientific-reading.xlsx`。三列个人记录的保存、刷新与回写行为相同，见 [Excel 教程](excel-library.md)。

- Windows：支持 Excel 自动化时选中对应行，否则用关联软件打开文件。
- macOS：通过系统 `open` 打开关联的表格软件。
- Linux：通过 `xdg-open` 打开关联软件；无图形界面时可直接取用生成的 XLSX 文件。

macOS/Linux 打开后按论文名查找对应行。生成与回写 XLSX 不依赖 Microsoft Excel；使用其他表格软件编辑时，要保持工作表结构和身份信息完整，其格式兼容性需要额外确认。

macOS/Linux 手动刷新总表：

```sh
reading_root="$HOME/CodexScientificReading"
reading_python=$("$(cat "$reading_root/.workbench-node")" -p 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).python' "$reading_root/installation.json")
"$reading_python" -I -X utf8 -m scientific_reading --data-root "$reading_root/library" xlsx-refresh
```

先保存并关闭工作簿，再执行刷新；返回 `status: success` 才表示完成。

## 升级、回退、迁移与卸载

升级时在新安装包目录运行同一安装命令，并指向原来的 `--root`。安装器先准备新版本、备份文献库，再验证启动；发生数据或会话格式迁移后，失败恢复会继续新版，不启动旧格式程序。完整步骤见[升级指南](upgrading.md)。

```sh
sh ./install.sh --plugin-archive ./inputs/scientific-reading.tgz --root "$HOME/CodexScientificReading" --install-skill
sh "$HOME/CodexScientificReading/workbench.sh" rollback
sh "$HOME/CodexScientificReading/workbench.sh" recover
```

`rollback` 只允许回到数据与会话格式兼容的上一程序版本，`recover` 处理被中断的版本切换。v0.1 升级至 v0.2 后不能直接回退；切换程序版本不会用旧文献数据覆盖新笔记。

将完整备份恢复到一个新的安装根：

```sh
sh ./install.sh --plugin-archive ./inputs/scientific-reading.tgz --root "$HOME/DeepLiteratureRestored" --library-backup '/备份目录/文献库.zip' --install-skill
```

卸载程序并保留文献、配置与备份：

```sh
sh "$HOME/CodexScientificReading/uninstall.sh"
```

跨平台验证分为引擎/插件测试与真实安装检查。安装检查从发行压缩包重新解压，在各系统的独立目录执行安装、启动、身份核验、系统凭据保存读取删除、Excel 回写、备份、重启、重装与卸载，并记录耗时。结果见 [验收记录](acceptance.md)。它不调用用户的模型或 MinerU 额度，也不代替 Codex 桌面交互与译文质量验收。
