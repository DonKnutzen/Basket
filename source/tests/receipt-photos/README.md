# Echte Belegfotos: Referenzsatz und Benchmark

Je Beleg eine Referenz `<land>-<laden>-<ort>.json` (vom Foto abgeschrieben, Artikelsumme + Steuer = gedruckter
Endbetrag geprüft) und das Foto `images/<gleicher Name>.jpg`. **Fotos liegen nicht in git** (Kartennummern,
Adressen, Personalnamen); sie bleiben auf dem Rechner, `results/` ebenfalls.

## Ausführen

```bash
node scripts/receipt-benchmark.mjs --label vorher --jobs 6
```

Optionen: `--only id1,id2`, `--variants orig,dark`, `--lang eng+deu` (Standard, wie die App bei deutscher Oberfläche).
Ergebnis: Tabelle je Land × Bedingung und `results/<label>.json` mit Lesetext, Zuordnung und Warnungen je Lauf.

Jedes Foto läuft durch die echte App-Pipeline (`prepareForOcr` → `readReceiptPhoto` → `parseReceipt` →
`dateFromPasses`) in Node mit tesseract.js 7. Chromium/Safari lesen nicht bitgenau gleich (siehe Memory/Hinweise
in `lib/receipt-ocr.ts`); der Benchmark ist der reproduzierbare Vergleich, nicht der Ersatz für einen iPhone-Test.

## Bedingungen (aus dem echten Foto erzeugt)

| Name | Simuliert |
|---|---|
| orig | Foto wie aufgenommen |
| dim | gedämpftes Innenlicht (×0,6) |
| dark | dunkles Bild (×0,32) |
| side | einseitige Beleuchtung (Verlauf links hell → rechts 33 %) |
| shadow | Schatten über der rechten Hälfte (Preisspalte, 42 %) |
| bright | Überbelichtung, ausgefressene Stellen (×1,6 + 40) |
| faint | blasser Thermodruck (Kontrast auf 45 %, Schwarz → Grau 140) |
| blur | leicht unscharf (Gauß σ 1,6) |
| small | halbe Auflösung, JPEG-Qualität 55 |

Synthetisch abgeleitete Bedingungen ergänzen echte Aufnahmen, ersetzen sie aber nicht: dasselbe Papier bei
anderem Licht neu fotografiert ist der bessere Test (siehe „Bestand erweitern“).

## Kennzahlen (je Lauf = ein Foto unter einer Bedingung)

- **Endbetrag exakt**: erkannte Summe = Referenzsumme auf den Cent.
- **Artikel erkannt**: Referenzposition hat eine erkannte Zeile mit ähnlichem Namen (Bigramm-Ähnlichkeit ≥ 0,6
  oder enthalten); jede Zeile wird höchstens einer Position zugeordnet.
- **Artikel-Preis-Paar korrekt**: zugeordnete Zeile hat exakt den Referenzpreis. Eine aufgehende Summe zählt nicht.
- **Falsche Positionen (extra)**: erkannte Zeilen ohne Referenzposition.
- **Vollständig korrekt**: Endbetrag exakt, alle Paare korrekt, keine falsche Position.
- **Als sicher dargestellt (safe)**: Summe erkannt, Artikel + Steuer gehen auf, keine Warnung.
- **Unbemerkter Fehler (silentErrors)**: als sicher dargestellt, aber nicht vollständig korrekt.
- **Erkannte Unsicherheit (flaggedWrong)**: fehlerhafte Läufe, die mit Warnung oder offener Differenz angezeigt werden / alle fehlerhaften Läufe.
- **Zeit**: OCR + Auswertung ohne Laden der Sprachdaten, Mittel und Maximum.

Laden und Datum werden mitgeschrieben (`store`, `storeOk`, `date`), aber nicht in „vollständig korrekt“
gezählt; ein Datum außerhalb des Fotos ist mit `"date":""` als „App muss nachfragen“ hinterlegt.

## Bestand erweitern

1. Beleg fotografieren wie im Alltag (iPhone, Kamera-Button der App oder Fotos-App), als JPG nach `images/`.
2. Referenz-JSON nach dem Muster der vorhandenen anlegen: alle Positionen mit gedrucktem Preis, Pfand und Rabatte
   als eigene Positionen mit Vorzeichen, Steuer nur wenn sie zur Summe addiert wird, `capture` beschreibt Licht/Zustand.
3. Prüfen: Summe der Positionen + `tax` = `total`. `verified` sagt, wer abgeschrieben/bestätigt hat.
4. Derselbe Beleg zusätzlich bei schlechtem Licht (Abend, Schatten, Lampe von der Seite) als `<id>-dunkel.jpg`
   mit Kopie der JSON (`id` angepasst): echte Lichtvarianten sind aussagekräftiger als die simulierten.
5. Lücken, die am dringendsten fehlen: kanadische Restaurants mit Trinkgeld/Modifikatoren, Belege mit Rabattzeilen
   (Lidl/Aldi/REWE, Superstore-Coupons), Stornos/Retouren, sehr lange Belege (> 30 Positionen), Discounter-Belege mit Pfandrückgabe.
