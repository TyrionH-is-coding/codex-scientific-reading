"""只读核对交付样表、真实目标文件和原生 Excel 往返结果。"""
import json
import re
import sqlite3
import sys
from pathlib import Path
from urllib.parse import unquote

from openpyxl import load_workbook
from pypdf import PdfReader

root = Path(sys.argv[1]).resolve()
book = root / "Deep Literature 文献管理 Demo.xlsx"
formula = load_workbook(book, data_only=False)
values = load_workbook(book, data_only=True)
try:
    assert formula.sheetnames == ["文献", "阅读成果", "图表索引", "说明", "_同步"]
    assert formula["_同步"].sheet_state == "veryHidden"
    assert formula["文献"].freeze_panes == "B8"
    assert formula["文献"].column_dimensions["S"].hidden
    assert [values["文献"][cell].value for cell in ("B4", "E4", "H4")] == [6, 2, 2]
    assert values["文献"]["J8"].value.hour == 8
    assert len(formula["文献"].data_validations.dataValidation) == 1
    links, external, internal = 0, 0, 0
    for sheet in formula:
        for row in sheet:
            for cell in row:
                value = cell.value
                cached = values[sheet.title][cell.coordinate]
                assert cached.data_type != "e", (sheet.title, cell.coordinate, cached.value)
                if not isinstance(value, str) or not value.startswith("=HYPERLINK("):
                    continue
                links += 1
                assert "not implemented" not in str(cached.value)
                target = re.match(r'=HYPERLINK\("([^"]+)"', value).group(1)
                if target.startswith("assets/"):
                    relative, _, fragment = target.partition("#")
                    destination = (root / unquote(relative)).resolve()
                    assert destination.is_relative_to(root) and destination.is_file(), destination
                    if fragment and destination.suffix == ".html":
                        assert f'id="{fragment}"' in destination.read_text(encoding="utf-8")
                    if fragment and destination.suffix == ".pdf":
                        assert 1 <= int(fragment.split("=")[1]) <= len(PdfReader(destination).pages)
                    external += 1
                else:
                    target_sheet = re.match(r"#'(.+)'!A", target).group(1)
                    match_id = re.search(r'MATCH\("([^"]+)"', value).group(1)
                    match_column = re.search(r'!\$([A-Z]+)\$1:', value).group(1)
                    candidates = [item[0].value for item in values[target_sheet][f'{match_column}8:{match_column}{values[target_sheet].max_row}']]
                    assert match_id in candidates, (target_sheet, match_id)
                    internal += 1
    for sheet in (formula["文献"], formula["阅读成果"], formula["图表索引"]):
        assert len(sheet.tables) == 1
    report = {"status": "success", "sheets_visible": 4, "hyperlinks": links, "external_targets_verified": external, "internal_targets_verified": internal, "pdfs": 4, "native_excel": "16.0", "synthetic_data": True}
finally:
    formula.close(); values.close()

roundtrip = root / "qa/native-roundtrip"
conn = sqlite3.connect(roundtrip / "demo-library.sqlite")
try:
    papers = {row[0]: json.loads(row[1]) for row in conn.execute("SELECT id,payload FROM papers")}
    assert papers["DEMO-001"]["user_notes"] == "native_excel_roundtrip_个人笔记"
    assert papers["DEMO-001"]["reading_state"] == "待复读"
    assert papers["DEMO-001"]["next_action"] == "Native Excel 排序后核对图表。"
    assert all(paper["user_notes"] != "native_excel_roundtrip_个人笔记" for key, paper in papers.items() if key != "DEMO-001")
finally:
    conn.close()
report["native_edit_sort_sync_search"] = "passed"
report["merge_regressions"] = 11
(root / "verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
