# 第三方组件

本项目的控制代码与 Skill 使用 BSD-3-Clause。下载/安装的组件保留自己的许可和通知，不因组合安装变更许可。

| 组件 | 来源与固定方式 | 许可文件位置 |
| --- | --- | --- |
| DSH Scientific Reading | A 候选 tarball，SHA 见 `runtime/pins.json` | 安装包中的 `LICENSE`、`THIRD_PARTY_NOTICES.md` |
| DeepSeek Harness | npm 官方 `@deepseek-ai/dsh` 0.1.0-rc.7；宿主与 peer 依赖见 lock | 各 npm 包的 `LICENSE` 和 package 元数据 |
| Node.js | nodejs.org 的 22.22.2 Windows x64 原始 zip，保留完整目录 | `runtime/node/22.22.2/LICENSE` |
| CPython | Astral python-build-standalone 的 3.11.16 / 20260901 Windows x64 原始发行包 | `runtime/python/3.11.16-20260901` 中原始许可与运行库通知 |
| Python 库 | PyPI wheel，完整版本与 SHA 见 `runtime/requirements.lock` | venv 各包的 dist-info 许可目录 |
| ScanSci PDF 的固定 OA 模块 | 官方 PyPI `scansci-pdf` 1.9.0 wheel；只加载 A 指定模块及最小依赖，不是完整 CLI | 私有 venv 中 scansci_pdf 的 dist-info；A 的第三方通知 |
| DSH OpenAI OAuth | DGPisces/dsh-openai-oauth 0.4.0，提交 `0db2b77aa69c4e8ee4e4c40ed5462a086fe4300f`；继承/修改位置和原文件 SHA 见 `oauth/provenance.json` | `oauth/vendor/dsh-openai-oauth/LICENSE`，MIT |
| 官方 Codex CLI | npm `@openai/codex` 0.146.0 及 win32-x64 原生包，integrity 固定在 lock | npm 包内 `LICENSE`，Apache-2.0 |

源码和校验参考：[DSH](https://github.com/deepseek-ai/deepseek-harness)、[Node 校验文件](https://nodejs.org/dist/v22.22.2/SHASUMS256.txt)、[Python standalone 固定发行](https://github.com/astral-sh/python-build-standalone/releases/tag/20260901)。

未随包分发第三方研究 Skill 或文献雷达。安装器下载的解释器和依赖保留原始许可文件；研究 PDF、用户库、凭据和本机测试记录不进入发行源码归档。
