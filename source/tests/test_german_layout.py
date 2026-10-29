import unittest
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from german_flyer_layout import Box,price_anchors,price_column_cells,product_name_fragment,quantity,inferred_unit_pack,page_quality_counts,unit_check,whitespace_tiles,printed_date_ranges,panel_row_cell,panel_has_product,recover_lateral_description

class LayoutTests(unittest.TestCase):
    def test_lateral_description_requires_unique_matching_pack_and_base_price(self):
        rect=(135,149,225,249);price={'cents':159,'rect':(147,173,212,245)}
        boxes=[Box('Mövenpick Eis',(22,199,100,227),10),
               Box('850-ml-Packung',(22,226,124,246),8),Box('(Liter = 1.87)',(22,245,90,256),8)]
        self.assertIsNotNone(recover_lateral_description(rect,price,boxes,[price],476))
        self.assertIsNone(recover_lateral_description(rect,{**price,'cents':259},boxes,[price],476))
        second={'cents':199,'rect':(50,180,90,200)}
        self.assertIsNone(recover_lateral_description(rect,price,boxes,[price,second],476))
        self.assertIsNone(recover_lateral_description(rect,price,boxes[:2],[price],476))
    def test_base_price_check_requires_matching_units_and_explicit_denominator(self):
        self.assertTrue(unit_check(159,'850 ml','(Liter = 1.87)'))
        self.assertFalse(unit_check(159,'850 g','(Liter = 1.87)'))
        self.assertTrue(unit_check(299,'250 g','(100 g = 1.20)'))
        self.assertIsNone(unit_check(159,'850 ml','Liter = 1.87; Liter = 2.99'))

    def test_price_badge_is_not_mistaken_for_product_panel(self):
        badge=(135,149,225,257)
        boxes=[Box('1.',(147,173,177,245),55),Box('59',(166,178,197,231),40),
               Box('**',(199,186,212,207),16),Box('3.99',(195,231,220,254),17.5,True)]
        self.assertFalse(panel_has_product(badge,boxes))
        boxes.append(Box('Mövenpick Eis',(20,207,120,227),15))
        self.assertFalse(panel_has_product(badge,boxes))
        self.assertTrue(panel_has_product((10,140,225,260),boxes))

    def test_single_price_on_wide_panel_row_keeps_name_from_left_half(self):
        panel=(10,260,310,640);cell=(150,450,310,640)
        price={'rect':(250,580,295,625)}
        self.assertEqual(panel_row_cell(panel,cell,price,[price]),(10,450,310,640))
        other={'rect':(90,580,135,625)}
        self.assertEqual(panel_row_cell(panel,cell,price,[price,other]),cell)
        previous_row={'rect':(90,380,135,425)}
        self.assertEqual(panel_row_cell(panel,cell,price,[price,previous_row]),(10,450,310,640))

    def test_equivalent_multipack_totals_do_not_create_false_alternatives(self):
        self.assertEqual(quantity('900 g / 5x180 g'),('900 g',False))
        self.assertEqual(quantity('3 x 90 ml = 270 ml'),('3 x 90 ml',False))
        self.assertEqual(quantity('250 ml / 0,25 l'),('250 ml',False))
        self.assertTrue(quantity('250 ml / 0,5 l')[1])

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

    def test_red_bull_bottle_size_is_not_a_25_cent_sale_price(self):
        # ALDI page 9. The imported 0.25 L can was falsely read as
        # a 25-cent price; the €/l base price is 3.56, not a sale badge.
        spans=[
            Box('0,25-L-Dose',(170,780,204,788),9),
            Box('(Liter = 3.56)',(170,792,221,804),9),
            Box('zzgl. Pfand = 0.25',(170,766,223,778),9),
        ]
        found=price_anchors(spans)
        self.assertEqual([(p['cents'],p['role']) for p in found],[(25,'deposit')])
        self.assertEqual(price_anchors([Box('0,25-L-Dose',(170,780,204,788),9)]),[])

    def test_penny_name_is_preserved_when_pdf_puts_size_and_price_in_one_span(self):
        self.assertEqual(product_name_fragment('Coca-Cola Erfrischungsgetränk 1,25 l 1,19 €'),'Coca-Cola Erfrischungsgetränk')
        self.assertEqual(product_name_fragment('Coca-Cola Zero 1,25 l'),'Coca-Cola Zero')
        self.assertEqual(product_name_fragment('1,25 l'),'')
        self.assertEqual(product_name_fragment('zzgl. 0,25 € Pfand'),'')
        self.assertEqual(product_name_fragment('Nur mit PENNY App'),'')
        self.assertEqual(product_name_fragment('1 l = 0,95 €'),'')

    def test_base_prices_are_separate(self):
        self.assertEqual(price_anchors([Box('(1 kg = 7.16)',(0,0,80,15),10)]),[])
        self.assertTrue(unit_check(179,'250 g','(1 kg = 7.16)'))
        self.assertFalse(unit_check(179,'250 g','(1 kg = 9.99)'))
    def test_alternative_quantities_preserved(self):
        pack,ambiguous=quantity('je 2 l oder 4 l')
        self.assertTrue(ambiguous);self.assertEqual(pack,'2 l / 4 l')
        self.assertEqual(quantity('je 250-g-Pckg.'),('250 g',False))
    def test_future_flyers_infer_only_explicit_single_sales_units(self):
        samples={
            'SunGold Kiwi Klasse 1; Neuseeland; Stück':'1 Stück',
            'Speise- und Schnitzkürbis; Deutschland; Stück':'1 Stück',
            'unverpackt Bananen Lose Ware; Ecuador kg-Preis':'1 kg',
            'Bund Radieschen; je Bund':'1 Bund',
            'Erdbeeren Klasse I; Schale':'1 Schale',
            'Zitronen; Netz':'1 Netz',
            'Bio-Käse; Packung':'1 Packung',
            '250 g Gouda':'',
            'Bananen 1 Stück kg-Preis':'',
            'Kinder Spielzeug Stück für Stück':'',
            '': '',
        }
        for text,expected in samples.items():
            with self.subTest(text=text):
                self.assertEqual(inferred_unit_pack(text),expected)
        self.assertEqual(quantity('0,5 kg'),('0,5 kg',False))
        self.assertEqual(quantity('2 l / 4 l'),('2 l / 4 l',True))

    def test_weekly_audit_counts_are_only_diagnostic(self):
        preview={
            'status':'done',
            'offers':[
                {'status':'review','data':{'priceCents':59,'packSize':'1 Stück'},
                 'issues':['Einheit aus Produkttext erschlossen; Original prüfen']},
                {'status':'review','data':{'priceCents':0,'packSize':''},
                 'issues':['Mehrere Verkaufspreise / Produkte im selben Bereich']},
                {'status':'unreadable','data':{'priceCents':0,'packSize':''},'issues':[]},
            ],
        }
        self.assertEqual(page_quality_counts(preview),
          {'regions':3,'withPrice':1,'withoutPack':2,'inferredUnit':1,'ambiguousPrice':1,'unreadable':1})
        self.assertEqual(page_quality_counts({'status':'failed'}),{
          'regions':0,'withPrice':0,'withoutPack':0,'inferredUnit':0,'ambiguousPrice':0,'unreadable':0})

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
