"""Tests for manual REWE PDF link provenance, market and weekly expiry."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/"scripts"/"extract-rewe-kiel-weekly.py"
SPEC=importlib.util.spec_from_file_location("rewe_weekly",SCRIPT)
rewe=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(rewe)

GOOD={
 "schema":1,"marketId":"561204","city":"Kiel","week":"2026-W44",
 "validFrom":"2026-10-26","validUntil":"2026-10-31",
 "sourceUrl":"https://view.publitas.com/89773/3478778/pdfs/61827fae-6411-4697-a44c-0fca78d9da08.pdf?response-content-disposition=attachment%3B+filename%2A%3DUTF-8%27%27REWE%2520Markt%2520GmbH%2520-%2520rewe_2026_wk44_561204_v1.pdf",
 "suppliedBy":"market-link-manually-provided"
}

def load(data):
 with tempfile.TemporaryDirectory() as d:
  file=Path(d)/"current.json"
  file.write_text(json.dumps(data),encoding="utf-8")
  return rewe.load_source_config(file)

class ManualReweSourceTest(unittest.TestCase):
 def test_accept_personally_supplied_week44_link(self):
  config=load(GOOD)
  self.assertEqual(config["marketId"],"561204")
  self.assertEqual(config["week"],"2026-W44")
  self.assertEqual(config["validUntil"],"2026-10-31")
 def test_disallow_wrong_branch_wrong_week_and_official_looking_other_hosts(self):
  for changes in (
   {"marketId":"830872"},
   {"suppliedBy":"automatic-scraper"},
   {"week":"2026-W45"},
   {"validFrom":"2026-11-02"},
   {"validUntil":"2026-11-30"},
   {"validUntil":"2026-02-30"},
   {"sourceUrl":GOOD["sourceUrl"].replace("view.publitas.com","view.publitas.com.evil.example")},
   {"sourceUrl":GOOD["sourceUrl"].replace("/89773/","/12345/")},
   {"sourceUrl":GOOD["sourceUrl"].replace("_561204_","_830872_")},
   {"sourceUrl":GOOD["sourceUrl"].replace("wk44","wk45")},
   {"sourceUrl":GOOD["sourceUrl"].split("?")[0]},
  ):
   with self.subTest(changes=changes),self.assertRaises(ValueError):
    load({**GOOD,**changes})
 def test_expired_validated_source_never_fetched(self):
  past={**GOOD,"week":"2025-W44","validFrom":"2025-10-27","validUntil":"2025-11-01",
        "sourceUrl":GOOD["sourceUrl"].replace("2026_wk44","2025_wk44")}
  with tempfile.TemporaryDirectory() as d:
   config_path=Path(d)/"config.json"
   output_path=Path(d)/"price-summary.json"
   config_path.write_text(json.dumps(past),encoding="utf-8")
   with patch.object(rewe,"CONFIG",config_path),patch.object(rewe,"OUTPUT",output_path),patch.object(rewe.urllib.request,"urlopen",side_effect=AssertionError("Expired PDF must not be downloaded")):
    rewe.main()
   o=json.loads(output_path.read_text())
   self.assertEqual(o["status"],"expired")
   self.assertEqual(o["offers"],[])
   self.assertEqual(o["validUntil"],"2025-11-01")

if __name__=="__main__":
 unittest.main()
