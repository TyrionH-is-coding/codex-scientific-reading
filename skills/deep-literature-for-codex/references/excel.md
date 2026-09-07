# Excel 操作

通过实例 `call` 执行，不再手工寻找 Python 或写临时 SQL。

- 同步：`{"action":"excel_sync","payload":{}}`。用户先保存关闭表格。检查返回的 `status`；success 才表示已导出，报告 `updated`、`rows`、`exported_at`、`path`。
- 打开并定位：`{"action":"excel_open","payload":{"paperId":"真实 ID"}}`。`selected=false` 时说明仅打开默认应用，按返回行号查找。
- 查看同步状态：`{"action":"environment","payload":{}}`，读取 `library.xlsx_status`、`xlsx_pending` 和 `xlsx_last_export`。
- 修改个人记录：先 `item` 读取值，随后 `personal_update` 携带 `fields` 与相同键集合的 `expected`。只提交用户要求改变的字段，空字符串表示清空。阅读进度只接受未读、在读、已读、待复读。
- `list` 支持 `query`、`readingState`、`personalRecentDays`、`orderBy:"personal_updated_at"`，用于找回笔记和最近整理文献。

个人字段为 `reading_state`、`project_relevance`、`next_action`、`understanding_level`、`personal_thoughts`、`user_notes`。生成 Reader 不改变人工阅读进度；Agent 不自动把建议写成用户立场。

冲突时保留工作簿和双方内容，报告具体 `details`。依据用户的明确选择解决冲突，不改隐藏基线或直接写 SQL。旧表归档、备份和工作表用途见 [管理说明](../../../docs/excel-library.md)。
