"""为隔离样表生成可打开的合成原文、图和表；不用真实论文伪造结果。"""
import html
import json
import os
import subprocess
import sys
from pathlib import Path

from reportlab.graphics import renderPDF
from reportlab.graphics.shapes import Drawing, Line, PolyLine, Rect, String
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from pypdf import PdfReader

ROOT = Path(sys.argv[1]).resolve()
FIXTURE = json.loads(Path(__file__).with_name("fixture.json").read_text(encoding="utf-8"))
FONT = os.environ["DEMO_CJK_FONT"]
POPPLER = os.environ["DEMO_PDFTOPPM"]
pdfmetrics.registerFont(TTFont("DemoCJK", FONT))
INK, AMBER, GREEN = "#243746", "#B76930", "#357B72"


def graphic(asset):
    drawing = Drawing(480, 240)
    drawing.add(Rect(0, 0, 480, 240, fillColor=HexColor("#FAFAF8"), strokeColor=None))
    drawing.add(String(24, 215, f'{asset["label"]}  |  SYNTHETIC DEMO', fontName="Helvetica-Bold", fontSize=12, fillColor=HexColor(INK)))
    if asset["kind"] == "table":
        rows = [["Setting", "Condition A", "Condition B"], ["Trigger", "Demo low", "Demo high"], ["Sample", "Synthetic", "Synthetic"], ["Endpoint", "Peak / timing", "Peak / timing"]]
        for r, row in enumerate(rows):
            for col, text in enumerate(row):
                drawing.add(Rect(24 + col * 144, 165 - r * 38, 144, 38, fillColor=HexColor("#E8EEEC" if r == 0 else "#FFFFFF"), strokeColor=HexColor("#D6DEDC")))
                drawing.add(String(34 + col * 144, 180 - r * 38, text, fontName="Helvetica-Bold" if r == 0 else "Helvetica", fontSize=10, fillColor=HexColor(INK)))
        return drawing
    drawing.add(Line(55, 42, 55, 191, strokeColor=HexColor("#BFC9CF")))
    drawing.add(Line(55, 42, 448, 42, strokeColor=HexColor("#BFC9CF")))
    for n in range(1, 4):
        drawing.add(Line(55, 42 + n * 36, 448, 42 + n * 36, strokeColor=HexColor("#E6EBEA")))
    if asset["kind"] == "bar":
        for i, (value, color, label) in enumerate(zip([110, 37, 29], [AMBER, GREEN, INK], ["Test", "Control A", "Control B"])):
            drawing.add(Rect(89 + i * 118, 42, 52, value, fillColor=HexColor(color), strokeColor=None))
            drawing.add(String(80 + i * 118, 24, label, fontName="Helvetica", fontSize=10, fillColor=HexColor(INK)))
    else:
        series = [[0, 17, 40, 71, 98, 122], [0, 12, 29, 42, 55, 67], [0, 8, 14, 21, 29, 35]]
        if asset["kind"] == "curve":
            series = [[0, 9, 67, 133, 111, 71, 31, 10], [0, 4, 28, 72, 112, 86, 49, 22]]
        for values, color in zip(series, [AMBER, GREEN, INK]):
            points = []
            for i, value in enumerate(values):
                points.extend([55 + i * 375 / (len(values) - 1), 42 + value])
            drawing.add(PolyLine(points, strokeColor=HexColor(color), strokeWidth=2.8))
        drawing.add(String(193, 18, "Condition / time (demo)", fontName="Helvetica", fontSize=10, fillColor=HexColor(INK)))
    drawing.add(String(61, 183, "Simulated signal", fontName="Helvetica", fontSize=9, fillColor=HexColor(INK)))
    return drawing


def text_lines(pdf, text, x, y, width=470, size=10.5):
    pdf.setFont("DemoCJK", size)
    current = ""
    for char in text:
        if pdfmetrics.stringWidth(current + char, "DemoCJK", size) > width:
            pdf.drawString(x, y, current)
            current, y = char, y - 18
        else:
            current += char
    if current:
        pdf.drawString(x, y, current)
    return y - 24


style = """body{margin:0;background:#f5f4ef;color:#243746;font:16px/1.75 'Microsoft YaHei',sans-serif}main{max-width:880px;margin:36px auto;background:white;padding:40px 48px;border-radius:12px}h1{font-size:28px;line-height:1.45}h2{font-size:18px;margin-top:0}small,.muted{color:#6d7780}article{padding:22px 0;border-top:1px solid #e2e7e5;scroll-margin-top:24px}.notice{background:#fcf0de;padding:12px 16px;border-radius:8px}a{color:#357b72}img{max-width:100%;border:1px solid #dce3e0}table{border-collapse:collapse}td,th{padding:10px 18px;border:1px solid #dce3e0}nav{display:flex;gap:18px;margin:18px 0}article:target{background:#fff7e8} .figs{display:grid;gap:20px}figcaption{font-size:14px}footer{border-top:1px solid #e2e7e5;padding-top:16px;margin-top:24px} """

for paper in FIXTURE["papers"]:
    if not paper["pdf"]:
        continue
    folder = ROOT / "assets" / paper["id"]
    folder.mkdir(parents=True, exist_ok=True)
    records = [r for r in FIXTURE["records"] if r["paper_id"] == paper["id"]]
    assets = [a for a in FIXTURE["assets"] if a["paper_id"] == paper["id"]]
    max_page = max([1, *(a["page"] for a in assets)])
    pdf = canvas.Canvas(str(folder / "source.pdf"), pagesize=(595, 842))
    pdf.setTitle(f'{paper["title"]} - 合成演示资料')
    for page in range(1, max_page + 1):
        pdf.setFillColor(HexColor(INK))
        pdf.setFont("DemoCJK", 10)
        pdf.drawString(56, 794, "DEEP LITERATURE / 合成演示资料")
        pdf.setStrokeColor(HexColor("#D5DDDA"))
        pdf.line(56, 780, 539, 780)
        y = text_lines(pdf, paper["title"], 56, 748, size=19)
        y = text_lines(pdf, FIXTURE["notice"], 56, y - 8, size=10)
        if paper["id"] == "DEMO-005":
            y = text_lines(pdf, "版本变化演示：以下旧版记录仅供对照，新版本证据尚未完成复核。", 56, y, size=10)
        for record in [r for r in records if r["page"] == page]:
            y = text_lines(pdf, record["kind"] + " / " + record["review_state"], 56, y - 10, size=11)
            y = text_lines(pdf, record["text"], 56, y)
        if not records:
            text_lines(pdf, "此演示资料只模拟 PDF 已取得、解析仍在进行的状态。没有生成阅读成果。", 56, y)
        for asset in [a for a in assets if a["page"] == page]:
            drawing = graphic(asset)
            renderPDF.draw(drawing, pdf, 56, 170)
            text_lines(pdf, asset["caption"], 56, 145, size=10)
            chart_pdf = folder / (asset["id"] + ".chart.pdf")
            renderPDF.drawToFile(drawing, str(chart_pdf))
            subprocess.run([POPPLER, "-singlefile", "-scale-to", "1000", "-png", str(chart_pdf), str(folder / asset["id"])], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            chart_pdf.unlink()
            if asset["table"]:
                table = '<table><tr><th>条件</th><th>A 组</th><th>B 组</th></tr><tr><td>触发条件</td><td>演示低水平</td><td>演示高水平</td></tr><tr><td>样本</td><td>合成数据</td><td>合成数据</td></tr><tr><td>终点</td><td>峰值 / 时间</td><td>峰值 / 时间</td></tr></table>'
                (folder / (asset["id"] + ".html")).write_text(f'<!doctype html><meta charset="utf-8"><title>演示 Table 1</title><style>{style}</style><main><h1>Table 1</h1><p class="notice">合成演示表；结构待核对。</p>{table}<p><a href="reader.html#{asset["id"]}">返回图表上下文</a></p></main>', encoding="utf-8")
        pdf.setFont("DemoCJK", 9)
        pdf.drawString(56, 42, f'{paper["id"]}  /  第 {page} 页  /  不是真实论文')
        pdf.showPage()
    pdf.save()
    assert len(PdfReader(folder / "source.pdf").pages) == max_page
    if paper["reader"]:
        sections = []
        for record in records:
            sections.append(f'<article id="{record["id"]}"><h2>{html.escape(record["kind"])}</h2><p>{html.escape(record["text"])}</p><small>{html.escape(record["basis"])} / {html.escape(record["review_state"])}</small><p><a href="source.pdf#page={record["page"]}">查看 PDF 第 {record["page"]} 页</a></p></article>')
        for asset in assets:
            record = next(r for r in records if r["id"] == asset["record_id"])
            sections.append(f'<article id="{asset["id"]}"><h2>{asset["label"]}</h2><img src="{asset["id"]}.png" alt="{html.escape(asset["caption"])}"><p>{html.escape(asset["caption"])}</p><p><a href="#{record["id"]}">关联阅读记录</a>：{html.escape(record["text"])}</p><small>{asset["state"]} / PDF 第 {asset["page"]} 页</small></article>')
        page = f'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(paper["title"])} | Demo</title><style>{style}</style><main><small>DEEP LITERATURE / 阅读上下文演示</small><h1>{html.escape(paper["title"])}</h1><p class="notice">{FIXTURE["notice"]}</p><nav><a href="source.pdf">打开示例 PDF</a><a href="#R{records[0]["id"][1:]}">阅读记录</a></nav>{"".join(sections)}<footer>本页用于验证 Excel 的证据与图表跳转，不是生产 Reader。</footer></main></html>'
        (folder / "reader.html").write_text(page, encoding="utf-8")

print(json.dumps({"status": "success", "pdfs": 4, "figures_and_tables": len(FIXTURE["assets"])}, ensure_ascii=False))
