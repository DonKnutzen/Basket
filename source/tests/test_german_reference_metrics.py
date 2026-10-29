import sys
from pathlib import Path
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from german_reference_metrics import measure,target_99_met

class ReferenceMetricsTests(unittest.TestCase):
    def test_missed_or_duplicate_names_cannot_inflate_accuracy(self):
        refs=[{'name':'Butter','priceCents':149,'sizes':['250 g']}]
        candidate={'data':{'name':'Butter','priceCents':149,'packSize':'250 g'}}
        self.assertEqual(measure(refs,[])['correctProductPricePairs'],0)
        self.assertEqual(measure(refs,[candidate,candidate])['correctProductPricePairs'],0)
        self.assertEqual(measure(refs,[candidate])['correctProductPricePairs'],1)
    def test_one_candidate_cannot_satisfy_two_reference_products(self):
        refs=[{'name':n,'priceCents':149,'sizes':['250 g']} for n in ['Butter','Käse']]
        result=measure(refs,[{'data':{'name':'Butter und Käse','priceCents':149,'packSize':'250 g'}}])
        self.assertEqual(result['namesFound'],1)
    def test_wrong_or_absent_prices_count_against_recall(self):
        refs=[{'name':'Butter','priceCents':149,'sizes':['250 g']}]
        for cents in (0,199):
            result=measure(refs,[{'data':{'name':'Butter','priceCents':cents,'packSize':''}}])
            self.assertEqual(result['correctProductPricePairs'],0)
            self.assertEqual(result['quantitiesPreserved'],0)
            self.assertEqual(result['wrongProductPricePairs'],int(cents>0))
    def test_small_or_development_sample_never_proves_production_target(self):
        perfect={'referenceRegions':100,'namesFound':100,'correctProductPricePairs':100,'quantitiesPreserved':100,'wrongProductPricePairs':0,'requiresReview':100,'allFieldsCorrect':100}
        self.assertFalse(target_99_met([perfect]))
        self.assertTrue(target_99_met([perfect],True,True))
        self.assertFalse(target_99_met([{**perfect,'referenceRegions':19,'namesFound':19,'correctProductPricePairs':19,'quantitiesPreserved':19}],True,True))
        self.assertFalse(target_99_met([{**perfect,'correctProductPricePairs':98}],True,True))
        self.assertFalse(target_99_met([{**perfect,'requiresReview':110}],True,True))

if __name__=='__main__':unittest.main()
