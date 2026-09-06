# 隔离安装与生命周期验收

本记录保存开发阶段证据；最终候选包的综合验收将单独记录，不能用本阶段结果代替同一最终包验收。

## 实际执行

2026-09-05，Windows x64、PowerShell、中文路径 `D:\Vibe Coding\codex-scientific-reading\.local\工作台` 中，安装了固定 Node 22.22.2、独立 CPython 3.11.16/venv、DSH 0.1.0-rc.7、固定 A 候选 tarball。没有修改原 DSH 或其认证资料。

`outputs/installed-acceptance.json` 记录 12 项真实检查通过，包括：并发启动复用、独立回环端口、实例 HTTP 身份、DSH HTML、A 文献库 API、外部环境不注入、A tarball SHA、511 个内部模块链接、停止/重启和 3080 共存。

Codex 内置浏览器实际显示独立 DSH 首页，并在 HTML 实例页读到实例 ID `66657c3d-9972-4336-bb98-3d621ee7fccd` 和当次启动 ID。未输入任何 API Key，也未触发模型或文献解析。直接导航到 JSON 身份接口被浏览器拒绝后，使用专用 HTML 实例页解决；没有关闭浏览器保护。

## 发现并修复

- npm 的 prerelease 依赖解析会引入 rc.8，当前运行组合已将所有 DSH 包锁定到 rc.7。
- `--legacy-peer-deps` 会漏装宿主所需 provider，改为普通带锁安装。
- 用户原 DSH 虽标 rc.7，但有本地修改；官方 npm rc.7 无 `--no-open` 参数，也不自动打开浏览器。安装器使用官方行为。
- Python `-I` 会忽略 UTF-8 环境开关，补充 `-X utf8` 后中文导入路径正确读回。
- 再次启动能从失败状态恢复；停止不按磁盘 PID 杀进程；控制与 HTTP 身份均须匹配指定实例。

## 证据边界

上述原型在安装后追加了身份 HTML 页与控制校验，且后续实现改成版本化运行目录。原型不是冻结后的最终包，最终验收须重装并重新取得证据。独立浏览器启动成功也不等于 OAuth 登录、收费模型、MinerU API 或科学内容验收成功。
