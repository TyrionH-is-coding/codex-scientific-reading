# v0.2 机器接口

入口：`workbench.ps1 call -RequestFile <UTF-8 JSON>`。请求格式 `{ "action": "...", "payload": { ... } }`。脚本自行验证运行实例并填入 instanceId。成功返回 `{ "ok": true, "value": ... }`；失败为 `ok:false,error`，不能只看 HTTP 状态。

| action | payload | 结果/用途 |
| --- | --- | --- |
| folders | `{}` | A 的 folder 数组 |
| folder_create | `{name}` | 创建分类 |
| folder_rename | `{folderId,name}` | 分类改名，论文与 chat 身份不变 |
| folder_archive | `{folderId,archived:true/false}` | 归档范围并阻止旧 worker 写回；恢复不自动续跑旧任务 |
| bind | `{paperId}` | 稳定 `{paperId,folderId,sessionId,active,name}`；分类移动后继续原 chat |
| ingest | `{metadata:{doi,title,authors,year,journal,pmid,source_url,abstract_en}}` | A 原生入库回执；authors 为字符串数组，year 为整数，未掌握字段可省略 |
| item | `{paperId}` | A 单篇事实 |
| list | `{folderId?,query?,page?,pageSize?,readingState?,personalRecentDays?,orderBy?}` | 全库或指定分类分页；按人工进度、个人维护时间筛选 |
| personal_update | `{paperId,fields,expected}` | 六个固定个人字段；expected 与 fields 键相同且匹配刚读取的旧值 |
| excel_sync | `{}` | success / pending / failed；更新行数、导出行数、时间与冲突明细 |
| excel_open | `{paperId}` | 打开当前工作簿，返回行号与 selected |
| environment | `{}` | 本机状态；library 中提供最近 Excel 导出回执 |
| move | `{paperId,folderId,tags?}` | A 分类操作，confidence 固定为用户显式选择 |
| submit | `{idempotencyKey,paperId,folderId?,runAgent?}` | 稳定 taskId、jobId 和当前状态；runAgent 默认 true；folderId 仅校验当前归属 |
| tasks | `{}` | 绑定和所有交接任务，从 A 重新读取状态 |
| task | `{taskId}` | 单任务实际状态，completed 时带正式 Reader URL/SHA |
| dispatch | `{taskId,retryKey?}` | 将 waiting_agent 原任务投递到主管；同 gate 不重复投递。模型失败/取消后明确重试可使用新稳定 retryKey，同一重试不换键 |
| resume | `{taskId,idempotencyKey,input:{...}}` | 遵守 A 当前 required_input 的明确续接 |
| attach | `{taskId,idempotencyKey,pdf,sourceType}` | 真实绝对文件路径；来源 manual/codex_authorized；续接同篇同任务 |
| cancel | `{taskId}` | 只移除本任务排队提示，确认当前 turn 属于本任务才取消；不声称 A detached worker 已停止 |
| reader | `{paperId}` | 验证 Reader 清单及 HTTP SHA 后返回链接 |
| chats_select | `{question,selection:[{paper_id}]}` | 保存用户明确选择的跨篇总结范围 |
| chats_selection | `{}` | 当前保存的问题和范围 |
| chats_read | `{selection?,question?}` | 读取所选原生历史与原文证据；续页参数见 v02 参考 |
| chats_legacy | `{}` | 旧分类讨论和旧单篇 Review 入口 |
| chats_legacy_read | `{session_id,beforeSeq?,textOffset?,pageSha256?}` | 登记旧会话的只读历史，保留混合讨论身份 |
| figure_discuss | `{paper_id,asset_id,source_pdf_sha256,question?,text_only?}` | 真实图像与来源上下文提交到本篇 chat，返回当前图上下文与投递状态 |
| model_run | `{step,input}` | 按设置中该步骤的模型和思考深度生成文字，返回实际 provider/model/reasoningEffort/text；input 包含任务、来源及输出合同，最多 120000 字符 |
| library_views | `{action,...}` | 研究字段、Excel/Reader 方案、主题色；详见 v02 参考 |
| radar | `{action,...}` | 方向草稿/确认、发现、评估、反馈与明确纳入；详见 v02 参考 |
| acquisition | `{taskId,event,expectedRevision,idempotencyKey,...}` | 获取全文的持久状态机；详见 download 参考 |
| acquisition_download | `{taskId,...}` | 从已授权标签页传输 PDF，详见 download 参考 |

新增合同与例子见 [v02.md](v02.md)。不要把旧 `{folderId}` bind 请求继续用于 v0.2。

例如先创建分类：

```json
{"action":"folder_create","payload":{"name":"抗磷脂综合征"}}
```

后续使用真实返回的 folder_id。submit 键在同一逻辑请求的重试中保持不变；resume/attach 使用各自稳定键。不同输入重复使用同一键会返回 `idempotency_conflict`。

`translation_retry_limit` 必须由用户明确要求继续后使用 `resume`，输入仅为 `{"retry_translation":true}`。随后读回任务再 `dispatch`；分类 agent 不能自行清除这个暂停。`accepted_blocks` 是已校验并保存的条数，`remaining_block_ids` 是下一次补译范围。`full-translation-v4` 只回传各块的 `block_id`、`translation_zh`，并带当前 gate 的批次、来源和完整源批次文件 SHA；英文和初步高亮由引擎绑定。旧任务的 v3 合同继续有效。

`dispatched` 表示任务在进行，不代表 PDF/Reader 已存在。`waiting_user` 看 `job.detail.reason_code/required_input`；`waiting_agent` 调用 dispatch。`failed` 看 `error` 或 A job detail。

已有投递回执再次调用 `dispatch` 时会恢复同一原生会话，按 rpcId 核对真实 inbox、`user/message` 和取消事件。`dispatch.evidence` 为 pending/delivered 时 status 保持 accepted；正常关闭 DSH 撤销的排队消息返回 canceled；证据不足返回 uncertain。相同 gate 不重发；已授权继续的明确撤销可使用新稳定 retryKey。领取消息但尚未组装成 user/message 的短暂窗口属于 uncertain，不能推断为取消。

续接回执丢失但已观测到 gate 前进时记录 observed_progress，不冒称能证明是哪次输入完成的。仍为 `operation_reconciliation_required` 时先查看实际任务及输入，不更换键强行循环重试。

此 API 属于本机 Codex 总管理员。没有任意命令、任意配置写入或通用脚本执行入口；DSH 分类会话通过受限文献工具工作。
