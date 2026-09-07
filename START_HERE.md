# Deep Literature for Codex：从发行包开始

本仓库和 GitHub Release 已公开。下面步骤面向全新 Windows x64 机器，不假设本机已经装过 Node、Python、DSH 或本 Skill，也不假设另一台电脑已经装过。

1. 打开 https://github.com/TyrionH-is-coding/deep-literature-for-codex/releases
2. 下载当前发布候选的 zip 与 `SHA256SUMS.txt`。不要使用 GitHub 自动生成的 Source code 压缩包。
3. 按 `SHA256SUMS.txt` 核对 zip。
4. 解压后在该目录执行：

```powershell
powershell.exe -NoProfile -File .\install.ps1 -PluginArchive .\inputs\scientific-reading.tgz -InstallSkill
```

5. 安装成功后，在 Codex 调用 `$codex-scientific-reading`，或运行安装根下的 `workbench.ps1 start`。
6. 若 `start` 返回 `start_timeout`，先运行 `workbench.ps1 status`。日志里已经出现本地地址时，多半仍在首次加载，不要立刻重装。
7. 版本、源码提交和已测范围见 `docs/release-notes.md` 与 `docs/acceptance.md`。

不要把本机已有的 DSH、全局 Skill 或其它机器上的安装状态当成前提。
