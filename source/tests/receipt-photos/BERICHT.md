# Belegscanner: Robustheit und Erkennungsqualität (Stand 2026-11-04)

Messung mit `scripts/receipt-benchmark.mjs` (Kennzahlen-Definitionen: `README.md`). Rohdaten je Lauf liegen lokal
in `results/baseline.json` (vorher) und `results/final.json` (nachher); Fotos und Ergebnisse sind nicht in git.

## A. Technische Architektur

1. **Aufnahme**: `<input type=file accept=image/* capture=environment>` (Kamera oder Upload). Safari liefert JPEG
   mit angewandter EXIF-Orientierung (`<img>` dekodiert orientiert); HEIC wird von iOS beim Upload in JPEG gewandelt.
2. **Canvas** (`app/scanner.tsx`): auf ~1600 px Breite skaliert (max. 4096 px Kante, max. 2,5×), weißer Hintergrund.
   Das Originalfoto bleibt unverändert als Vorschau erhalten.
3. **Vorverarbeitung** (`lib/receipt-image.ts` `prepareForOcr`): Papier ausschneiden (`findReceiptBounds`:
   Helligkeit minus Farbsättigung je Zelle, Otsu-Schwelle, größte zusammenhängende Fläche), Graustufen,
   auf ~1400 px Papierbreite skalieren (Mindestbreite 1000 px, iOS-Canvas-Grenze 12 MP), Kontrast ×1,15.
   Kein Drehen (gemessen: verschlechterte Kaufland/famila).
4. **OCR** (`lib/receipt-ocr.ts`): tesseract.js 7 (Tesseract LSTM, WASM im Browser, lokal auf dem Gerät, keine
   kostenpflichtige API), Sprachen `eng+deu` bei deutscher Oberfläche, sonst `eng`. Erster Durchgang PSM 4
   (eine Spalte); Zeilen werden aus Wortkoordinaten neu gebaut (`lib/receipt-layout.ts`), damit rechtsbündige Preise
   bei ihrem Namen bleiben. Geht die Summe nicht auf: bis zu 5 weitere Durchgänge (Sauvola-binarisiert, PSM 6/3/11),
   bester gewinnt nach „Summe geht auf > Summe gelesen > Tesseract-Konfidenz“. Danach ggf. Datum aus Streifen.
5. **Interpretation** (`lib/receipt-parser.ts`): Zeilen → Positionen, Mengen, Pfand, Rabatte, Steuer, Summe,
   Warnungen. **Speichern** ist im Review-Bildschirm nur möglich, wenn Summe und Positionen auf ±1 ct aufgehen,
   das Datum erkannt/bestätigt ist und unklare Rabatte abgehakt sind; jede Position ist vorher editierbar.

Tesseract-Konfidenz ist als Zuverlässigkeitsmaß schwach: Läufe mit 81–87 % Konfidenz hatten die ganze Preisspalte
verloren (Schatten). Die App nutzt sie deshalb nur als letzten Gleichstandsbrecher; maßgeblich ist der Summenabgleich.

## B. Nachgewiesene Fehlerursachen

| Ursache | Kategorie | Nachweis |
|---|---|---|
| Zuschnitt schnitt beschattetes Papier ab (globale Otsu-Schwelle) → Preisspalte fehlte komplett | Bildvorverarbeitung (Text nicht im Bild) | Schatten-Variante: Endbetrag 1/7, Paare 9/45; OCR-Text von Kaufland enthielt alle Namen, keinen Preis |
| Mengenzeile „2 @ $1.00 ea 2.00“ mit verlorenem „@“ wurde eigene Position ohne Namen | OCR-Lesefehler → Zuordnung | Superstore, ein OCR-Durchgang |
| Artikelnamen falsch/teilweise gelesen bei korrektem Preis (Matrix-/Thermodruck, Unschärfe) | OCR-Lesefehler | Superstore „MARUKOME MISO“ → „1083.29 ea“, Sri Thai „Radeberger“ fehlt |
| Überbelichtung: famila verliert 9 von 10 Paaren (Summe dennoch gefunden) | OCR, ausgefressener Druck | famila bright 1/10 |
| Blasser Druck: Summenzeile falsch gelesen | OCR | famila/Sri Thai faint |
| Shell: 0,00-Zeile „PUMP No. 03“ als Position | Parser (Zeile ≠ Artikel) | Shell dim |

## C. Lichtempfindlichkeit

Bestätigt, aber anders als vermutet: **gleichmäßig** dunkles oder gedämpftes Licht verkraftet die Pipeline
gut (DE dunkel 22/25 Paare, Endbeträge 7/7). Kritisch war **ungleichmäßiges** Licht (Schatten, Seitenlicht), weil
der Papierzuschnitt beschattete Bereiche als Hintergrund wertete. Behoben durch Hysterese im Zuschnitt: an die
helle Papierfläche angrenzende Zellen über der halben Schwelle gehören dazu (nur wenn dadurch nicht > 90 % des
Bildes erfasst werden). Kein zusätzlicher OCR-Durchgang, keine Laufzeitkosten. Weitere Filter (CLAHE, Schärfen,
Entrauschen) wurden nicht eingebaut, weil die Messung dafür keinen Bedarf belegte, der den Regressionsrisiken
gerecht würde; überbelichtet und blass bleiben offen (F).

## D. Geänderte Dateien

- `lib/receipt-image.ts` `findReceiptBounds`: Hysterese-Wachstum in beschattetes Papier. Test: `tests/receipt-image.test.ts`.
- `lib/receipt-parser.ts`: Mengenzeile ohne „@“ übernimmt den Namen darüber nur, wenn Anzahl × Stückpreis = Betrag. Test: `tests/receipt-realistic.test.ts`.
- Neu: `scripts/receipt-benchmark.mjs`, `tests/receipt-photos/README.md`, dieser Bericht, 7 Referenz-JSONs.

## E. Qualitätsvergleich (vorher → nachher)

Stichprobe: **7 echte iPhone-Fotos** (DE: Kaufland, famila, Sri Thai Restaurant; CA: Atlantic Superstore, Shell,
Tanner's Deli, Uprooted Market & Cafe), je 9 Bedingungen = 63 Läufe. Referenzen von Claude vom Foto
abgeschrieben, Summe geprüft, **noch nicht vom Nutzer bestätigt**. Die 8 Varianten je Foto sind nicht unabhängig.

| Gruppe | Endbetrag | Paare | Preise (ohne Name) | falsche Pos. | vollst. korrekt | unbemerkte Fehler |
|---|---|---|---|---|---|---|
| DE Original (3) | 3/3 → 3/3 | 25/25 → 25/25 | 25/25 | 0 → 0 | 3/3 → 3/3 | 0 → 0 |
| CA Original (4) | 4/4 → 4/4 | 15/20 → 15/20 | 17/20 | 2 → 2 | 2/4 → 2/4 | 0 → 0 |
| DE alle (27) | 21 → 24 | 180 → 192 /225 | 205/225 | 10 → 12 | 13 → 14 | 0 → 1 |
| CA alle (36) | 30 → 34 | 120 → 148 /180 | 161/180 | 15 → 19 | 18 → 20 | 0 → 2 |
| Schatten (7) | 1 → 7 | 9 → 36 /45 | 39/45 | 0 → 4 | 0 → 3 | 0 → 1 |
| Gesamt (63) | 51 → 58 | 300 → 340 /405 | 366/405 | 25 → 31 | 31 → 34 | 0 → 3 |

- Endbetrag gesamt 58/63 = 92 % (95 %-Wilson-Intervall 83–97 %); Originalfotos 7/7 (Untergrenze 65 %).
- Je Lauf verglichen: 12 besser, 3 schlechter. Regressionen: Shell unscharf liest „$63.13“ statt 63.19 (mit Warnung
  angezeigt), Shell und Sri Thai Seitenlicht jetzt mit Hinweis statt „sicher“ (Ergebnis weiterhin korrekt).
- Die 3 unbemerkten Fehler haben alle korrekte Preise und aufgehende Summe; falsch sind Namen bzw. eine 0,00-Zeile.
  Der Nutzer sieht sie im Review, die App markiert sie aber nicht.
- Verarbeitungszeit Node (6 parallel): Mittel 8 s, Maximum 20 s je Foto (vorher 9/23 s); iPhone-Safari deutlich langsamer.
- Gut beleuchtete Belege: keine Verschlechterung (Original DE 25/25, CA unverändert).
- **99 % ist mit diesem Bestand weder belegt noch widerlegbar**: dafür wären je Land einige Hundert unabhängige Belege nötig.

## F. Offene Risiken

- Überbelichtung/Reflexionen (famila 1/10 Paare) und blasser Thermodruck (Summen 4/7).
- Namen bei korrektem Preis: kein Warnsignal; falsche Namen gelangen nach Bestätigung in die Preishistorie.
- Kanada-Restaurants mit Trinkgeld/Modifikatoren nur 1 Beleg; keine Belege mit Rabattzeilen, Stornos, Coupons,
  Pfandrückgabe, > 30 Positionen; keine echten Fotos desselben Belegs bei echtem schlechten Licht.
- Fotounschärfe/abgeschnittener Text wird nicht vor der OCR erkannt; Hinweis kommt nur indirekt über die offene Differenz.
- Speicherung (Punkt 8: Duplikate bei erneutem Scan, EUR/CAD-Trennung, Teilfehler) wurde in diesem Durchgang
  nicht end-to-end getestet; geprüft ist nur die Speichersperre bei offener Differenz.
- Browser-OCR liest nicht bitgenau wie Node (bekannt: Shell „TOTAL FUEL 3.19“ in Chromium).

## G. Nächste Prioritäten

1. Referenzsatz um 15–20 echte Belege erweitern, je Beleg zusätzlich ein echtes Foto bei schlechtem Licht (Verfahren: README).
2. Unschärfe-/Überbelichtungsmaß (Laplace-Varianz, Anteil gesättigter Pixel) vor der OCR messen, an den Referenzen
   kalibrieren und bei Grenzwertüberschreitung einen konkreten Fotohinweis zeigen.
3. Unsicherheit je Position: niedrige Wortkonfidenz (Tesseract liefert sie je Wort) im Review hervorheben – erst nach
   Kalibrierung gegen die Referenzen, ob sie falsche Namen tatsächlich vorhersagt.
4. End-to-end-Test Speicherung → Preishistorie (Duplikate, Währungstrennung, Korrekturübernahme).
