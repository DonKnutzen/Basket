# Bon-Erkennung: bisherige Arbeit, Erkenntnisse und Fallen

## Korrekturen nach dem REWE-Audit vom 05.11.2026

### Ergänzung nach dem iPhone-Screenshot: zu viele Positionen

- Eine Namensbox ist kein zuverlässiger Zeilenanker: verzerrte oder zusammengefasste
  Namen konnten denselben rechts gedruckten Betrag mehrfach übernehmen. Dazu kamen
  linke Mengen-/Einzelpreise als falsche Buchungen (`5 Stk ... 0,15`, `5 Sk ... 0,25`).
- `receipt-price-column.ts` erkennt eine wiederholt belegte rechte Betragsspalte
  aus Wort-/Symbolkoordinaten, einschließlich leichter Perspektive. Die Fusion
  verankert Buchungen jetzt an diesen Preispositionen. Gleicher Preis an zwei
  verschiedenen Bildpositionen bleibt zwei Buchungen; mehrere OCR-Lesungen derselben
  Preisposition werden nur einmal übernommen. Abstimmungen zählen pro Durchlauf.
- Linke Stück-/Pfandwerte bleiben Zusatzinformation. Mengen werden weiterhin nur
  bei passender Position und Anzahl × Einzelpreis an eine echte Buchung gehängt.
  Getrennte OCR-Tokens wie `-0,` und `50` brauchen benachbarte Glyphboxen und behalten
  das Vorzeichen. Der Summenabgleich ersetzt diese räumliche Prüfung nicht.
- Bei Text ohne Koordinaten oder ohne belastbare rechte Spalte bleibt der bisherige
  Parser verfügbar. Umgebrochene Einzelpreise und explizites Trinkgeld haben eigene
  Layout-Ausnahmen. Deshalb ist dies keine pauschale Regel für sämtliche Bonarten.
- Regressionen in `receipt-price-column.test.ts` prüfen die zusätzlichen linken
  Werte, die doppelte 1,19, echte wiederholte Produkte, Pfandrückgaben und die
  Ausnahmen. Neuer lokaler OCR-Lauf des Originalfotos: 19 Buchungen, alle Beträge
  korrekt, Summe 21,99 EUR. Der neue iPhone-Lauf muss noch im echten Browser erfolgen.

- Neue lokale Regressionen: `tests/receipt-regressions.test.ts`, Eingaben unter
  `tests/receipt-inputs/`. Das beschädigte OCR kann fehlendes RB ENERGY nicht
  rekonstruieren; mehrere Fotodurchläufe lesen es dagegen tatsächlich.
- `receipt-merge.ts` vereinigt bereits gelesene Buchungen anhand ihrer Bildposition,
  erhält wiederholte Produkte und stimmt Preise ab. Unsichere Namen/Preise bleiben
  sichtbar; die Summendifferenz wird nicht durch einen Ausgleichsartikel geschlossen.
- `SUPPE` darf keine Summenzeile sein. Weiter entfernte Summenlesungen wie `Sune`
  benötigen eine passende unabhängige Zahlungszeile. Centwerte werden nicht erneut
  mit 100 multipliziert. Gedruckte Zahlungen werden nicht an die Artikelsumme angepasst.
- Rückgabemengen werden mit dem Betrag ohne Vorzeichen abgeglichen. Mengen aus
  anderen Durchläufen benötigen außerdem passende Position und Anzahl × Stückpreis.
- Ein Tagesfragment ist `inferred`, kein vollständig erkanntes Datum. Ein
  widersprüchliches oder zeitlich unplausibles OCR-Datum braucht Bestätigung.
- Die Datumsnachlese prüft nach jedem Ausschnitt. Ist das Feld lokalisiert, werden
  nur seine Ausschnitte gelesen; sonst bleiben überlappende Streifen der Rückfall.
  Standardbudget für Datum: 12 s; ein laufender OCR-Aufruf kann darüber hinausgehen.
- Die Prüfansicht markiert strukturell unklare Namen und widersprüchliche Lesungen.
  Das ist keine behauptete statistische Kalibrierung eines Konfidenz-Grenzwerts.
  Unklare Namen müssen korrigiert oder bestätigt werden; dies prüft auch der Server.
- Kontrolllauf des neuen REWE-Fotos in Node: vorher 7 Buchungen, 14,80 EUR Differenz,
  26 OCR-Aufrufe; danach 19 Buchungen, alle 19 Beträge korrekt, Differenz 0, 10 Aufrufe.
  Datumsnachlese 8,8 → 1,7 s. Mehrere Namen und das Datum benötigen weiterhin Review.
  Das belegt keine iPhone-Laufzeit und keine Zuverlässigkeitsquote für neue Belege.
- Bisheriger Textkorpus unverändert bei 25/25 Endbeträgen und 23/25 Artikeln;
  MIN_* unverändert. Die sieben alten Referenzfotos fehlen weiterhin lokal.

Die folgenden älteren Notizen beschreiben zum Teil frühere Implementierungsstände;
für die neuen Verhaltensweisen gilt die Ergänzung oben.

Stand 2026-11-05. Für alle, die die Erkennung prüfen oder verbessern. Ergänzt `BERICHT.md` (Messwerte vom 2026-11-04)
und `README.md` (Benchmark). Vieles hier stammt aus Commit-Texten und Notizen und wurde nicht einzeln neu gemessen:
vor einer Entscheidung immer selbst nachmessen.

## 1. Was der Nutzer als gut bewertet

- Es zählen vor allem Kaufdatum, Endbetrag, Artikel-Preis-Paare und bei Tankbons der Literpreis (PRICE/L).
- Getestet wird mit echten iPhone-Fotos: Kaufland Kiel, famila Kiel, Sri Thai Kiel, Atlantic Superstore, Shell
  Dartmouth, Tanner's Deli Halifax, Uprooted Market. Außerdem im Alltag: Giant Tiger.
- Datumsformate: kanadische Bons meist `YYYY/MM/DD` oder `YYYY-MM-DD`, Kartenbelege auch `YY/MM/DD` oder `MM/DD/YY`;
  deutsche Bons `DD.MM.YY`.

## 2. Was bereits umgesetzt ist

Ablauf: Foto → `prepareForOcr` → `readReceiptPhoto` → `parseReceipt` → Prüfansicht → `saveReceipt`.

**Bild (`lib/receipt-image.ts`)**
- Papierzuschnitt über Helligkeit minus Farbsättigung, Otsu-Schwelle, größte Fläche.
- Hysterese: Zuschnitt wächst bis zur halben Schwelle in beschattetes Papier. Vorher schnitt ein Schatten über der
  Preisspalte alle Preise ab (Schatten-Variante: Endbeträge 1/7 → 7/7, Paare 9/45 → 36/45).
- Graustufen, etwa 1400 px Papierbreite, Kontrast ×1,15.
- Fotohinweis bei zu dunklem, überbelichtetem oder blassem Foto (`ea0346f`).

**OCR (`lib/receipt-ocr.ts`, `lib/receipt-layout.ts`)**
- tesseract.js 7, lokal auf dem Gerät. Sprachen `eng+deu` bei deutscher Oberfläche, sonst `eng`.
- Erster Durchgang PSM 4; Zeilen werden aus Wortkoordinaten neu gebaut, damit rechtsbündige Preise beim Namen bleiben.
- Geht die Summe nicht auf: bis zu 5 weitere Durchgänge (Sauvola, PSM 6/3/11).
  Rangfolge: Summe geht auf > Summe gelesen > Tesseract-Konfidenz.
- Zeilenweise Abstimmung über vorhandene Durchgänge, wenn keiner aufgeht (`1b82770`).
- Datum per Streifen-Nachlese und aus allen Durchgängen.
- Angeklebter MwSt-Buchstabe ("2,398" statt "2,39 B") wird über Symbolkoordinaten abgetrennt (`278c2b4`).
- Unsicher gelesene Namen werden markiert, kalibriert an den Referenzen (`914160a`).

**Parser (`lib/receipt-parser.ts`, `lib/receipt-date.ts`)**
- Mengenzeilen; ohne gelesenes "@" nur dann, wenn Anzahl × Stückpreis = Betrag.
- Mehrzeilige Namen, umbrochene Preise, Preis eine Zeile unter dem Namen, auch mit Rauschen ("NE $12.50").
- Unlesbare Preise: aus Zwischensumme ableiten, oder Artikel mit leerem Preis behalten statt verwerfen.
- OCR-Fehler bei Schlüsselwörtern: "Sune" für "Summe", "1b" für "lb", "€ B" als "€8".
- famila: fehlt der Betrag hinter "Summe" und ist die EC-Zeile verlesen, gilt die Artikelsumme, wenn sie sich um
  höchstens zwei Ziffern unterscheidet, mit Hinweis.
- Restaurants: Zahlung und MwSt-Tabelle beenden die Artikelliste, Trinkgeld aus Zahlung minus Rechnung.
- Tanken: Sorte (Bronze, Silver, V-Power), TOTAL FUEL ist Tankzeile, Literpreis gegen Summe ÷ Liter geprüft.
- Land und Währung auch ohne lesbaren Ort: Provinzkürzel, HST/GST, Interac, Litres, Bronze, $-Beträge.
- Ladenname: überspringt "Welcome"-Zeilen, Orte sind nie Ladenname, gelernte Läden zählen.
- Datum: tt.mm.yy mit angeklebter 24-h-Uhrzeit; verstümmeltes "Datum: 02." aus Tag und Scandatum der letzten 7 Tage.

**Kategorien (`lib/types.ts`)**
- `receiptCategory()` ist die Scan-Logik, `inferCategory()` die ältere Grobzuordnung.
  Beispiel: "Apples" ergibt bei `receiptCategory` Fruit, bei `inferCategory` Produce.
- Korrekturen werden gemerkt: Umbenennung als Alias je Laden, Kategorie am Produkt.

**Tests und Messung**
- Korpus: `tests/receipt-ocr-corpus/` mit echten OCR-Texten. Letzter Stand: Endbeträge 25/25, Artikel 23/25.
- Benchmark: 7 Fotos × 9 Lichtbedingungen = 63 Läufe, Stand 2026-11-04 vor späteren Verbesserungen:
  Endbeträge 58/63, Paare 340/405. Originalfotos: Endbeträge 7/7, Paare DE 25/25, CA 15/20.

## 3. Was nicht half oder zurückgenommen wurde

- **Deskew/Drehen nicht wieder einbauen.** Tesseract richtet Zeilen selbst aus; Drehen senkte die Konfidenz und
  verlor Zeilen (gemessen bei Kaufland und famila).
- **CLAHE, Schärfen, Entrauschen** wurden nicht eingebaut: Die Messung belegte keinen Bedarf, der das Regressionsrisiko
  rechtfertigt.
- **Tesseract-Konfidenz taugt nicht als Qualitätsmaß.** Läufe mit 81–87 % hatten die ganze Preisspalte verloren.
  Maßgeblich ist der Summenabgleich.

## 4. Bekannte Schwächen

- Überbelichtung und Reflexionen: famila verliert 9 von 10 Paaren.
- Blasser Thermodruck: Summen nur 4/7.
- Falsche Namen bei richtigem Preis erzeugen keinen Summenfehler; Namens-Markierung prüfen, ob sie das wirklich fängt.
- Matrixdruck: 6 wird als 8 gelesen, deshalb Literpreis gegen Summe ÷ Liter prüfen.
- Shell in Chromium liest "TOTAL FUEL 3.19"; Node liest anders.
- CA-Originalfotos sind deutlich schwächer als DE (15/20 gegenüber 25/25 Paaren).
- Kaum Belege für Rabatte, Stornos, Coupons, Pfandrückgabe, mehr als 30 Positionen, kanadische Restaurants.

## 5. Fallen beim Testen

- **Node ist nicht der Browser.** Canvas-Skalierung ändert das OCR-Ergebnis. Der Benchmark ist reproduzierbar, ersetzt aber
  keinen Test in echtem Safari oder Chromium. iPhone-Safari ist auch deutlich langsamer.
- **Fotos liegen nicht in git** (Kartennummern, Adressen, Personalnamen). `tests/receipt-photos/images/` und `results/` sind
  ignoriert. Ohne die Fotos laufen nur Korpus und Parser-Tests.
- **Referenzen sind nicht vom Nutzer bestätigt.** Sie wurden von Claude vom Foto abgeschrieben.
- **Die 9 Bedingungen sind nicht unabhängig.** Es sind 7 Belege, nicht 63. 99 % ist damit weder belegbar noch widerlegbar.
- **Überanpassung ist das Hauptrisiko.** Viele Regeln entstanden an einem einzelnen Bon. Neue Regeln brauchen eine
  rechnerische Absicherung wie Anzahl × Preis = Betrag, keine Sonderfälle pro Laden.
- `MIN_*` in `tests/receipt-ocr-corpus.test.ts` nie senken, nur anheben.
- Pro Änderung vorher und nachher messen, je Verbesserung ein Commit mit Zahlen.
- Benchmark in `source/`: `node scripts/receipt-benchmark.mjs --label X --jobs 6`, etwa 3 Minuten.
- Lange Zeilen: `app/scanner.tsx`, `lib/receipt-parser.ts`, `app/globals.css`. Suchausgaben kürzen.
- Bash-Heredocs und `node -e` verlieren im Harness des Autors Backslashes; Regex-Änderungen besser per Datei-Edit.

## 6. Fallen außerhalb der Erkennung

Diese Punkte sahen im Alltag wie Erkennungsfehler aus, waren aber keine:

- **Zwei Deployments.** GitHub Pages baut nur die App. Der Server `basket-together.gnoid-knutzen.chatgpt.site` wird von
  der CI **nicht** aktualisiert. Parser und OCR laufen im Browser und kommen über Pages; Änderungen in
  `app/api/basket/route.ts` brauchen einen eigenen Deploy. Fehlt er, wirkt ein grüner Test trotzdem nicht live.
- **"Check the details"** kam vom veralteten Server, der das Gewicht nicht kannte, nicht von der Erkennung.
- **Kategorie beim Speichern verloren.** Der Server verwandelte bis 2026-11-05 Fruit, Veggies, Processed Food, Pasta und
  Öle in Other, obwohl die Erkennung richtig lag. Behoben in `afd0ddc`; alte Daten über die Reparatur in Spending.
- **Statistik ließ Kategorien weg** und **zeigte nur den aktuellen Monat**. Fehlende Artikel dort beweisen keinen
  Scan-Fehler. Erst im gespeicherten Bon prüfen, was wirklich erkannt wurde.
- Pages und die Seite cachen etwa 10 Minuten. Vor einem Urteil prüfen, welcher Stand wirklich live ist.

## 7. Sinnvolle nächste Schritte

1. 15–20 weitere echte Bons als Referenz aufnehmen, vor allem aus Kanada, und vom Nutzer bestätigen lassen.
2. Echte Fotos bei schlechtem Licht statt nur simulierter Varianten.
3. Prüfen, ob eine Vision-AI als zweite Meinung nur bei offener Summendifferenz sinnvoll ist. Dabei beachten: Bis jetzt
   bleibt das Foto für die OCR auf dem Gerät, Kartendaten und Adressen wären sonst ein Datenschutzthema.
4. Fehlerzähler aus echten Nutzerkorrekturen: Welche Felder werden in der Prüfansicht am häufigsten geändert?
