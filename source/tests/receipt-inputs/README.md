# REWE-Regressionsdaten

`rewe-kiel-transcript.txt` ist die vom Nutzerfoto vom 05.11.2026 abgeschriebene
Referenz: 11 Warenpositionen + 4 Pfandpositionen + 4 Rückgaben = 19 Buchungen,
insgesamt 21,99 EUR. Die Rückgabemengen sind 4, 2, 5 und 2.

`rewe-kiel-ocr.txt` ist der gelieferte beschädigte OCR-Text. Er enthält die
Red-Bull-Position nicht. Der Parser muss deshalb eine offene Differenz anzeigen;
er darf den fehlenden Artikel nicht aus der Referenz erfinden. Diese Datei wird
bewusst nicht als vollständig rekonstruierbarer OCR-Korpusfall bewertet.

Das Originalfoto sowie vollständige OCR-Wortdaten werden nicht eingecheckt.
Die Tests in `receipt-regressions.test.ts` prüfen zusätzlich die Zusammenführung
von Durchläufen, wiederholte Produkte, negative Beträge, Datumsnachlese und die
Speichersperren für unbestätigte Angaben.
