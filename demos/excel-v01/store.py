"""独立 demo 数据库与逐字段三方合并，不连接生产文献库。"""
import json
import re
import sqlite3
import sys
import uuid
import zipfile
from xml.etree import ElementTree as ET
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

FIELDS = ("reading_state", "project_relevance", "next_action", "understanding_level", "personal_thoughts", "user_notes")


def merge_fields(baseline, current, incoming):
    changes, conflicts = {}, []
    for field in FIELDS:
        before, now, edit = (record.get(field, "") for record in (baseline, current, incoming))
        if edit == before or edit == now:
            continue
        if now != before:
            conflicts.append({"field": field, "baseline": before, "database": now, "excel": edit})
        else:
            changes[field] = edit
    return changes, conflicts


def main():
    root, action = Path(sys.argv[1]).resolve(), sys.argv[2]
    root.mkdir(parents=True, exist_ok=True)
    database = root / "demo-library.sqlite"
    if action == "finish_workbook":
        # Artifact Tool 的公开接口未给出列分组与 veryHidden；只补齐这些 XML 属性。
        book = Path(json.load(sys.stdin)["path"]).resolve()
        if book.parent != root or book.name != ".demo-next.xlsx":
            raise ValueError("demo_output_path_invalid")
        namespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
        ns = {"m": namespace}
        def tag(name):
            return "{" + namespace + "}" + name
        with zipfile.ZipFile(book) as archive:
            entries = [(item, archive.read(item.filename)) for item in archive.infolist()]
        fixed = []
        for item, body in entries:
            if item.filename == "xl/workbook.xml":
                xml = ET.fromstring(body)
                for sheet in xml.findall("m:sheets/m:sheet", ns):
                    if sheet.get("name") == "_同步":
                        sheet.set("state", "veryHidden")
                body = ET.tostring(xml, encoding="utf-8", xml_declaration=True)
            elif item.filename in ("xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml", "xl/worksheets/sheet3.xml"):
                xml = ET.fromstring(body)
                for cell in xml.findall(".//m:c", ns):
                    formula, cached = cell.find("m:f", ns), cell.find("m:v", ns)
                    if formula is not None and cached is not None and (formula.text or "").startswith("HYPERLINK("):
                        # 保留可在 Excel 计算的真实公式；修正生成库不支持函数时写出的无效错误缓存。
                        match = re.search(r',"((?:[^"]|"")*)"\)$', formula.text)
                        if match is None:
                            raise ValueError("hyperlink_label_invalid")
                        cell.set("t", "str")
                        cached.text = match.group(1).replace('""', '"')
                first = item.filename.endswith("sheet1.xml")
                for col in xml.findall("m:cols/m:col", ns):
                    start = int(col.get("min"))
                    if (first and start >= 13) or (not first and start >= 11):
                        col.set("hidden", "1")
                        if first and start < 19:
                            col.set("outlineLevel", "1")
                view = xml.find("m:sheetViews/m:sheetView", ns)
                if view is not None:
                    pane = view.find("m:pane", ns)
                    if pane is None:
                        pane = ET.Element(tag("pane")); view.insert(0, pane)
                    pane.attrib.update(xSplit="1", ySplit="7", topLeftCell="B8", activePane="bottomRight", state="frozen")
                    view.set("zoomScale", "85")
                body = ET.tostring(xml, encoding="utf-8", xml_declaration=True)
            fixed.append((item, body))
        with zipfile.ZipFile(book, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for item, body in fixed:
                archive.writestr(item, body)
        return {"status": "success"}
    with closing(sqlite3.connect(database)) as conn:
        conn.row_factory = sqlite3.Row
        if action == "init":
            fixture = json.loads(Path(__file__).with_name("fixture.json").read_text(encoding="utf-8"))
            conn.executescript("CREATE TABLE IF NOT EXISTS demo_meta(key TEXT PRIMARY KEY,value TEXT); CREATE TABLE IF NOT EXISTS papers(id TEXT PRIMARY KEY,payload TEXT); CREATE TABLE IF NOT EXISTS snapshots(id TEXT PRIMARY KEY,payload TEXT);")
            with conn:
                conn.execute("INSERT OR IGNORE INTO demo_meta VALUES('fixture',?)", (json.dumps(fixture, ensure_ascii=False),))
                for paper in fixture["papers"]:
                    conn.execute("INSERT OR IGNORE INTO papers VALUES(?,?)", (paper["id"], json.dumps(paper, ensure_ascii=False)))
            return {"status": "ready", "database": str(database)}
        fixture = json.loads(conn.execute("SELECT value FROM demo_meta WHERE key='fixture'").fetchone()[0])
        if action == "export":
            with conn:
                papers = [json.loads(row[0]) for row in conn.execute("SELECT payload FROM papers ORDER BY id")]
                snapshot_id = str(uuid.uuid4())
                baseline = {paper["id"]: {field: paper.get(field, "") for field in FIELDS} for paper in papers}
                conn.execute("INSERT INTO snapshots VALUES(?,?)", (snapshot_id, json.dumps(baseline, ensure_ascii=False)))
            return {**fixture, "papers": papers, "snapshot_id": snapshot_id}
        if action == "sync":
            request = json.load(sys.stdin)
            with conn:
                conn.execute("BEGIN IMMEDIATE")
                row = conn.execute("SELECT payload FROM snapshots WHERE id=?", (request["snapshot_id"],)).fetchone()
                if row is None:
                    return {"status": "pending", "error": "snapshot_unknown"}
                baseline = json.loads(row[0])
                incoming = request["papers"]
                ids = [item["id"] for item in incoming]
                if len(ids) != len(set(ids)) or set(ids) != set(baseline):
                    return {"status": "pending", "error": "paper_identity_mismatch"}
                edits, conflicts = [], []
                for item in incoming:
                    if any(not isinstance(item.get(field), str) for field in FIELDS):
                        return {"status": "pending", "error": "personal_field_invalid"}
                    if item["reading_state"] not in ("未读", "在读", "已读", "待复读"):
                        return {"status": "pending", "error": "reading_state_invalid"}
                    current_row = conn.execute("SELECT payload FROM papers WHERE id=?", (item["id"],)).fetchone()
                    if current_row is None:
                        return {"status": "pending", "error": "paper_missing"}
                    current = json.loads(current_row[0])
                    changes, issues = merge_fields(baseline[item["id"]], current, item)
                    conflicts.extend({"paper_id": item["id"], **issue} for issue in issues)
                    if changes:
                        edits.append({**current, **changes, "personal_updated_at": datetime.now(timezone.utc).isoformat()})
                if conflicts:
                    return {"status": "pending", "error": "personal_field_conflict", "conflicts": conflicts}
                for paper in edits:
                    conn.execute("UPDATE papers SET payload=? WHERE id=?", (json.dumps(paper, ensure_ascii=False), paper["id"]))
            return {"status": "success", "updated_papers": len(edits)}
        if action == "search":
            query = sys.argv[3].casefold()
            papers = [json.loads(row[0]) for row in conn.execute("SELECT payload FROM papers")]
            return {"papers": [{"id": paper["id"], "title": paper["title"], "updated_at": paper["personal_updated_at"]} for paper in papers if query in "\n".join([paper["title"], *(paper.get(field, "") for field in FIELDS)]).casefold()]}
        raise ValueError("unknown_action")


if __name__ == "__main__":
    print(json.dumps(main(), ensure_ascii=False))
