# README 配图说明

- `dlc-banner.svg`：本项目原创的 DLC 字标与纸页插图，用于表达文献获取、双语精读和长期积累；不表示产品界面或实际论文结果。
- `excel-library-demo.png`：来自本仓库 `demos/excel-v01` 的文献管理设计 Demo，原始输出为 `outputs/01a06f44-excel-v01-demo/literature.png`，原图直接复制。所有论文标题、研究内容、阅读状态和笔记均为合成示例，不是用户真实文献库或科研证据。
- `attention-reader.jpg`：对本机此前生成的《Attention Is All You Need》HTML Reader 直接截图，展示摘要处的中英对照、章节目录与阅读导览。保留浏览器返回的原始 JPEG；截图时选择“中英”和“无标记”，未修改 HTML、译文或截图像素。论文来源：[Vaswani 等，2017，arXiv:1706.03762](https://arxiv.org/abs/1706.03762)。

Excel 管理逻辑已进入生产引擎，但该图展示的是设计 Demo，实际工作簿样式以对应版本生成结果为准。实现与原生应用验证见[Excel 整合验收](../excel-v0.1-acceptance.md)。

图片随文档保存；不依赖个人本机路径或远端图床。

## Attention Reader 截图来源

- 既有成果位置：`s3/papers/doi_10.48550_arxiv.1706.03762/generations/bdfaa68d8984f0dc/reading/reader.html`，位于开发机的仓库外测试数据目录。
- 源文件最后修改日期：2026-08-26；截图日期：2026-09-08。
- 源 HTML SHA256：`074746af66a6eb369e1f5e807e1ce86b28a3cec9be66c9ddfcef0103ed1fe408`。
- 通过仅监听本机回环地址的临时页面打开原 HTML，以 Codex 内置浏览器直接截图；没有重新调用 MinerU 或模型。
- 这是历史实测成果的界面展示；9 月 7 日 Luna 全流程验收是[单独记录](../acceptance.md)中的另一份输出，两者未混用。
