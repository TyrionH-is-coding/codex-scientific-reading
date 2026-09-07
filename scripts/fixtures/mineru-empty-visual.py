"""Issue #6 regression against the installed wheel, using synthetic data only."""
import hashlib
import json
import sys
from pathlib import Path

from scientific_reading.mineru_models import MineruContentItem
from scientific_reading.mineru_normalizer import MineruNormalizer
from scientific_reading.models import PaperMetadata

root = Path(sys.argv[1])
metadata = PaperMetadata(title="Synthetic issue six regression", authors=["Fixture"])
for kind in ("table", "image", "chart"):
    raw = root / kind / "raw"
    raw.mkdir(parents=True)
    values = [
        {"type": "text", "page_idx": 0, "bbox": [0, 0, 100, 20], "text": metadata.title},
        {"type": kind, "page_idx": 25, "bbox": [0, 0, 0, 0], "img_path": "", "table_body": ""},
        {"type": "text", "page_idx": 25, "bbox": [0, 0, 100, 20], "text": "Retained following text"},
    ]
    content = raw / "fixture_content_list.json"
    original = (json.dumps(values) + "\n").encode()
    content.write_bytes(original)
    output = root / kind / "normalized"
    result = MineruNormalizer().normalize(raw, output, metadata, "a" * 64)
    assert result.report.status == "parsed_mineru"
    assert result.blocks[-1].source_index == 2
    assert result.raw_content_list_sha256 == hashlib.sha256(original).hexdigest()
    report = json.loads((output / "parse_report.json").read_text(encoding="utf-8"))
    assert report["content_review_required"] is True
    assert report["omitted_items"][0]["page"] == 26
    assert content.read_bytes() == original
    try:
        MineruContentItem.from_dict({**values[1], "content": "Must not disappear"}, index=1)
    except ValueError as error:
        assert "mineru_visual_asset_required" in str(error)
    else:
        raise AssertionError("nonempty visual content was silently omitted")
print("PASS: installed wheel handles empty visuals, preserves raw hashes and rejects content loss")
