"""Weekly processing must expose incomplete pages and reject bad local input."""
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch, MagicMock

SCRIPTS=Path(__file__).resolve().parents[1]/'scripts'
sys.path.insert(0,str(SCRIPTS))
spec=importlib.util.spec_from_file_location('weekly_queue_runner',SCRIPTS/'process-german-flyers.py')
runner=importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)

class WeeklyImportTests(unittest.TestCase):
    def run_report(self,results):
        with tempfile.TemporaryDirectory() as tmp:
            pdf=Path(tmp)/'flyer.pdf';pdf.write_bytes(b'original fixture bytes')
            out=Path(tmp)/'report'
            doc=MagicMock();doc.__enter__.return_value=doc
            doc.needs_pass=False;doc.__len__.return_value=len(results)
            doc.__iter__.return_value=iter([types.SimpleNamespace(rect=(0,0,100,100)) for _ in results])
            with patch.dict(sys.modules,{'fitz':types.SimpleNamespace(open=lambda _:doc)}), \
                 patch.object(runner,'analyze_page',side_effect=results), \
                 patch.object(runner,'save_evidence'),contextlib.redirect_stdout(io.StringIO()):
                status=runner.local(pdf,out,'2026-11-02','2026-11-07')
            return status,json.loads((out/'analysis.json').read_text(encoding='utf-8'))

    def test_failed_page_remains_reported_and_fails_command(self):
        status,report=self.run_report([{'status':'done','offers':[]},RuntimeError('OCR unavailable')])
        self.assertEqual(status,1)
        self.assertEqual(report['totalPages'],2)
        self.assertEqual(report['processingStatus'],'failed')
        self.assertEqual(report['quality']['failedPages'],[2])
        self.assertEqual(report['quality']['emptyPages'],[1])
        self.assertEqual(report['quality']['reviewPages'],[1,2])

    def test_successful_extraction_has_provenance_and_still_requires_review(self):
        proposal={'key':'tile','bbox':(0,0,50,50),'status':'review','issues':[],
                  'data':{'priceCents':89,'packSize':'250 ml'}}
        status,report=self.run_report([{'status':'done','offers':[proposal]}])
        self.assertEqual(status,0)
        self.assertEqual(report['processingStatus'],'processed')
        self.assertEqual(report['sha256'],hashlib.sha256(b'original fixture bytes').hexdigest())
        self.assertEqual(report['validFrom'],'2026-11-02')
        self.assertEqual(report['validUntil'],'2026-11-07')
        self.assertTrue(report['requiresOriginalReview'])
        self.assertEqual(report['quality']['regions'],1)
        self.assertEqual(report['quality']['reviewPages'],[])

    def test_missing_price_or_unit_is_an_actionable_page(self):
        proposal={'key':'tile','bbox':(0,0,50,50),'status':'review','issues':[],
                  'data':{'priceCents':0,'packSize':''}}
        _,report=self.run_report([{'status':'done','offers':[proposal]}])
        self.assertEqual(report['quality']['reviewPages'],[1])
        self.assertEqual(report['quality']['withoutPack'],1)

    def test_local_argument_errors_never_start_queue(self):
        cases=[['--out','report'],['--pdf','missing.pdf'],
               ['--pdf','x.pdf','--out','r','--from','bad','--until','2026-11-07'],
               ['--pdf','x.pdf','--out','r','--from','2026-11-07','--until','2026-11-02']]
        for args in cases:
            with self.subTest(args=args),patch.object(sys,'argv',['runner',*args]), \
                 patch.object(runner,'Gateway') as gateway,contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as error:runner.main()
                self.assertEqual(error.exception.code,2)
                gateway.assert_not_called()

if __name__=='__main__':unittest.main()
