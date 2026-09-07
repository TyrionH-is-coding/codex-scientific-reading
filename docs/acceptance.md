# Deep Literature for Codex 验收记录

rc.3 为产品改名版本，A 引擎与 rc.2 完全相同。下方保留 rc.2 的真实模型验收证据，rc.3 的安装及展示核验见发行附件。

# rc.2 修复与真实验收（2026-09-06）

基线：B 695a301；A 5c6fc0c。候选安装包已在原实例升级运行，原数据、分类与主管会话保留。

## 修复
- 原 full_read_parent_mismatch 的丢失/被替换父任务恢复，严格保留 scope 和 PDF 身份检查。
- sr_job_status 原生工具回执和错误透传；继续操作返回 accepted/poll，避免旧状态误判。
- 中断后过滤旧 Codex turn 的 started/delta/completed 事件。
- MinerU 首次真实 API 成功后持久记录 verified；保存 Key 后允许原任务继续。
- 未完成旧解析事务升级到 normalization v4：正文保留 5 个公式，24 个标题层级复核；失败可回滚。
- full-review-v3 允许最终复核替换过密的初始高亮；保持 v2 兼容，Reader 渲染与文库发布均验证版本及哈希。
- Windows 短暂文件占用读写重试；去重回执保留分类；工作区/文献默认模式、安装及发布说明。

## 实测
- 空目录安装并启动：通过。默认文献模式、分类自动关联工作区、入库去重、公开 PDF 补入同一任务：通过。
- 新实例真实 MinerU 云解析：通过，api_call_verified=true；没有复制其他实例的订阅凭据。
- 原失败 Attention Is All You Need 任务使用已登录订阅的 Luna：3 批、117 条翻译，12 个最终高亮与 4 类导读，正式任务 completed。
- 此过程包含管理员提示模型继续和纠正提交，不能视为全程无人干预测试。
- 原任务 Reader 已通过原生接口 HTTP SHA 校验，在 Codex 内置浏览器打开，中英切换正常，所查页面无 console error。
- 停止后重新启动：实例身份保留，Reader URL 可用，Reader SHA 不变。
- PDF SHA256: bdfaa68d8984f0dc02beaca527b76f207d99b666d31d1da728ee0728182df697
- Reader SHA256: aa40cdb443dd1d22392d97bfcbda1b095375e9966ad77b2b933c8949dea4c9d1
- A 完整回归 404 passed / 1 skipped；最后 Reader 发布修正相关 25 passed；离线与资源检查通过。
- B 44/44、OAuth 32/32、实际 DSH 原生交接与隔离 20/20 通过。


## 最终空目录安装补验（2026-09-07）

最终候选07再次安装到空目录，初始文库为空、默认文献模式、分类绑定、去重、重启恢复通过。安装215.59秒，首次start 4.533秒，停止0.301秒，再次启动4.754秒；应用与配置隔离，不是OS虚拟机。前半安装阶段用日志时间估算，应用调用用单调时钟计时。测试脚本的内部回执断言修正后通过，保留真实首次启动计时。

发行构建若只修改文档和源码溯源元数据，以上真实模型验收适用于相同A包与运行时代码。发行ZIP的逐文件回读另记录于PACKAGE-VERIFY.json。仍须校验该发行构建的安装自检与启动。
