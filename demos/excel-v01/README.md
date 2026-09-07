# Excel 长期管理 Demo

用于评审 v0.1 的固定工作簿设计，不改动正式引擎、已安装 DSH 或真实文献库。

- 文献：6 篇合成资料；支持筛选、整表排序和六类个人字段编辑。
- 阅读成果：14 条有类别、来源、核对状态和原文位置的记录。
- 图表索引：5 项图表；可打开原图、原文上下文和结构化表格，并返回关联结论。
- 说明：保存、同步及演示范围。

所有论文名称、正文、图表和确认状态均为合成示例，不构成科研证据。

## 本机使用

输出位于仓库的 `outputs/01a06f44-excel-v01-demo/`。打开其中的 `Deep Literature 文献管理 Demo.xlsx`。保留同目录的 `assets/`，否则外部链接会失效。

编辑浅黄色字段，保存关闭后让 Codex 同步。独立数据库为输出目录中的 `demo-library.sqlite`，没有连接生产文献库。旧表基线也保存在该库中。

## 运行脚本

本 Demo 用 Codex 提供的 Artifact Tool 生成 XLSX，需要 Node.js 和包含 reportlab、pypdf 的 Python。设置 `DEMO_PYTHON` 为该 Python 的绝对路径，并使 `@oai/artifact-tool` 可从此目录解析。本机使用到 Codex bundled dependencies 的 `node_modules` junction，不安装生产依赖。

```text
node demos/excel-v01/demo.mjs build <独立输出目录>
node demos/excel-v01/demo.mjs sync <独立输出目录>
node demos/excel-v01/demo.mjs search <独立输出目录> <关键词>
```

首次生成演示资料还需设置 `DEMO_CJK_FONT` 与 `DEMO_PDFTOPPM`，分别指向可用的中文 TrueType 字体和 Poppler 的 pdftoppm：

```text
python demos/excel-v01/assets.py <独立输出目录>
```

已有工作簿时，build 和 sync 都先导入个人改动。遇到身份或字段冲突保留原表并返回 pending，不覆写为全新样表。

## 验证

```text
python -m unittest discover -s demos/excel-v01 -p test_store.py -v
powershell -File demos/excel-v01/verify-excel.ps1 -DemoRoot <独立输出目录>
python demos/excel-v01/verify_files.py <已完成原生往返测试的输出目录>
```

原生往返测试先复制样表、demo 数据库和 link-labels.json 到独立测试目录，再对该目录运行 verify-excel.ps1 的 `-Exercise` 和 demo.mjs 的 `sync`。它会修改、排序并保存测试副本，不能对用户正在编辑的样表运行。

Artifact Tool 的 HYPERLINK 计算尚不支持。本 Demo 保留原生 Excel 公式，并修正其导出时的错误缓存；渲染对象仅显示对应标签。Windows Excel 16 的实际打开、公式值、编辑、排序、保存及数据库回写另行核对。列分组、隐藏身份与冻结区通过受限的 OpenXML 属性补齐。没有通过重建空白工作簿或删除公式来掩盖问题。

本目录保留为独立的评审 Demo。用户确认后，管理逻辑已接入生产引擎、真实导读提取和版本迁移，见 [正式整合验收](../../docs/excel-v0.1-acceptance.md)。安装运行使用正式引擎，不调用此 Demo。macOS Excel 和 Linux LibreOffice 尚需实机回写核验。
