# Issue #6：MinerU 空图表条目

本轮修复通用归一化故障。原论文完整 MinerU 导出尚未提供，用户确认本轮无需等待该 PDF；没有声称该论文的原任务或 Reader 已复验完成。

空 `image`、`chart`、`table` 条目不再因缺失或空白 `img_path` 中断全部归一化。必须先验证字段类型，并确认没有标题、脚注、表格正文、图表内容、结构化资产或其他非空内容；满足条件才记录省略项和 `empty_visual_item` 警告。

`source_map.json` 与 `parse_report.json` 保存 `omitted_items`（原始索引、类型、页码、bbox 和复核原因）。报告还标记 `content_review_required`；原始 JSON、PDF 来源哈希、原始 JSON 哈希和后续正文索引保持可追溯。空字段只说明解析条目为空，不能证明 PDF 没有内容，也不能证明跨页表格已无损合并。遇到警告须核对相应 PDF 页及相邻条目。

缺图但仍有内容时，返回带索引和页码的 `mineru_visual_asset_required` 完整性错误，要求核对原始结果、补齐资产后重试。非空非法路径、资产缺失、越界和结构化资产哈希不匹配仍然失败。

回归使用合成输入覆盖缺失/null/空串/空白、错误字段类型、非空内容、正常图表混排和资产校验；五平台安装包验收还直接调用已安装 wheel，复现空条目和内容完整性分支。未额外调用 MinerU 云服务或付费模型。

依据：[Issue #6](https://github.com/TyrionH-is-coding/deep-literature-for-codex/issues/6)、[MinerU 官方输出格式](https://opendatalab.github.io/MinerU/reference/output_files/)（图表可包含 content，不能仅依据图片字段判断为空）。
