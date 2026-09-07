import copy
import json
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from store import FIELDS, merge_fields


class FieldMergeTests(unittest.TestCase):
    def setUp(self):
        self.base = {field: "旧值" for field in FIELDS}

    def test_unchanged_workbook_preserves_new_database_value(self):
        current = {**self.base, "user_notes": "库内新笔记"}
        self.assertEqual(merge_fields(self.base, current, self.base), ({}, []))

    def test_explicit_clear_is_an_edit(self):
        self.assertEqual(merge_fields(self.base, self.base, {**self.base, "user_notes": ""}), ({"user_notes": ""}, []))

    def test_both_sides_same_edit_does_not_conflict(self):
        updated = {**self.base, "user_notes": "共同的新值"}
        self.assertEqual(merge_fields(self.base, updated, updated), ({}, []))

    def test_conflict_preserves_three_values(self):
        _, conflicts = merge_fields(self.base, {**self.base, "user_notes": "库内"}, {**self.base, "user_notes": "表内"})
        self.assertEqual(conflicts, [{"field": "user_notes", "baseline": "旧值", "database": "库内", "excel": "表内"}])

    def test_independent_fields_can_merge(self):
        self.assertEqual(merge_fields(self.base, {**self.base, "user_notes": "库内"}, {**self.base, "next_action": "核对"}), ({"next_action": "核对"}, []))


class DemoStoreTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="deep-literature-demo-test-")
        self.root = Path(self.directory.name).resolve()
        self.call("init")
        self.export = self.call("export")

    def tearDown(self):
        self.directory.cleanup()

    def call(self, action, payload=None, args=()):
        result = subprocess.run([sys.executable, str(Path(__file__).with_name("store.py")), str(self.root), action, *args], input=json.dumps(payload) if payload else None, text=True, encoding="utf-8", capture_output=True, check=True)
        return json.loads(result.stdout)

    def request(self):
        return {"snapshot_id": self.export["snapshot_id"], "papers": copy.deepcopy(self.export["papers"])}

    def database_edit(self, notes):
        conn = sqlite3.connect(self.root / "demo-library.sqlite")
        try:
            current = json.loads(conn.execute("SELECT payload FROM papers WHERE id='DEMO-001'").fetchone()[0])
            current["user_notes"] = notes
            conn.execute("UPDATE papers SET payload=? WHERE id='DEMO-001'", (json.dumps(current),))
            conn.commit()
        finally:
            conn.close()

    def test_reordered_rows_preserve_identity_and_search(self):
        request = self.request()
        request["papers"][0]["user_notes"] = "unique_personal_demo_检索"
        request["papers"].reverse()
        result = self.call("sync", request)
        self.assertEqual(result, {"status": "success", "updated_papers": 1})
        found = self.call("search", args=("unique_personal_demo_检索",))["papers"]
        self.assertEqual([row["id"] for row in found], ["DEMO-001"])
        self.assertNotEqual(found[0]["updated_at"], self.export["papers"][0]["personal_updated_at"])

    def test_old_snapshot_does_not_overwrite_database(self):
        self.database_edit("数据库最新笔记")
        self.assertEqual(self.call("sync", self.request()), {"status": "success", "updated_papers": 0})
        self.assertEqual(self.call("export")["papers"][0]["user_notes"], "数据库最新笔记")

    def test_conflict_does_not_partially_commit(self):
        self.database_edit("数据库最新笔记")
        request = self.request()
        request["papers"][0]["user_notes"] = "Excel 不同的新笔记"
        request["papers"][1]["next_action"] = "不应该局部写入"
        result = self.call("sync", request)
        self.assertEqual(result["error"], "personal_field_conflict")
        actual = self.call("export")["papers"]
        self.assertEqual(actual[0]["user_notes"], "数据库最新笔记")
        self.assertEqual(actual[1]["next_action"], self.export["papers"][1]["next_action"])

    def test_duplicate_identity_defers_without_writing(self):
        request = self.request()
        request["papers"][1]["id"] = request["papers"][0]["id"]
        self.assertEqual(self.call("sync", request)["error"], "paper_identity_mismatch")

    def test_unknown_snapshot_defers(self):
        request = self.request(); request["snapshot_id"] = "unknown"
        self.assertEqual(self.call("sync", request)["error"], "snapshot_unknown")

    def test_invalid_reading_state_defers(self):
        request = self.request(); request["papers"][0]["reading_state"] = "下载完成"
        self.assertEqual(self.call("sync", request)["error"], "reading_state_invalid")


if __name__ == "__main__":
    unittest.main()
