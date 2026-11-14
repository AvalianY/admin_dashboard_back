<div align="center">

[Deutsch](README.md) · [Українська](README.uk.md) · [English](README.en.md)

# E-Pharmacy Backend

### Geschützte REST API für die Administrationsoberfläche eines Apothekensystems

[![Node.js](https://img.shields.io/badge/Node.js-26.13.0-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.3.0-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas_Free-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Mongoose](https://img.shields.io/badge/Mongoose-9.12.0-880000?logo=mongoose&logoColor=white)](https://mongoosejs.com/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1.0-6BA539?logo=openapiinitiative&logoColor=white)](docs/openapi.json)
[![Swagger UI](https://img.shields.io/badge/Swagger_UI-5.35.0-85EA2D?logo=swagger&logoColor=000)](#swagger-dokumentation)
[![Deployment](https://img.shields.io/badge/Deployment-Render_Free-000000?logo=render&logoColor=white)](https://e-pharmacy-api-kz62.onrender.com)

[Repository](https://github.com/AvalianY/admin_dashboard_back) · [Frontend](https://github.com/AvalianY/admin_dashboard_front) · [Live API](https://e-pharmacy-api-kz62.onrender.com) · [Swagger UI](https://e-pharmacy-api-kz62.onrender.com/api-docs/)

**Swagger UI: online verfügbar**

</div>

## Inhaltsverzeichnis

- [Über das Projekt](#über-das-projekt)
- [Funktionen](#funktionen)
- [Technologien](#technologien)
- [API-Endpunkte](#api-endpunkte)
- [Architektur](#architektur)
- [Projektstruktur](#projektstruktur)
- [Installation und Start](#installation-und-start)
- [Umgebungsvariablen](#umgebungsvariablen)
- [Datenimport](#datenimport)
- [Verfügbare Skripte](#verfügbare-skripte)
- [Swagger-Dokumentation](#swagger-dokumentation)
- [Deployment](#deployment)
- [Tests und Qualität](#tests-und-qualität)
- [Autor](#autor)

## Über das Projekt

**E-Pharmacy Backend** ist die eigenständige Serveranwendung für ein Apotheken-Admin-Dashboard. Die REST API verbindet geschützte Verwaltungsfunktionen mit MongoDB Atlas: Produkte, Lieferanten, Kunden, historische Bestellungen und Dashboard-Kennzahlen.

Dieses Repository enthält das eigenständige modulare Express-Backend. Die fertige responsive [Frontend-Anwendung](https://github.com/AvalianY/admin_dashboard_front) ist die zweite Komponente desselben E-Pharmacy-Projekts. Der veröffentlichte Server verwendet den freigegebenen ursprünglichen Lehrdatensatz mit **190 Domänendokumenten**.


Die Rollen `admin` und `demo` werden serverseitig geprüft. Demo erlaubt Geschäfts-GETs sowie Login/Profil/Logout; alle sieben Geschäftsänderungen liefern `403 DEMO_READ_ONLY`. Ein Konto ohne zugewiesene Rolle erhält keine Geschäftsrechte. Die neue Absicherung ist vor öffentlichem Demo-Zugang gesondert auszurollen und zu prüfen; Zugangsdaten werden nicht veröffentlicht. [Migration und sichere Initialisierung](docs/demo-access.md).
## Funktionen

- JWT-Login mit unabhängigen, einstündigen serverseitigen Sessions und gezieltem Logout
- Produktkatalog mit Erstellung, vollständiger Bearbeitung und logischem Löschen
- Lieferantenverwaltung mit EUR-Beträgen und unveränderter historischer BDT-Information
- Kundenerstellung, Listen mit Pagination, Profilbearbeitung per PATCH und bestätigte Kundenhistorie
- Lesezugriff auf historische Bestellungen und unveränderte Auftragssnapshots
- Dashboard mit Gesamtzählern, getrennten 30-Tage-Werten, fünf letzten Registrierungen und Tagesfinanzen
- Literale Namenssuche; Sortierung für Produkte und Bestellungen; Pagination für Kunden
- Strikte Zod-Validierung, zentrale Fehlerbehandlung und exakte Decimal128-Geldwerte
- Explizite null/partial-Metadaten bei fehlenden historischen Informationen
- SHA-256-geprüfter, idempotenter Import mit Provenance und getrennten Original-/Testdaten
- OpenAPI-Vertrag und interaktive Swagger UI mit Bearer Authorization

## Technologien

| Technologie | Version | Aufgabe |
| --- | --- | --- |
| Node.js | 26.13.0 (>=26 <27) | Laufzeit, festgelegt in .node-version |
| TypeScript | 6.0.3 | Statische Typisierung |
| Express | 5.3.0 | HTTP-Routing und Middleware |
| MongoDB Atlas | Free / MongoDB 8.0 | Persistente Domänendaten und Sessions |
| Mongoose | 9.12.0 | Modelle, Schemas und Datenzugriff |
| Zod | 4.6.7 | Validierung von Konfiguration und Requests |
| JWT / jose | 6.2.17 | JWT-Signatur und -Prüfung |
| Vitest / Supertest | 5.1.0 / 7.3.2 | Tests und HTTP-Integration |
| OpenAPI / Ajv | 3.1.0 / 8.20.0 | API-Vertrag und Schema-Prüfung |
| Swagger UI Express / UI | 5.0.1 / 5.35.0 | Interaktive Dokumentation im bestehenden Server |
| Render | Free, Frankfurt | HTTPS-Hosting in Frankfurt |

## API-Endpunkte

| Methode | Endpunkt | Zweck | Bearer |
| --- | --- | --- | --- |
| POST | `/api/user/login` | Anmelden und Session erstellen | Nein |
| GET | `/api/user/user-info` | Angemeldetes Profil lesen | Ja |
| GET | `/api/user/logout` | Aktuelle Session widerrufen | Ja |
| GET | `/api/dashboard` | Kennzahlen und Dashboard-Daten lesen | Ja |
| GET | `/api/products` | Aktive Produkte suchen und sortieren | Ja |
| POST | `/api/products` | Produkt erstellen | Ja |
| PUT | `/api/products/{productId}` | Editierbare Produktfelder vollständig ersetzen | Ja |
| DELETE | `/api/products/{productId}` | Produkt logisch löschen | Ja |
| GET | `/api/suppliers` | Lieferanten suchen | Ja |
| POST | `/api/suppliers` | Lieferant erstellen | Ja |
| PUT | `/api/suppliers/{supplierId}` | Lieferant vollständig bearbeiten | Ja |
| GET | `/api/customers` | Kunden suchen und seitenweise lesen | Ja |
| POST | `/api/customers` | Kunden mit serverseitiger Registrierung und 0 EUR Ausgaben erstellen | Ja |
| GET | `/api/customers/{customerId}` | Kundenprofil und bestätigte Historie lesen | Ja |
| PATCH | `/api/customers/{customerId}` | Erlaubte Profilfelder teilweise bearbeiten | Ja |
| GET | `/api/orders` | Bestellungen suchen und sortieren | Ja |

Erfolgreiche Antworten verwenden `{ data, meta? }`, Fehler `{ error: { code, message, details? } }`. Erstellung liefert 201, Logout und Löschung 204 ohne Body. Geschützte Operationen erwarten `Authorization: Bearer <token>`; 401 enthält eine Bearer-Challenge. PUT benötigt alle editierbaren Felder, PATCH nur die angegebenen erlaubten Profilfelder.

`POST /api/customers` benötigt `name`, `email`, `address` und `phone`; `country` ist optional (String oder null, Standard null). Es gelten die bestehenden Text-/E-Mail-Regeln; doppelte E-Mail-Adressen bleiben erlaubt. Der Server setzt das aktuelle UTC-Registrierungsdatum, Erstellungs-/Änderungszeitpunkte und exakt 0 EUR als Decimal128-Ausgangswert für `spent`. Foto und Importzeit sind null, Import-Provenance fehlt; es werden weder ein Anmeldekonto noch eine Kaufhistorie erzeugt. Unbekannte Felder, einschließlich clientseitiger Finanz-, Datums- und technischer Angaben, werden abgewiesen.

Die vollständigen Parameter, Schemas und Statuscodes stehen im [OpenAPI-Vertrag](docs/openapi.json). Swagger-Routen dokumentieren diese **16 Geschäftsoperationen** und sind keine zusätzlichen Geschäftsoperationen.

## Architektur

Die Module unter `src/modules/` trennen Router, Services und Mongoose-Modelle. Zod prüft Eingaben vor dem Datenzugriff; gemeinsame Hilfen verwalten DTOs, Geldwerte, UTC-Zeiträume, Vollständigkeitsmetadaten und Fehler.

`products`, `suppliers`, `customers`, `orders` und `financialtransactions` enthalten Domänendaten; `users` und `sessions` bilden die Authentifizierung ab. JWTs verweisen auf serverseitige Sessions, gespeicherte Token-Hashes ermöglichen einen gezielten Widerruf. Es gibt keine öffentliche Registrierung oder Refresh-Route.

`src/openapi.ts` erzeugt `docs/openapi.json`; dieselbe Definition wird für Swagger in den Server kompiliert. Die ausführlichen Import-, Kategorie- und Historienregeln bleiben in der [technischen Referenz](docs/backend-reference.md) erhalten.

## Projektstruktur

```text
admin_dashboard_back/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config.ts
│   ├── db.ts
│   ├── documentation.ts
│   ├── openapi.ts
│   ├── modules/
│   │   ├── auth/
│   │   ├── customers/
│   │   ├── dashboard/
│   │   ├── orders/
│   │   ├── products/
│   │   ├── suppliers/
│   │   └── transactions/
│   ├── shared/
│   ├── import/
│   └── scripts/
├── docs/
│   ├── openapi.json
│   ├── backend-reference.md
│   └── free-deployment.md
├── tests/
├── local-tests/
├── data/
│   ├── demo/
│   └── source-manifest.json
├── scripts/generate-demo.mjs
├── .env.example
├── .node-version
├── README.md
├── README.uk.md
├── README.en.md
├── package.json
└── render.yaml
```

## Installation und Start

Voraussetzungen: Node.js **26.x** (Referenzversion **26.13.0**), npm, Git und eine eigene MongoDB-8.x-Entwicklungsdatenbank.

Für einen neuen Clone:

```bash
git clone https://github.com/AvalianY/admin_dashboard_back.git
cd admin_dashboard_back
npm ci
```

Erstelle danach `.env` anhand von `.env.example` (`cp .env.example .env`, in PowerShell `Copy-Item .env.example .env`). Konfiguriere eine **separate Entwicklungsdatenbank**, ein zufälliges JWT_SECRET mit mindestens 32 Zeichen und die exakt erlaubten Origins. Die ursprüngliche Produktionsverbindung gehört nicht in lokale Testläufe.

Die einmalige Kontoinitialisierung benötigt die realen, lokal eingegebenen INITIAL_USER_* Werte. Übergib das Passwort verdeckt im Prozess und entferne es anschließend; speichere es nicht in Projektdateien. Ein bestehendes Konto wird nicht überschrieben. Details: [technische Referenz](docs/backend-reference.md).

```bash
npm run user:init
npm run seed:demo
npm run dev
```

```bash
npm run build
npm start
```

## Umgebungsvariablen

| Variable | Bedeutung |
| --- | --- |
| `MONGODB_URI` | Erforderliche MongoDB-Verbindung mit explizitem Datenbanknamen; nur privat konfigurieren |
| `JWT_SECRET` | Erforderlicher, zufälliger Signaturschlüssel mit mindestens 32 Zeichen; zwischen Serverstarts stabil halten |
| `NODE_ENV` | development, test oder production; Standard development |
| `PORT` | Lokaler Standard 3000; auf Render den bereitgestellten PORT verwenden |
| `CORS_ORIGINS` | Kommagetrennte exakte Origins ohne Pfad oder Wildcard; für lokale Swagger UI http://localhost:3000 |
| `SOURCE_DATA_DIR` | Optionales Verzeichnis der privaten Original-JSON; Standard data/source/ |
| `INITIAL_USER_NAME` | Name für einmaliges user:init; nur lokal im administrativen Prozess |
| `INITIAL_USER_EMAIL` | Gültige E-Mail für user:init; kein Server-Default |
| `INITIAL_USER_PASSWORD` | Verdeckte lokale Passworteingabe nur für user:init; nicht auf Render setzen |

Bereits gesetzte Prozessvariablen haben Vorrang vor `.env`, auch bei `--env-file-if-exists`. `.env`, Original-JSON und das Quellarchiv sind von Git ausgeschlossen. Ein sauberer Clone enthält keine ursprünglichen personenbezogenen Datensätze.

## Datenimport

Die Datenquellen sind absichtlich getrennt:

| Quelle | Befehl | Einsatz |
| --- | --- | --- |
| `v1` | `npm run seed` | Ursprünglicher Lehrdatensatz aus dem ignorierten data/source/; Produktion e_pharmacy, 190 Dokumente |
| `demo-v1` | `npm run seed:demo` | Deterministisch erzeugte synthetische Daten aus data/demo/; ausschließlich Entwicklung und isolierte Tests |

Der Import prüft das jeweils eigene Manifest und SHA-256, behält alle Quellzeilen einschließlich Duplikaten und speichert eine eindeutige Provenance. Wiederholtes Einlesen desselben Datensatzes fügt keine weiteren Datensätze hinzu und überschreibt keine Bearbeitungen. `seed` ist deshalb **kein Backup-Restore**. Original-JSON werden weder nach GitHub noch auf Render hochgeladen.

Die Produktion enthält 60 Produkte, 5 Lieferanten, 88 Kunden, 25 Bestellungen und 12 Finanzvorgänge. Unbekannte historische Daten bleiben unbekannt; BDT wird nicht fiktiv in EUR umgerechnet. `seed:demo` darf nicht gegen die öffentliche Produktionsdatenbank laufen.

## Verfügbare Skripte

| Befehl | Aufgabe |
| --- | --- |
| `npm run dev` | TypeScript-Entwicklungsserver mit Watch-Modus |
| `npm run build` | TypeScript nach dist/ kompilieren |
| `npm start` | Kompilierten Production-Server starten |
| `npm run typecheck` | Typen ohne Ausgabe prüfen |
| `npm run lint` | ESLint ausführen |
| `npm test` | Öffentliche isolierte Tests ausführen |
| `npm run test:watch` | Tests im Watch-Modus |
| `npm run test:source` | Originaldaten separat und isoliert prüfen; fehlende Dateien sind ein Fehler |
| `npm run seed` | Freigegebene Originaldaten importieren |
| `npm run seed:demo` | Synthetische Entwicklungsdaten importieren |
| `npm run demo:generate` | Synthetische Fixtures reproduzierbar erzeugen |
| `npm run user:init` | Einmalig ein Konto initialisieren, ohne bestehende Konten zu überschreiben |
| `npm run user:admin-role` | Geprüfte bestehende Admin-Rolle planen/anwenden; standardmäßig nur lesen |
| `npm run user:init-demo` | Demo-Konto nach geprüftem Server-/Daten-Gate sicher initialisieren |
| `npm run docs` | OpenAPI-JSON aus der bestehenden Definition erzeugen |
| `npm run check` | Typecheck, ESLint, Tests und Build nacheinander ausführen |

## Swagger-Dokumentation

Lokal: [http://localhost:3000/api-docs](http://localhost:3000/api-docs). Die UI zeigt alle 16 Operationen, nach Modulen gruppiert, mit Parametern, Request-/Response-Beispielen, Schemas und Statuscodes. Der JSON-Vertrag liegt unter `/api-docs/openapi.json`. Die Beispiele sind synthetisch.

1. Den passenden Bereich und die Operation öffnen.
2. Über Login mit den eigenen Zugangsdaten einen Token erhalten.
3. Unter **Authorize** nur den Tokenwert für das vorhandene Bearer-Schema eintragen.
4. **Try it out** aktivieren und den Request bewusst ausführen.
5. Mit Logout die aktuelle Session widerrufen.

Tokens werden nicht über Reloads oder Browser-Sessions hinweg gespeichert. Schreiboperationen ändern die ausgewählte Datenbank und benötigen in Produktion ein ausdrücklich genehmigtes Testfenster mit Backup und Wiederherstellung. Für Browser-Requests muss der exakte API-Origin in CORS_ORIGINS erlaubt sein; JWT bleibt für alle geschützten Operationen verpflichtend.

Öffentliche Swagger UI: [https://e-pharmacy-api-kz62.onrender.com/api-docs/](https://e-pharmacy-api-kz62.onrender.com/api-docs/). Die interaktive Dokumentation ist mit dem bestehenden Bearer-Schema auf Render veröffentlicht. Die lokale Erweiterung zur Kundenerstellung erhöht den Vertrag auf 16 Operationen; ihre Veröffentlichung auf GitHub und Render benötigt eine separate Freigabe. Der neue POST darf noch nicht als produktiv verfügbar vorausgesetzt werden.

## Deployment

Die bestehende API läuft unter [https://e-pharmacy-api-kz62.onrender.com](https://e-pharmacy-api-kz62.onrender.com) auf **Render Free in Frankfurt**, mit **MongoDB Atlas Free auf AWS Frankfurt**. Der Root-Pfad darf 404 liefern; die Geschäftsoperationen sind geschützt.

`render.yaml` legt Node 26.13.0, `npm ci --include=dev && npm run build`, `npm start` und deaktivierte automatische Deploys fest. Der Server bindet nach erfolgreicher DB-Verbindung an `0.0.0.0` und den zugewiesenen PORT. Zugangsdaten werden in privaten Environment Settings hinterlegt; Init und Import gehören nicht in Build-/Start-Hooks.

Render Free fährt Dienste nach Inaktivität herunter; der nächste Request kann einen Cold Start auslösen. Daten und Sessions bleiben in Atlas. Das lokale Dateisystem ist nicht dauerhaft. [Free-Limits](https://render.com/docs/free). `render.yaml` erlaubt ausschließlich `https://e-pharmacy-api-kz62.onrender.com` als Production-Origin für Swagger. Die tatsächlichen Render Environment Settings müssen mit dieser Konfiguration übereinstimmen: Eine lokale YAML-Änderung aktualisiert einen bestehenden Service nicht automatisch. Der Frontend-Origin wird erst nach seiner Freigabe ergänzt.

Ablauf, sichere Administration und Freigabegrenzen: [Deployment-Runbook](docs/free-deployment.md). Neue Veröffentlichungsschritte sind separat zu genehmigen.

## Tests und Qualität

Die öffentlichen Tests starten eigene, kurzlebige MongoDB-Instanzen und verwenden synthetische Fixtures. Sie benötigen keine privaten Originaldaten. `test:source` prüft die Originale separat und schlägt bei fehlenden Dateien fehl. Tests werden nicht gegen Atlas ausgeführt.

Die Suite prüft Authentifizierung, Sessions, Kataloge, Dashboard, Import, Request-/Response-Verträge, Fehlerbehandlung und den tatsächlichen kompilierten Server. Swagger-Prüfungen decken HTML, lokale Assets, alle 16 Operationen, Beispiele, Bearer-Konfiguration, Token-Persistenz-Einstellungen und unveränderte CORS-/JWT-Grenzen ab. Tests zur Kundenerstellung verwenden eine isolierte MongoDB und prüfen Validierung, UTC-Grenzen, Decimal128, Fünfer-Pagination, Profiländerungen, Dashboard und den Erhalt vorhandener Datensätze.

**Live-Nachweis vom 13.11.2026:** alle 15 Geschäftsoperationen, 74 HTTPS-Requests und das exakte Wiederherstellen der 190 Originaldokumente nach temporären Teständerungen — PASS. Zusätzlich wurden zuvor 49 sichere HTTPS-Szenarien einschließlich Cold Start geprüft. Nach der Veröffentlichung liefern die öffentliche Swagger UI und das zugehörige OpenAPI-JSON-Dokument HTTP 200; die aktuelle Spezifikation enthält 16 Operationen und das bestehende Bearer-Schema.

Aktuelle lokale Rollen-/Kundenprüfungen bestanden: TypeScript, ESLint, Production-Build, **220 öffentliche Tests** und **5 separate Originaldaten-Tests**; `npm audit` meldet **0 bekannte Schwachstellen**. Ein separater Browser-Test des kompilierten Servers zeigt alle 16 Swagger-Operationen und prüft den neuen Request-Body, die dokumentierte 201-Antwort, Bearer-Übertragung und gelöschte Autorisierung nach einem Reload. Sein Testtoken liefert erwartungsgemäß 401 ohne Datenbankverbindung; gültige Erstellung prüfen Integrationstests gegen isolierte MongoDB. Die Production-Abnahme der neuen Operation steht noch aus. Lokale Prüfungen wiederholen:

```bash
npm run check
npm run test:source
npm audit
```

## Autor

Dieses Backend wurde als **individuelles Projekt** entwickelt.

GitHub: [@AvalianY](https://github.com/AvalianY)

---

<div align="center">

Eigenständiges Backend-Projekt mit Fokus auf sichere API-Verträge, nachvollziehbare Daten und reproduzierbare Prüfungen.

</div>
