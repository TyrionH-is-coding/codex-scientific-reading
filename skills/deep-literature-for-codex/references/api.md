# 0.1 机器接口

入口：`workbench.ps1 call -RequestFile <UTF-8 JSON>`。请求格式 `{ "action": "...", "payload": { ... } }`。脚本自行验证运行实例并填入 instanceId。成功返回 `{ "ok": true, "value": ... }`；失败为 `ok:false,error`，不能只看 HTTP 状态。

| action | payload | 结果/用途 |
| --- | --- | --- |
| folders | `{}` | A 的 folder 数组 |
| folder_create | `{name}` | 创建分类 |
| folder_rename | `{folderId,name}` | 改名并同步主管标题，ID 不变 |
| folder_archive | `{folderId,archived:true/false}` | 归档范围并阻止旧 worker 写回；恢复不自动续跑旧任务 |
| bind | `{folderId}` | 稳定 `{folderId,sessionId,active,name}` |
| ingest | `{metadata:{doi,title,authors,year,journal,pmid,source_url,abstract_en}}` | A 原生入库回执；authors 为字符串数组，year 为整数，未掌握字段可省略 |
| item | `{paperId}` | A 单篇事实 |
| list | `{folderId?,query?,page?,pageSize?,readingState?,personalRecentDays?,orderBy?}` | 全库或指定分类分页；按人工进度、个人维护时间筛选 |
| personal_update | `{paperId,fields,expected}` | 六个固定个人字段；expected 与 fields 键相同且匹配刚读取的旧值 |
| excel_sync | `{}` | success / pending / failed；更新行数、导出行数、时间与冲突明细 |
| excel_open | `{paperId}` | 打开当前工作簿，返回行号与 selected |
| environment | `{}` | 本机状态；library 中提供最近 Excel 导出回执 |
| move | `{paperId,folderId,tags?}` | A 分类操作，confidence 固定为用户显式选择 |
| submit | `{idempotencyKey,folderId,paperId,runAgent?}` | 稳定 taskId、jobId 和当前状态；runAgent 默认 true |
| tasks | `{}` | 绑定和所有交接任务，从 A 重新读取状态 |
| task | `{taskId}` | 单任务实际状态，completed 时带正式 Reader URL/SHA |
| dispatch | `{taskId,retryKey?}` | 将 waiting_agent 原任务投递到主管；同 gate 不重复投递。模型失败/取消后明确重试可使用新稳定 retryKey，同一重试不换键 |
| resume | `{taskId,idempotencyKey,input:{...}}` | 遵守 A 当前 required_input 的明确续接 |
| attach | `{taskId,idempotencyKey,pdf,sourceType}` | 真实绝对文件路径；来源 manual/codex_authorized；续接同篇同任务 |
| acquisition | `{taskId,idempotencyKey,expectedRevision,event,hasAccess?,libraryUrl?}` | PDF 缺失后的高校权限选择、公开资源入口和浏览器交接；事件与状态见 [正文获取流程](download.md) |
| acquisition_download | `{taskId,idempotencyKey,expectedRevision,proxy,target,url}` | 用户已选择机构访问并进入 browsing 后，从核对过的同源标签页传输正文 PDF；返回本地路径/SHA，再调用 attach |
| cancel | `{taskId}` | 只移除本任务排队提示，确认当前 turn 属于本任务才取消；不声称 A detached worker 已停止 |
| reader | `{paperId}` | 验证 Reader 清单及 HTTP SHA 后返回链接 |

例如先创建分类：

```json
{"action":"folder_create","payload":{"name":"抗磷脂综合征"}}
```

后续使用真实返回的 folder_id。submit 键在同一逻辑请求的重试中保持不变；resume/attach 使用各自稳定键。不同输入重复使用同一键会返回 `idempotency_conflict`。

`translation_retry_limit` 必须由用户明确要求继续后使用 `resume`，输入仅为 `{"retry_translation":true}`。随后读回任务再 `dispatch`；分类 agent 不能自行清除这个暂停。`accepted_blocks` 是已校验并保存的条数，`remaining_block_ids` 是下一次补译范围。`full-translation-v4` 只回传各块的 `block_id`、`translation_zh`，并带当前 gate 的批次、来源和完整源批次文件 SHA；英文和初步高亮由引擎绑定。旧任务的 v3 合同继续有效。

`dispatched` 表示任务在进行，不代表 PDF/Reader 已存在。`waiting_user` 看 `job.detail.reason_code/required_input`；`waiting_agent` 调用 dispatch。`failed` 看 `error` 或 A job detail。

`pdf_required` 时任务带 `acquisition`，应按其 `nextAction` 先询问高校权限，再引导机构访问；用户回答和回执持久保存。同一回复/下载请求重试不换键；`expectedRevision` 必须来自当前状态。接口不会自行确认用户已登录，不接受 Cookie/密码，也不会因认证成功而把论文标为已下载。

已有投递回执再次调用 `dispatch` 时会恢复同一原生会话，按 rpcId 核对真实 inbox、`user/message` 和取消事件。`dispatch.evidence` 为 pending/delivered 时 status 保持 accepted；正常关闭 DSH 撤销的排队消息返回 canceled；证据不足返回 uncertain。相同 gate 不重发；已授权继续的明确撤销可使用新稳定 retryKey。领取消息但尚未组装成 user/message 的短暂窗口属于 uncertain，不能推断为取消。

续接回执丢失但已观测到 gate 前进时记录 observed_progress，不冒称能证明是哪次输入完成的。仍为 `operation_reconciliation_required` 时先查看实际任务及输入，不更换键强行循环重试。

此 API 属于本机 Codex 总管理员。没有任意命令、任意配置写入或通用脚本执行入口；DSH 分类会话通过受限文献工具工作。
