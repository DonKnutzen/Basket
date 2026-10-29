"""Contract/transport tests, NOT evidence of live model recognition accuracy."""
import io
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from german_flyer_vision import (VisionClient, VisionError, candidate, configured_client,
    analyze_visual_page, region_rect, REGIONS)


def product(**changes):
    value = dict(name='Coca-Cola, Fanta, Sprite oder Mezzo Mix', brand='',
        variant='verschiedene Sorten', category='Cola', packSize='1,25 l',
        basePrice='1 l = 0.95', regularPrice='1.69', conditions='',
        validFrom='2026-10-26', validUntil='2026-10-30',
        printedEvidence='Fanta, Coca-Cola, Sprite oder Mezzo Mix; je 1,25 l; 1.19',
        priceCents=119, priceKind='standard', minQuantity=1, uncertainties=[])
    value.update(changes)
    return value


def convert(value):
    return candidate(value, (0, 0, 100, 100), '2026-10-26', '2026-10-30', {'Cola', 'Chips'})


class FakePage:
    class Rect:
        width, height = 600, 800
        def __iter__(self): return iter((0, 0, 600, 800))
    rect = Rect()


class FakeClient:
    def __init__(self, replies): self.replies = iter(replies)
    def ask(self, *args): return next(self.replies)


class VisionTests(unittest.TestCase):
    def test_normal_app_and_neighbor_prices_remain_independent_unverified(self):
        discovery = {'regions':[{'bbox':[300,600,650,1000]}, {'bbox':[650,600,1000,1000]}], 'unresolved':[]}
        cola = [product(), product(priceCents=99, priceKind='loyalty',
            conditions='Nur mit PENNY App', basePrice='1 l = 0.79')]
        chips = [product(name='Pringles', category='Chips', packSize='185 g', priceCents=169,
            basePrice='1 kg = 9.14'), product(name='Pringles', category='Chips', packSize='185 g',
            priceCents=149, basePrice='1 kg = 8.05', priceKind='loyalty', conditions='Nur mit PENNY App')]
        with patch('german_flyer_vision.image', return_value=b'png'):
            result = analyze_visual_page(FakePage(), '2026-10-26', '2026-10-30',
                FakeClient([discovery, {'offers':cola,'unresolved':[]}, {'offers':chips,'unresolved':[]}]))
        self.assertEqual([o['data']['priceCents'] for o in result['offers']], [119,99,169,149])
        self.assertEqual({o['status'] for o in result['offers']}, {'review'})
        self.assertEqual(len({o['key'] for o in result['offers']}), 4)
        self.assertNotEqual(result['offers'][0]['bbox'], result['offers'][2]['bbox'])

    def test_mismatched_unit_price_does_not_become_a_sale_price(self):
        found = convert(product(priceCents=169))
        self.assertEqual(found['data']['priceCents'], 0)
        self.assertEqual(found['status'], 'unreadable')

    def test_missing_price_never_reconstructed_from_unit_price(self):
        self.assertEqual(convert(product(priceCents=None))['data']['priceCents'], 0)

    def test_conditional_price_requires_conditions_and_minimum(self):
        self.assertEqual(convert(product(priceKind='loyalty'))['data']['priceCents'], 0)
        multi = convert(product(priceCents=300, priceKind='multi', minQuantity=2,
            conditions='2 für 3.00', basePrice=''))
        self.assertEqual(multi['data']['priceCents'], 300)
        self.assertEqual(multi['data']['minQuantity'], 2)

    def test_no_catalogue_guess_or_missing_printed_evidence(self):
        self.assertEqual(convert(product(category='Butterkeks'))['data']['category'], '')
        self.assertEqual(convert(product(printedEvidence=''))['status'], 'unreadable')

    def test_bad_prices_dates_and_coordinates_rejected(self):
        for cents in (True, -1, 0, 1.99, 250001):
            with self.subTest(cents=cents), self.assertRaises(VisionError): convert(product(priceCents=cents))
        for date in ('2026-02-30', '2026-10-31', '2026-1-1'):
            with self.subTest(date=date), self.assertRaises(VisionError): convert(product(validUntil=date))
        for box in ([0,0,10,float('nan')], [50,0,10,100], [-1,0,100,100], [0,0,True,100]):
            with self.subTest(box=box), self.assertRaises(VisionError): region_rect(box, (0,0,600,800))

    def test_unresolved_page_is_failed_not_silently_empty_or_geometry_fallback(self):
        with patch('german_flyer_vision.image', return_value=b'png'):
            with self.assertRaises(VisionError):
                analyze_visual_page(FakePage(), '2026-10-26', '2026-10-30',
                    FakeClient([{'regions':[], 'unresolved':['Price/name association unclear']}]))

    def test_configuration_is_explicit_and_fails_closed(self):
        with patch.dict(os.environ, {}, clear=True): self.assertIsNone(configured_client())
        with patch.dict(os.environ, {'FLYER_RECOGNITION':'vision'}, clear=True):
            with self.assertRaises(VisionError): configured_client()

    def test_responses_transport_budget_privacy_and_refusal(self):
        class Opener:
            def __init__(self): self.response = {'status':'completed','output':[
                {'type':'message','content':[{'type':'output_text','text':'{"regions":[],"unresolved":[]}'}]}]}
            def open(self, req, timeout):
                self.req = req
                return io.BytesIO(json.dumps(self.response).encode())
        opener = Opener()
        client = VisionClient('test-secret', 'configured-model', max_calls=1, opener=opener)
        self.assertEqual(client.ask('read', b'png', REGIONS)['regions'], [])
        body = json.loads(opener.req.data)
        self.assertFalse(body['store'])
        self.assertNotIn('test-secret', opener.req.data.decode())
        self.assertEqual(opener.req.full_url, 'https://api.openai.com/v1/responses')
        self.assertEqual(body['input'][1]['content'][1]['detail'], 'high')
        with self.assertRaises(VisionError): client.ask('read', b'png', REGIONS)
        for reply in ({'status':'incomplete'}, {'status':'completed','output':[
            {'type':'message','content':[{'type':'refusal','refusal':'no'}]}]}):
            opener.response = reply
            with self.assertRaises(VisionError): VisionClient('test', 'model', opener=opener).ask('read', b'png', REGIONS)


if __name__ == '__main__': unittest.main()
