# 独立 DSH 运行与 Codex 浏览器入口实施计划

> **For agentic workers:** 使用 executing-plans 按任务执行。用户已授权直接开展不与“工程”冲突的工作；在 B 的独立目录内执行，A 只读。

**Goal:** 完成 PB-01～PB-04 的第一阶段，让安装包启动自有 DSH，并由 Codex Skill 打开、识别、复用和停止实例。

**Architecture:** Windows x64、项目自有 Node/Python/DSH、独立 DSH_HOME 和文献库。命名管道由 supervisor 独占，用于并发启动协调和本实例停止；DSH 绑定 127.0.0.1:0，由一个小插件报告实际端口并提供只读身份入口。复用 A 的固定候选 tarball，不引用活动源码。源码与安装目录分开，后者可脱离开发仓库运行。

**Tech Stack:** Node 22 原生模块、PowerShell 5.1+ 安装入口、CPython 3.11 专用 venv、官方 DSH rc.7、原生 Codex Skill。

当前不接入分类作用域、OAuth、收费模型、MinerU 服务或真实文献。PB-01 最终发行锁定仍需替换为 A 正式包及选定 OAuth 组件；本阶段以 candidate 明确标记。

## 文件边界

- `install.ps1`：无全局 Node/Python 前提的安装入口，固定下载与 SHA 校验。
- `src/install.mjs`：npm ci、Python venv 与锁定依赖、配置和 Skill 安装。
- `src/core.mjs`：实例目录、环境、校验、结构化 JSON 和 Skill 文件保护。
- `src/control.mjs`、`src/supervisor.mjs`、`src/cli.mjs`：命名管道生命周期。
- `src/identity.mjs`：当前 DSH 实际实例身份与就绪 IPC。
- `runtime/*`：固定版本、npm lock、Python requirements hashes。
- `skills/codex-scientific-reading/SKILL.md`、`scripts/workbench.ps1`：Codex 入口。
- `tests/*`：环境/路径/校验/真实进程测试；`scripts/acceptance.mjs`：已安装 DSH 验收。

## Task 1：目录与隔离合同

- [ ] 测试先行，运行 `node --test tests/core.test.mjs`，预期因缺少实现失败。
- [ ] 实现 `initializeRoot(root)`、`isolatedEnvironment(root, parent)` 和 `verifyFile(file, sha)`。
- [ ] 验证独立 home、Python/Node 环境注入被排除、代理保留、未知非空目录被拒绝、相同实例重复初始化不改身份、坏 SHA 不可安装。

```js
const first = await initializeRoot(root);
assert.equal((await initializeRoot(root)).instanceId, first.instanceId);
assert.equal(isolatedEnvironment(root, parent).DSH_HOME, path.join(root, 'state', 'dsh-home'));
await assert.rejects(verifyFile(file, '0'.repeat(64)), /checksum/);
```

## Task 2：可重复安装

- [ ] 获取精确 A 候选副本并校验；Node 和 Python 只读取官方发行地址。
- [ ] 在 B 内生成一次依赖锁文件；普通安装只使用 npm ci、带 hash 的 Python wheel 依赖。
- [ ] `powershell -NoProfile -File install.ps1 -Root <新测试目录> -PluginArchive inputs/scientific-reading.tgz`。
- [ ] 验证解释器和库都解析至安装目录、wheel 与 tarball SHA、空全局 DSH 前提、重装保留身份和数据。

## Task 3：进程生命周期

- [ ] 先写实际 fixture 子进程测试，验证并发 start 共用一个进程、退出读回、stop 不使用磁盘陈旧 PID 杀进程。
- [ ] 实现控制管道与 supervisor；停止只作用于本 supervisor 直接创建的 child handle；重复启动先连接现有 supervisor。
- [ ] 身份插件在宿主加载完成后通过 IPC 报告端口；探测 JSON 身份匹配才返回 running。
- [ ] 验证端口 0、浏览器地址由本次启动产生、关闭浏览器不停止服务。

## Task 4：Skill 与实际浏览器验收

- [ ] Skill 执行脚本只读取安装定位文件并调用安装目录 CLI；已存在的不同 Skill 不覆盖。
- [ ] `start/status/stop` 均输出可解析 JSON；Skill 指示用 Codex 内置浏览器打开返回 URL，并先校验身份页面。
- [ ] 启动真实 DSH 候选，HTTP 读回 `/__workbench/identity`、`/` 与文献库接口。
- [ ] 真实内置浏览器打开身份和 DSH 页面，关闭后重开并确认实例一致。
- [ ] 完整测试与验收记录结果；用户可直接查看运行实例。

## 完成边界

本阶段验收只证明隔离安装、宿主/插件启动、实例生命周期和浏览器入口。A 内容保真、分类管理员、OAuth、完整发布和升级回滚仍按后续工作包验收。所有实际数据为 B 的空白库或合成测试记录；不触及 A 的源码、默认 DSH 配置、登录态或用户文献。
