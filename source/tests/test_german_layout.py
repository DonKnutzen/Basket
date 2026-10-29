import unittest
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from german_flyer_layout import Box,price_anchors,price_column_cells,quantity,unit_check,whitespace_tiles,printed_date_ranges

class LayoutTests(unittest.TestCase):
    def test_overlapping_typographic_euro_and_cent_boxes(self):
        boxes=[Box('1.',(175,396,199,437),41),Box('79',(190,399,215,428),29)]
        found=price_anchors(boxes)
        self.assertEqual(len(found),1);self.assertEqual(found[0]['cents'],179)
    def test_distant_cent_block_not_joined(self):
        boxes=[Box('1.',(10,10,30,50),41),Box('99',(200,12,225,45),29)]
        self.assertEqual(price_anchors(boxes),[])
    def test_old_price_bonus_credit_and_deposit_are_not_sale_prices(self):
        found=price_anchors([Box('2,29',(0,0,50,15),12,True),Box('0,10 €',(100,0,145,15),14),Box('Bonus',(100,15,140,26),11),Box('zzgl. 0.25 Pfand',(0,60,80,72),9)])
        self.assertEqual([x['role'] for x in found],['regular','bonus-credit','deposit'])
    def test_penny_bottle_size_date_and_percentage_are_not_prices(self):
        # In PENNY leaflets "1,25 l" is the pack size; it must not become
        # a third sale price next to the regular and app-only badges.
        spans=[
            Box('1,25 l',(10,10,50,24),12),
            Box('1,19 €',(10,40,55,57),18),
            Box('0,99 €',(10,70,55,87),18),
            Box('gültig 26.10.2026',(10,100,130,115),12),
            Box('20,00 %',(10,130,70,145),12),
            Box('zzgl. 0,25 € Pfand',(10,160,125,175),12),
        ]
        found=price_anchors(spans)
        self.assertEqual([(x['cents'],x['role']) for x in found],[
            (119,'selling'),(99,'selling'),(25,'deposit')])
        mixed=price_anchors([Box('1,25 l Flasche, 1,19 €',(10,20,180,38),15)])
        self.assertEqual([x['cents'] for x in mixed],[119])

    def test_base_prices_are_separate(self):
        self.assertEqual(price_anchors([Box('(1 kg = 7.16)',(0,0,80,15),10)]),[])
        self.assertTrue(unit_check(179,'250 g','(1 kg = 7.16)'))
        self.assertFalse(unit_check(179,'250 g','(1 kg = 9.99)'))
    def test_alternative_quantities_preserved(self):
        pack,ambiguous=quantity('je 2 l oder 4 l')
        self.assertTrue(ambiguous);self.assertEqual(pack,'2 l / 4 l')
        self.assertEqual(quantity('je 250-g-Pckg.'),('250 g',False))
    def test_real_whitespace_separates_side_by_side_regions(self):
        tiles=whitespace_tiles((0,0,400,500),[(10,20,100,80),(10,100,100,200),(250,20,350,80),(250,100,350,200)])
        self.assertGreaterEqual(len(tiles),2)
        self.assertTrue(any(t[2]<=250 for t in tiles));self.assertTrue(any(t[0]>=100 for t in tiles))
    def test_real_aldi_holiday_range_is_friday_not_guessed_saturday(self):
        hints=printed_date_ranges('Gültig von Mo. 26.10. bis Fr. 30.10.',2026)
        self.assertEqual(hints[0]['until'],'2026-10-30');self.assertTrue(hints[0]['yearFromImport'])
        self.assertEqual(printed_date_ranges('31.02. bis 32.02.',2026),[])
        self.assertEqual(printed_date_ranges('28.12. bis 02.01.',2026)[0]['until'],'2027-01-02')
    def test_penny_cola_and_pringles_price_columns_stay_separate(self):
        # Coordinates are from the printed first-page PENNY review panel.
        panel=(166.3,538.6,459.2,799.4)
        anchors=[{'rect':box} for box in [
            (238.8,700.7,283.3,727.6), # Coca-Cola standard price
            (221.5,755.9,288.3,796.2), # Coca-Cola app price
            (256.1,622.7,282.1,631.7), # Coca-Cola size annotation
            (395.8,700.7,440.4,727.6), # Pringles standard price
            (378.6,755.9,445.4,796.2), # Pringles app price
            (410.1,641.5,440.7,650.5)]]
        cells=price_column_cells(panel,anchors)
        self.assertEqual(len(cells),2)
        self.assertLess(cells[0][2],cells[1][2])
        self.assertEqual(price_column_cells(panel,anchors[:3]),[])

if __name__=='__main__':unittest.main()
