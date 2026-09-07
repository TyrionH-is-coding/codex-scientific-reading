import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FileBlob, SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const here = path.dirname(fileURLToPath(import.meta.url));
const python = process.env.DEMO_PYTHON;
const command = process.argv[2] || 'build';
const root = path.resolve(process.argv[3] || path.join(here, '../../outputs/01a06f44-excel-v01-demo'));
const filename = 'Deep Literature 文献管理 Demo.xlsx';
const target = path.join(root, filename);
const linkLabels = [];
const colors = { ink: '#243746', green: '#357B72', amber: '#B76930', input: '#FFF3D9', muted: '#6A7780', line: '#DDE5E2' };
const userFields = { '阅读进度': 'reading_state', '课题关联': 'project_relevance', '下一步': 'next_action', '理解程度': 'understanding_level', '个人思考': 'personal_thoughts', '用户笔记': 'user_notes' };
const headers = ['文献', '分类', '阅读进度', '课题关联', '下一步', 'Reader', 'PDF', '阅读成果', '图表', '个人记录更新', '处理进度', '年份', '标签', '理解程度', '个人思考', '用户笔记', '作者', '摘要', 'paper_id'];
const column = index => String.fromCharCode(65 + index);
const text = value => typeof value === 'string' && value.startsWith('=') ? `'${value}` : value;
const exists = async file => fs.access(file).then(() => true, () => false);
const localDate = value => new Date(new Date(value).getTime() + 8 * 60 * 60 * 1000);

function store(action, payload, args = []) {
  if (!python) throw new Error('请通过 DEMO_PYTHON 指定演示所用的 Python。');
  const result = spawnSync(python, [path.join(here, 'store.py'), root, action, ...args], { input: payload ? JSON.stringify(payload) : undefined, encoding: 'utf8', windowsHide: true, env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' } });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || `store_${action}_failed`);
  return JSON.parse(result.stdout);
}

async function inUse() {
  return await exists(path.join(root, `~$${filename}`)) || await exists(path.join(root, `.~lock.${filename}#`));
}

async function importNotes() {
  if (await inUse()) return { status: 'pending', error: 'xlsx_in_use', message: '请保存并关闭 Excel 后再同步。' };
  const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(target));
  const data = wb.worksheets.getItem('文献').getUsedRange().values;
  const found = data[6];
  if (headers.some(name => found.filter(value => value === name).length !== 1)) return { status: 'pending', error: 'headers_changed' };
  const sheet = wb.worksheets.getItem('文献');
  const papers = [];
  for (let r = 7; r < data.length; r++) {
    const row = data[r];
    if (row.every(value => value == null || value === '')) continue;
    const paper = { id: row[found.indexOf('paper_id')] };
    for (const [label, field] of Object.entries(userFields)) {
      const c = found.indexOf(label);
      if (sheet.getCell(r, c).formulas[0]?.[0]) return { status: 'pending', error: 'personal_formula_not_supported' };
      paper[field] = String(row[c] ?? '');
    }
    papers.push(paper);
  }
  const snapshotId = wb.worksheets.getItem('_同步').getRange('B1').values[0][0];
  return store('sync', { snapshot_id: snapshotId, papers });
}

function heading(sheet, title, subtitle, lastColumn, lastRow) {
  sheet.showGridLines = false;
  sheet.getRange(`A1:${lastColumn}${lastRow}`).format.font = { name: 'Microsoft YaHei', size: 10, color: colors.ink };
  sheet.getRange(`A1:${lastColumn}${lastRow}`).format.verticalAlignment = 'center';
  sheet.getRange('A2').values = [[title]];
  sheet.getRange('A2').format.font = { name: 'Microsoft YaHei', size: 16, bold: true, color: colors.ink };
  sheet.getRange(`A2:${lastColumn}2`).format.rowHeight = 30;
  sheet.getRange('A3').values = [[subtitle]];
  sheet.getRange(`A3:${lastColumn}3`).format.font = { name: 'Microsoft YaHei', size: 9, color: colors.muted };
  sheet.getRange(`A3:${lastColumn}3`).format.rowHeight = 22;
  sheet.getRange(`A5:${lastColumn}5`).format.borders = { bottom: { style: 'thin', color: colors.line } };
  sheet.freezePanes.freezeRows(7);
}

function grid(sheet, labels, rows, widths, name, height = 60) {
  const lastColumn = column(labels.length - 1), last = 7 + rows.length;
  sheet.getRange(`A7:${lastColumn}${last}`).values = [labels, ...rows.map(row => row.map(text))];
  const table = sheet.tables.add(`A7:${lastColumn}${last}`, true, name);
  table.style = 'TableStyleLight9';
  sheet.getRange(`A7:${lastColumn}7`).format = { fill: colors.ink, font: { name: 'Microsoft YaHei', size: 10, color: '#FFFFFF', bold: true }, horizontalAlignment: 'center', verticalAlignment: 'center', wrapText: true, rowHeight: 32 };
  sheet.getRange(`A8:${lastColumn}${last}`).format.wrapText = true;
  sheet.getRange(`A8:${lastColumn}${last}`).format.rowHeight = height;
  widths.forEach((width, c) => { sheet.getRange(`${column(c)}1:${column(c)}${last}`).format.columnWidth = width; });
  return last;
}

function link(sheet, address, url, label) {
  linkLabels.push({ sheet: sheet.name, address, label });
  sheet.getRange(address).formulas = [[`=HYPERLINK("${url.replaceAll('"', '""')}","${label}")`]];
  sheet.getRange(address).format.font = { name: 'Microsoft YaHei', size: 10, color: colors.green, underline: 'single' };
}

function jump(sheet, address, toSheet, idColumn, id, lastRow, label) {
  linkLabels.push({ sheet: sheet.name, address, label });
  sheet.getRange(address).formulas = [[`=HYPERLINK("#'${toSheet}'!A"&MATCH("${id}",'${toSheet}'!$${idColumn}$1:$${idColumn}$${lastRow},0),"${label}")`]];
  sheet.getRange(address).format.font = { name: 'Microsoft YaHei', size: 10, color: colors.green, underline: 'single' };
}

async function build() {
  const data = store('export');
  const wb = Workbook.create();
  const papers = wb.worksheets.add('文献');
  const records = wb.worksheets.add('阅读成果');
  const assets = wb.worksheets.add('图表索引');
  const guide = wb.worksheets.add('说明');
  const meta = wb.worksheets.add('_同步');
  const paperById = new Map(data.papers.map(p => [p.id, p]));
  const recordById = new Map(data.records.map(r => [r.id, r]));
  const paperLast = 7 + data.papers.length, recordLast = 7 + data.records.length, assetLast = 7 + data.assets.length;
  papers.tabColor = colors.ink; records.tabColor = colors.green; assets.tabColor = colors.amber;
  heading(papers, 'Deep Literature 文献管理', '合成演示资料。浅黄色字段可填写；系统字段在同步时更新。右侧分组列保留长笔记与题录。', 'S', paperLast);
  papers.getRange('A4').values = [['库内文献']];
  papers.getRange('B4').formulas = [[`=COUNTA(S8:S${paperLast})`]];
  papers.getRange('D4').values = [['在读 / 待复读']];
  papers.getRange('E4').formulas = [[`=COUNTIFS(C8:C${paperLast},"在读")+COUNTIFS(C8:C${paperLast},"待复读")`]];
  papers.getRange('F4').values = [['Reader 可用']];
  papers.getRange('H4').formulas = [[`=COUNTIFS(K8:K${paperLast},"Reader 可用")`]];
  grid(papers, headers, data.papers.map(p => [p.title, p.category, p.reading_state, p.project_relevance, p.next_action, '', '', '', '', localDate(p.personal_updated_at), p.system_state, p.year, p.tags, p.understanding_level, p.personal_thoughts, p.user_notes, '演示资料', p.summary, p.id]), [38, 13, 12, 31, 31, 9, 8, 10, 9, 16, 15, 9, 22, 28, 42, 46, 16, 52, 16], 'LiteratureTable', 66);
  for (const label of Object.keys(userFields)) papers.getRange(`${column(headers.indexOf(label))}8:${column(headers.indexOf(label))}${paperLast}`).format.fill = colors.input;
  papers.getRange(`C8:C${paperLast}`).dataValidation = { rule: { type: 'list', values: ['未读', '在读', '已读', '待复读'] } };
  papers.getRange(`J8:J${paperLast}`).setNumberFormat('mm-dd hh:mm');
  papers.getRange(`C8:C${paperLast}`).conditionalFormats.add('containsText', { text: '待复读', format: { font: { color: colors.amber, bold: true } } });
  papers.getRange(`K8:K${paperLast}`).conditionalFormats.add('containsText', { text: '更新', format: { fill: '#FBE8DE', font: { color: '#9A422E' } } });
  for (const [index, p] of data.papers.entries()) {
    const r = index + 8, ownRecords = data.records.filter(x => x.paper_id === p.id), ownAssets = data.assets.filter(x => x.paper_id === p.id);
    if (p.reader) link(papers, `F${r}`, `assets/${p.id}/reader.html`, p.id === 'DEMO-005' ? '旧版' : '打开');
    else papers.getRange(`F${r}`).values = [[p.pdf ? '待生成' : '缺全文']];
    if (p.pdf) link(papers, `G${r}`, `assets/${p.id}/source.pdf`, '打开');
    else papers.getRange(`G${r}`).values = [['待补入']];
    if (ownRecords.length) jump(papers, `H${r}`, '阅读成果', 'L', p.id, recordLast, `${ownRecords.length} 条`);
    else papers.getRange(`H${r}`).values = [['未生成']];
    if (ownAssets.length) jump(papers, `I${r}`, '图表索引', 'L', p.id, assetLast, `${ownAssets.length} 项`);
    else papers.getRange(`I${r}`).values = [['未解析']];
  }
  heading(records, '阅读成果', '研究问题、方法、结果与局限按文献积累。来源、核对状态与证据位置分别保留。', 'M', recordLast);
  records.getRange('A4').values = [['合成样例中的“已确认”只演示状态，不代表真实科研结论。']];
  grid(records, ['文献', '类别', '内容', '来源', '核对状态', '证据位置', '原文', '关联图表', '文献总表', '记录日期', 'record_id', 'paper_id', 'asset_id'], data.records.map(r => [paperById.get(r.paper_id).title, r.kind, r.text, r.basis, r.review_state, `PDF 第 ${r.page} 页`, '', '', '', new Date('2026-09-07T08:00:00+08:00'), r.id, r.paper_id, r.asset_id]), [31, 13, 62, 18, 19, 17, 10, 12, 12, 15, 14, 14, 14], 'ReadingRecords', 68);
  records.getRange(`J8:J${recordLast}`).setNumberFormat('yyyy-mm-dd');
  records.getRange(`E8:E${recordLast}`).conditionalFormats.add('containsText', { text: '重核', format: { fill: '#FBE8DE', font: { color: '#9A422E', bold: true } } });
  data.records.forEach((record, index) => {
    const r = index + 8;
    link(records, `G${r}`, `assets/${record.paper_id}/reader.html#${record.id}`, '查看');
    if (record.asset_id) jump(records, `H${r}`, '图表索引', 'K', record.asset_id, assetLast, '定位图表');
    else records.getRange(`H${r}`).values = [['正文段落']];
    jump(records, `I${r}`, '文献', 'S', record.paper_id, paperLast, '返回');
  });
  heading(assets, '图表索引', '每行是一张图或表。图注用于识别，关联结论用于回顾，原图和原文入口用于核对。', 'M', assetLast);
  assets.getRange('A4').values = [['同一张表的截图与结构化 HTML 放在同一行。旧版证据保持可见并标记重核。']];
  grid(assets, ['文献', '图表编号', '图注', '关联阅读结论', '核对状态', 'PDF 页码', '原图', '原文上下文', '结构表格', '文献总表', 'asset_id', 'paper_id', 'record_id'], data.assets.map(a => [paperById.get(a.paper_id).title, a.label, a.caption, recordById.get(a.record_id).text, a.state, a.page, '', '', '', '', a.id, a.paper_id, a.record_id]), [31, 14, 44, 49, 18, 11, 10, 14, 13, 12, 14, 14, 14], 'FigureIndex', 94);
  assets.getRange(`E8:E${assetLast}`).conditionalFormats.add('containsText', { text: '旧版', format: { fill: '#FBE8DE', font: { color: '#9A422E', bold: true } } });
  data.assets.forEach((asset, index) => {
    const r = index + 8;
    jump(assets, `D${r}`, '阅读成果', 'K', asset.record_id, recordLast, recordById.get(asset.record_id).text);
    link(assets, `F${r}`, `assets/${asset.paper_id}/source.pdf#page=${asset.page}`, String(asset.page));
    link(assets, `G${r}`, `assets/${asset.paper_id}/${asset.id}.png`, '查看');
    link(assets, `H${r}`, `assets/${asset.paper_id}/reader.html#${asset.id}`, '定位原文');
    if (asset.table) link(assets, `I${r}`, `assets/${asset.paper_id}/${asset.id}.html`, '查看 HTML');
    else assets.getRange(`I${r}`).values = [['不适用']];
    jump(assets, `J${r}`, '文献', 'S', asset.paper_id, paperLast, '返回');
  });
  heading(guide, '使用这个 Demo', '这是一份隔离的交互样表。它不会连接、修改或升级你的正式文献库。', 'B', 20);
  grid(guide, ['操作', '说明'], [
    ['先看文献', '筛选“阅读进度”，尝试将一篇论文改为“待复读”，并修改课题关联或下一步。'],
    ['查看长笔记', '展开文献页右侧的分组列，可编辑理解程度、个人思考和用户笔记。'],
    ['允许整表排序', '从表头进行完整表格排序。隐藏的稳定标识随行移动，不用原行号识别论文。'],
    ['回查阅读成果', '点击“阅读成果”进入该论文记录；原文入口定位到示例段落。'],
    ['回查图表', '点击“图表”进入索引；原图、原文上下文与表格 HTML 都有真实演示文件。'],
    ['保存并同步', '先保存、关闭 Excel，再告诉 Codex：“同步这份 Excel demo”。脚本会将个人改动保存到本 demo 数据库并刷新样表。'],
    ['系统字段', '白色系统列不回写数据库；由样表刷新生成。黄色六类个人字段支持同步。时间以北京时间显示。'],
    ['版本冲突', '旧表与数据库同时改了同一字段且值不同，保留原表并报告冲突，不自动选择一方。'],
    ['范围', '已演示布局、导航、个人记录与隔离同步；尚未接入正式 DSH，也不是 v0.1 新发行包。'],
    ['演示资料', '6 篇合成资料、14 条阅读记录、5 项图表。所有名称、正文与图表均为演示，不是真实论文。']
  ], [23, 112], 'DemoInstructions', 49);
  meta.getRange('A1:B2').values = [['snapshot_id', data.snapshot_id], ['format', 'deep-literature-excel-demo-v1']];
  wb.recalculate();
  const errors = await wb.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: { useRegex: true, maxResults: 30 }, maxChars: 3000 });
  await fs.writeFile(path.join(root, 'formula-check.ndjson'), errors.ndjson);
  const summary = await wb.inspect({ kind: 'table', range: '文献!A4:H4', include: 'values,formulas', tableMaxRows: 1, tableMaxCols: 8, maxChars: 2500 });
  await fs.writeFile(path.join(root, 'summary-check.ndjson'), summary.ndjson);
  const temporary = path.join(root, '.demo-next.xlsx');
  await (await SpreadsheetFile.exportXlsx(wb)).save(temporary);
  store('finish_workbook', { path: temporary });
  if (await inUse()) throw new Error('xlsx_in_use: 请关闭 Excel 后重试。');
  await fs.rename(temporary, target);
  await fs.writeFile(path.join(root, 'demo-data.json'), JSON.stringify(data, null, 2));
  await fs.writeFile(path.join(root, 'link-labels.json'), JSON.stringify(linkLabels));
  // 生成库不能渲染 HYPERLINK；只在预览对象中显示标签，交付 XLSX 保留真实公式。
  for (const item of linkLabels) {
    const range = wb.worksheets.getItem(item.sheet).getRange(item.address);
    range.clear({ applyTo: 'contents' }); range.values = [[item.label]];
  }
  wb.recalculate();
  for (const [name, range, file] of [['文献', 'A1:K14', 'literature.png'], ['阅读成果', 'A1:I14', 'reading.png'], ['图表索引', 'A1:J13', 'figures.png'], ['说明', 'A1:B17', 'instructions.png']]) {
    const rendered = await wb.render({ sheetName: name, range, scale: 1.4, format: 'png' });
    await fs.writeFile(path.join(root, file), new Uint8Array(await rendered.arrayBuffer()));
  }
  return { status: 'success', path: target, papers: data.papers.length, reading_records: data.records.length, assets: data.assets.length };
}

await fs.mkdir(root, { recursive: true });
if (command === 'search') console.log(JSON.stringify(store('search', undefined, [process.argv[4] || '']), null, 2));
else if (command === 'build' || command === 'sync') {
  store('init');
  let imported = { status: 'success', updated_papers: 0 };
  if (await exists(target)) imported = await importNotes();
  if (imported.status !== 'success') {
    await fs.writeFile(path.join(root, 'sync-result.json'), JSON.stringify(imported, null, 2));
    console.log(JSON.stringify(imported, null, 2)); process.exitCode = 2;
  } else {
    const result = { ...await build(), imported_papers: imported.updated_papers };
    await fs.writeFile(path.join(root, 'sync-result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  }
} else throw new Error('未知操作；可用 build / sync / search。');
