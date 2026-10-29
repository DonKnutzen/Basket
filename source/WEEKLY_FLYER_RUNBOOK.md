# Weekly Kiel grocery-flyer import: reusable QA procedure

Applies to future **REWE Kiel (market 561204), ALDI Nord Kiel and PENNY Kiel** weekly PDF uploads. This procedure is independent of the specific week. It is a proposal-and-review workflow, **not** an automatically verified product database.

## Every new week

1. Upload the original PDF from the correct retailer/region in Basket → Germany/Kiel → Weekly offers → Operator section. Confirm the printed outer validity period; don't reuse last week's dates. For PENNY, the existing supported official PDF URL import may be used. The importer is idempotent by original file checksum.
2. Let the existing OIDC-authenticated GitHub queue worker process **every page**. It reports proposals, needs-unit and price-ambiguous counts per page and a totals summary for newly processed pages. Resumed runs count only pages processed in that run, not previously checkpointed pages.
3. Use the operator summary to find missing pack units and doubtful price assignments. New **Einheiten prüfen** and **Preiszuordnung prüfen** filters reduce manual searching. Revisit pages with no candidates and compare with the original PDF; OCR page processing is **not** proof that all products were found.
4. A pack unit is suggested only when explicitly printed (e.g. **Stück**, **kg-Preis**, **Bund**, **Schale**, **Netz**, **Packung**). It stays marked as inferred until the original is checked. Do not substitute a weight/volume or infer a pack from common product sizes.
5. Review the product title, brand, variants, sale price, unit/pack size, per-unit/base price, deposit, membership/app/bonus requirements and any shorter in-week validity date. One retailer tile can contain multiple products or prices; split or reject it rather than guessing the pairing.
6. Confirm matching entries individually using the private original crop. Undecidable areas remain visible as **unverified** proposals, with no misleading confirmed price. Publishing requires operator confirmation; new weekly candidates do not inherit previous approvals.
7. On the shopper side check actual names and synonyms (e.g. Kiwi, Bananen, Kohl, Cola Zero) and all selected retailers. Compare **unit price** only when units are comparable. Check a second account sees only permitted published/sanitized draft fields.
8. Verify the PDF links and expiry after the validity period. Invalid/expired offers must disappear at **Berlin-local midnight**; the next weekly upload replaces them rather than extending them automatically.

## QA data and safeguards

- Processing report counts **regions**, not distinct food products. withoutPack, ambiguousPrice and unreadable are triage dimensions; they can overlap.
- The importer never guesses a product, pack amount, price or brand from generic commodity knowledge. It does not treat deposit, UVP, discount percentages, displayed litre quantities or original prices as sale prices.
- Even a single positive printed price is only a **price proposal** if the product-price region is not clear.
- Existing read-only draft visibility for other signed-in accounts remains distinct from **verified, published** prices.
- Keep source files private, don't expose OCR, reviewers or original evidence to shopper accounts, and don't automatically claim source-use rights.
- These tests are regression examples, not a validated 100% product-recall score. An independently labeled collection of **whole pages** would be needed to quantify missing-food rates.

## Wiederkehrender Ablauf für den betreuenden Agenten

Die bestehende Basket-Erinnerung fordert jetzt die fehlenden Originalprospekte für **alle drei Händler gemeinsam montags** an. Die vorhandene Zeit bleibt 09:00 Uhr America/Halifax. Dieser Zeitplan ist in ChatGPT gespeichert, nicht durch diese Datei eingerichtet. Vor jeder Anfrage den verfügbaren aktuellen Importstand und bereits gelieferte Dateien prüfen. Keine zweite Erinnerung pro Händler anlegen und keine bereits gelieferte Datei erneut anfordern. Wenn alle benötigten Prospekte verarbeitet sind, keine Anfrage senden. Ist der Importstand nicht zugänglich, dies offenlegen und keine erfolgreiche Prüfung vortäuschen.

1. Eine kurze deutsche Nachricht mit den noch fehlenden Händlern und der benötigten Angebotswoche schicken. REWE: Holtenauer Str. 69–71, Kiel, Markt **561204**; ALDI: **Nord**, Kiel; PENNY: Kiel. Original-PDF oder offizieller direkter PDF-Link genügt. REWE stellt der Nutzer persönlich bereit; keine automatische Suche als Ersatz für seinen Link. Ältere Links dienen nur als Referenz, niemals als Quelle für neue Wochenpreise.
2. Nach Bereitstellung den aktuellen `main` verwenden. Händler, Region und die **gedruckte Gültigkeit** prüfen; nicht pauschal Montag–Samstag annehmen. Einen kürzeren Zeitraum einzelner Angebote erhalten. Für dieselbe Datei den vorhandenen SHA-256-Import fortsetzen, statt einen zweiten Katalog anzulegen.
3. Für lokale Analyse die kostenlose Parserumgebung einmal vorbereiten: `python -m pip install -r source/scripts/flyer_requirements.txt`. Native Tesseract-Sprachdaten `deu` und `eng` werden für Bildseiten benötigt; der zentrale GitHub-Worker installiert sie bereits. Keine kostenpflichtigen APIs erforderlich.
4. Jede gelieferte PDF vollständig mit `source/scripts/process-german-flyers.py --pdf ABSOLUTE_PDF --out ABSOLUTE_REVIEW_DIR --from YYYY-MM-DD --until YYYY-MM-DD` auswerten. Platzhalter durch den tatsächlichen Pfad und die geprüften Daten ersetzen. Je Händler/Datei einen eigenen Ausgabepfad verwenden. Der lokale Aufruf schreibt **keine** Angebotsdaten in die zentrale Datenbank.
5. `analysis.json` lesen: `sha256`, `parser`, `totalPages`, `validFrom`, `validUntil`, `processingStatus` und `quality` dokumentieren. `failedPages` bedeutet einen unvollständigen Import; der lokale Prozess liefert dann Exitcode **1**, statt Erfolg vorzutäuschen. `emptyPages` separat mit der Originalseite vergleichen: Eine Seite ohne Treffer kann Werbung sein oder übersehene Lebensmittel enthalten. `reviewPages` bündelt technische Auffälligkeiten und fehlende Mengen/Preise. Auch eine leere Liste ersetzt keine Kontrolle auf vollständig übersehene Produkte.
6. Die Originalseiten und zugeschnittenen Produktbereiche zur Nachprüfung verwenden. Erst lokale Seitenfehler beheben, dann die betroffenen Seiten erneut verarbeiten. Kein manueller Preis allein aus üblichen Packungsgrößen oder Vorwochenpreisen. Gedruckte Verkaufspreise, Pfand, UVP, Grundpreis und App-Preise unterscheiden. Berechnete Preise bleiben ausdrücklich rechnerische, ungeprüfte Vorschläge.
7. Zentralen Upload im Betreiberbereich durchführen bzw. fortsetzen und den Queue-Lauf prüfen. Lokale Analyse, Queue-Verarbeitung und tatsächlich abrufbare Daten getrennt nachweisen. Vorhandene Testfreigaben des Nutzers gelten weiter; nicht jede Woche erneut dieselbe Freigabe erfragen. Technische Berechtigungen oder Datenbankzustände nicht erfinden. Sichere Angaben prüfen und übernehmen; offene Bereiche bleiben gut lesbare **ungeprüfte Angebote** für alle angemeldeten Accounts. Keine Datenbank-Aktualisierung behaupten, wenn nur die lokale Analyse erfolgt ist.
8. Händlerübergreifende Warenkorb-Suche mit einigen tatsächlich vorkommenden Produkten und Varianten prüfen; Dubletten, Mengen, App-Bedingungen, direkte Original-PDF-Links und tatsächliche Ablaufdaten kontrollieren. Die Freigabe für andere Accounts über den beschränkten Lesepfad prüfen. Nur Änderungen am App-Code benötigen einen neuen Build; neue Importdaten nutzen den vorhandenen zentralen Datenpfad.
9. Dem Nutzer knapp melden: je Händler Seiten verarbeitet/gesamt, erkannte Prüfbereiche, offene Seiten und tatsächlicher App-Status. Niemals Prüfbereiche als Zahl vollständig erfasster Lebensmittel ausgeben. Nur bei einer konkreten fehlenden Datei, falschen Region, unlesbarem Original oder nicht lösbarem Zugang nachfragen; technische Nacharbeit selbst erledigen.

Neue Flyerlayouts können zusätzliche Korrekturen benötigen. Diese Prozedur macht Fehler sichtbar und den Ablauf wiederholbar; sie ist keine Garantie für eine fehlerfreie Erfassung aller Artikel. Neue Fehlerfälle nach ihrer Korrektur als Regression ergänzen.

## Running tests for every change

    cd source
    python -m unittest discover -s tests -p 'test_*.py'
    pnpm test
    node scripts/test-german-db.mjs
    pnpm exec tsc --noEmit
    pnpm run build:pages --out ../.ci-pages

The existing GitHub Actions workflows already run the application/database/Python checks and the pinned real-PDF regression. New weekly uploads use the same parser automatically; no hardcoded 2026-W44 offer is needed.

