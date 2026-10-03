# KSS CMS

Payload CMS (Next.js + Postgres) za **kss.rs**, **lige.kss.rs** i buduće klupske sajtove.
Jedan CMS, više sajtova (tenant-a); pristup se razdvaja ulogama po sajtu.

Arhitektura, model podataka i migracija: [docs/data-model.md](docs/data-model.md).
Frontend je u posebnom repou (`ksss`, Lovable).

## Pokretanje (lokalno, bez Dockera)

Potreban je Node i lokalni Postgres (npr. DBngin).

```sh
createdb -h localhost -U postgres kss_cms   # jednom
cp .env.example .env.local                   # popuni vrednosti
npm install
npm run seed                                  # sajtovi kss + lige i super-admin
npm run dev                                   # http://localhost:3000/admin
```

`.env` / `.env.local` su u `.gitignore`. Ključevi (DScore, kss-live) idu samo tamo, nikad u kod.

## Skripte

| Komanda | Šta radi |
|---|---|
| `npm run dev` | admin + API na :3000 |
| `npm run seed` | napravi sajtove i super-admina (idempotentno) |
| `npm run verify:access` | proverava uloge i pristup nad lokalnom bazom |
| `npm run generate:types` | osvežava `src/payload-types.ts` posle izmene kolekcija |

## Uloge

Globalno: `super-admin`. Po sajtu (u korisniku, polje *Sajtovi*): `admin`, `news-editor`, `teams-editor`,
`competitions-editor`, `documents-editor`, `club-admin`, `club-editor`. Mapiranje uloga na kolekcije je u
`src/access/roles.ts` (`WRITE_ROLES`). Posle svake izmene uloga pokreni `npm run verify:access`.

## Struktura

- `src/collections/` – kolekcije (vesti, stranice, dokumenta, reprezentacije, takmičenja…)
- `src/access/roles.ts` – dozvole po sajtu
- `src/scripts/` – seed i provera dozvola

## Uvoz iz WordPress-a

Skripta `src/scripts/import-wp.ts` čita javni WP REST API; idempotentna je po `(sajt, legacyId)`.
Parametri se zadaju bez `--` (`payload run` ih guta): 

```sh
npm run import:wp -- site=lige limit=50              # probni, samo tekst
npm run import:wp -- site=lige update                # ceo sajt, samo tekst (~14 min za lige)
npm run import:wp -- site=lige update media          # + slike i PDF-ovi u Media (sporo, vidi dole)
npm run import:wp -- site=lige after=2026-09-20 media
```

- Objave u kategorijama odluka (registracija, UO, takmičenje, disciplinski, profesionalni ugovori, DZS, sudijska) idu u **Dokumenta**; ostalo su **Članci**.
- Naslov oblika `A – B 77:66` → `match-report`.
- Slike postaju pravi upload čvorovi u tekstu; sve se konvertuje u webp.
- Greške idu u `.import-logs/` (nije u gitu). Na lige.kss.rs oko polovine slika iz 2018–2023 ne postoji (404) – skripta to preskače.
- `legacyHtml` čuva originalni HTML, pa se tekst može ponovo konvertovati bez novog preuzimanja.

### Stranice i reprezentacije (kss.rs)

```sh
npm run import:pages -- update                 # sve (156 selekcija + 37 stranica), tekst
npm run import:pages -- update media           # + fotografije igrača i prilozi
npm run import:pages -- only=teams|pages
```

Parser čita tri oblika starih stranica reprezentacija (`.oneplayerbox`, obične kartice sa slikom i imenom, i
stare tabele). Osobe se spajaju po imenu + datumu rođenja. 9 najstarijih selekcija (2011–2014) čuvaju spisak kao tekst.
Linkovi na PDF/Word/Excel u tekstu postaju interni linkovi na Media (uz `media`), pa ne zavise od starog sajta.

## Sportski podaci (DScore)

Javne rute `/api/sports/*` (vidi `docs/data-model.md` odeljak 5.2). Zahtevaju `DSCORE_API_URL` i `DSCORE_API_KEY` u `.env.local`.

```sh
npm run sync:sports -- phases              # takmičenja, sezone i faze iz DScore-a (sajt "lige")
npm run sync:sports -- stats league=284    # box score-ovi lige za statistiku igrača
npx vitest run --config ./vitest.config.mts tests/int/dscore-normalize.int.spec.ts
```

DScore ima limit od 60 zahteva u minuti; prekoračenje uključuje proveru posetioca za ceo ključ. Klijent to poštuje
(`DSCORE_RATE_LIVE`, `DSCORE_RATE_BULK`, `DSCORE_BLOCK_MINUTES`), ali pokretanje više procesa istovremeno deli istu kvotu.

## Izgled admina

- **Boje bez koda:** Sistem → *Izgled admina* (samo super-admin). Gotove šeme (KSS, Crvena, Okean, Grafit) ili „Prilagođeno…" sa biračem boja,
  zaobljenost uglova i tamni/svetli bočni meni. Izmene se vide uživo (pregled), a trajno se čuvaju dugmetom *Sačuvaj*.
- Kod: `src/admin/theme.ts` (šeme, CSS promenljive `--kss-*`), `src/globals/AdminTheme.ts`, komponente u `src/admin/components/`,
  stilovi u `src/app/(payload)/custom.scss`. Admin je zaključan na svetlu temu (`theme: 'light'`).
- Logo/ikona: `public/brand/`.
- Screenshotovi za proveru izgleda (prijavljuje se iz `.env`): `node tools/shot.mjs /admin /admin/collections/articles` → `/tmp/shots/`.

### Dashboard i izbor sajta

- Početna strana (`src/admin/components/Dashboard.tsx`, podaci u `src/admin/dashboard-data.ts`) prikazuje objave po mesecima, strukturu sadržaja,
  poslednje izmene, stvari za doradu (nacrti, članci bez slike, dokumenta bez fajla) i rezultate/raspored iz keša sportskih podataka.
  Sve se filtrira prema aktivnom sajtu i dozvolama korisnika.
- Aktivni sajt se bira u bočnom meniju (`SiteSwitcher`); isti izbor koristi i plugin (kolačić `payload-tenant`) pa filtrira i sve liste.
  Oznaka aktivnog sajta je stalno u gornjoj traci (`SiteChip`). Boja sajta: polje *Boja u adminu* u kolekciji Sajtovi.
