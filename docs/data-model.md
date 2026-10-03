# KSS – Data model i arhitektura (v0.1, nacrt)

Status: nacrt za diskusiju. Zasnovan na inventaru WordPress sajtova kss.rs i lige.kss.rs (oktobar 2026).

## 1. Principi

1. **Jedan CMS, dva sajta (tenant-a):** `kss` (kss.rs) i `lige` (lige.kss.rs). Svaki dokument ima `site`; korisnik vidi samo sajtove za koje ima rolu.
2. **CMS drži samo uređivački sadržaj** i meta-podatke o takmičenjima. Rezultati, tabele, statistika i rasporedi **nisu u CMS-u** – dolaze iz DScore-a i kss-live.com (odeljak 5).
3. **Strukturirani podaci umesto Avada stranica:** godišnje stranice reprezentacija i stranice faza takmičenja se generišu iz modela, ne prave se ručno.
4. **Jedan frontend, dva branda.** Brend, navigacija i početna biraju se po `site`.
5. **Stari URL-ovi se ne gube:** svaki migrirani zapis pamti `legacyId` i `legacyUrl`, iz kojih se generiše mapa 301 redirekta.
6. **Pismo:** sadržaj se čuva onako kako je napisan (ćirilica ili latinica); ćirilica/latinica prebacivanje je transliteracija pri renderu (kao danas). Engleska verzija je opciono polje `en` na odabranim tipovima (Page, Article).

## 2. Tenant-i i uloge

| Rola | kss | lige | Napomena |
|---|---|---|---|
| Super admin | ✔ sve | ✔ sve | tehnički tim / vlasnik |
| Urednik vesti | članci, galerije | – | |
| Urednik reprezentacija | reprezentacije, sezone, ljudi | – | najveći deo rada na kss.rs |
| Administrator saveza | stranice, dokumenta, organi, sponzori | – | |
| Komisija za takmičenje | – | takmičenja, faze, odluke, saopštenja | |
| Komisija za registraciju | – | odluke o registraciji, prof. ugovori | |
| Urednik liga | – | članci/izveštaji, galerije | |

Pravila pristupa se rade preko filtera po `site` (i, gde treba, po `kind`/`type` dokumenta). Sve uloge se prijavljuju na isti admin; pristup je odvojen dozvolama, ne instalacijama.

## 3. Zajedničke kolekcije

### Site (global, 2 zapisa)
`key` (`kss` | `lige`), `domain`, `name`, `logo`, `colors`, `mainNav[]`, `footerNav[]`, `socials[]`, `defaultLocale`.

### User
Standardno + `roles[]`, `sites[]` (dozvoljeni tenant-i).

### Media
`file`, `alt`, `credit`, `site`, `legacyId`, `legacyUrl`. Storage: object storage + CDN, automatske WebP varijante.
*Obim migracije: ~46.5k (kss) + ~63k (lige) fajlova — proveriti koliko je stvarno referencirano.*

### Article (vest / izveštaj / saopštenje)
| Polje | Tip | Napomena |
|---|---|---|
| `site` | rel | tenant |
| `kind` | enum | `news` · `match-report` · `announcement` |
| `title`, `slug` | text | |
| `excerpt` | text | |
| `body` | rich text | |
| `heroImage` | rel Media | |
| `gallery` | rel Gallery? | |
| `placement` | enum | `none` · `featured` · `hero-slider` |
| `categories[]` | rel Category | |
| `tags[]` | rel Tag | |
| `nationalTeam` | rel (kss) | opciono, filtrira vesti po reprezentaciji |
| `competitionPhase` | rel (lige) | opciono |
| `dscoreGameId` | text | opciono, povezuje izveštaj sa utakmicom |
| `publishedAt`, `status` | | draft / published |
| `legacyId`, `legacyUrl` | | |

**Mapiranje starih kategorija (kss.rs):**
- „Vesti – glavne" (3.244) → `placement = featured`
- „Baner" (2.187) → `placement = hero-slider`
- „Vesti – ostale" (4.200) → default `none` (članak često ima i drugu kategoriju)
- „Muške reprezentacije", „Ženske reprezentacije", „3×3", „Mini basket", „E košarka" → `Category` + `nationalTeam` gde je moguće

**Mapiranje (lige.kss.rs):**
- „Vesti"/„Aktuelno" → `news`
- Kategorije lige (2.MLS, ARDU JLS, Triglav KLS…) → `competitionPhase` ili `Category`
- Naslov oblika „LIGA, A – B, 77:66" → `kind = match-report` (heuristika; neprepoznati ostaju `news`)

### Category, Tag
`site`, `name`, `slug`, `parent`.

### Gallery
`site`, `title`, `images[]`, `legacyId`. (lige: FooGallery.)

### Page (generičke stranice)
`site`, `title`, `slug`, `parent`, `blocks[]` (tekst, slika, tabela, lista dokumenata, hero, FAQ), `en`, `legacyId`, `legacyUrl`.
Koristi se za Savez, Istorijat, Kontakt, Linkovi, Za tvoj siguran koš, legende i sl.

### Document (dokumenta, odluke, javne nabavke)
| Polje | Tip | Napomena |
|---|---|---|
| `site` | rel | |
| `type` | enum | `normative` · `registration-decision` · `ukss-decision` · `competition-decision` · `disciplinary-decision` · `pro-contract` · `public-procurement` · `permit` · `anti-doping` · `plan` · `other` |
| `commission` | enum | opciono (takmičenje, registracija, sudijska, disciplinski, UO) |
| `title`, `number` | text | |
| `season` | rel | opciono |
| `competition` | rel | opciono |
| `file` | rel Media (PDF) | |
| `body` | rich text | opciono |
| `date`, `status` | | |

Odluke imaju pravni značaj → verzionisanje, bez brisanja (samo `archived`).

### Sponsor
`name`, `logo`, `url`, `tier`, `sites[]`, `order`.

### Banner
`site`, `image`, `url`, `slot` (npr. `home-top`, `sidebar`), `activeFrom/To`. Zamenjuje WP kategoriju „Baner" za reklame.

## 4. Kolekcije po sajtu

### kss.rs – reprezentacije

```
NationalTeam ─┬─< TeamSeason ─┬─< RosterEntry >── Person
              │               └─< StaffEntry  >── Person
```

**NationalTeam** (stabilan entitet, npr. „Muška seniorska reprezentacija")
`name`, `slug`, `gender` (`m`/`f`), `ageGroup` (`senior`, `u20`, `u19`, `u18`, `u17`, `u16`, `university`), `discipline` (`5x5`, `3x3`), `logo`, `order`.

**TeamSeason** (zamenjuje stranice tipa „Seniori 2025", ~150 stranica)
`nationalTeam`, `year`, `title` (npr. „FIBA EuroBasket 2025"), `competitions[]`, `roster[]` (RosterEntry), `staff[]` (StaffEntry), `photo`, `body`, `results[]` (opciono: protivnik, rezultat, datum), `legacyId`, `legacyUrl`.

**RosterEntry** (ugrađen u TeamSeason): `person`, `number`, `position`, `clubAtTime` (tekst, npr. „Denver Nuggets (USA)"), `captain`.
**StaffEntry**: `person`, `role` (`head-coach`, `assistant`, `director`, `doctor`, `physio`…).

**Person** (igrač/trener, jedinstven kroz sezone)
`fullName`, `slug`, `birthDate`, `heightCm`, `primaryPosition`, `photo`, `bio`, `legacyNames[]`.
*Rizik migracije:* isti čovek se pojavljuje na desetinama stranica uz razlike u pisanju (ćirilica/latinica, dijakritici). Deduplikacija = ime + datum rođenja, uz ručni pregled neodređenih.

**OrganMember** (organi saveza: predsednik, potpredsednici, UO, NO, skupština, generalni sekretar)
`organ` (enum), `person`, `role`, `order`, `photo`.

### lige.kss.rs – takmičenja

```
Competition ─< CompetitionPhase >─ Season
                    │
                    └─ dscoreLeagueId, statsSource
```

**Competition** (stabilan entitet: 2. MLS, 1. MRL, 1. ŽLS, ARDU JLS, Triglav KLS, Kup Radivoja Koraća…)
`name`, `shortName`, `slug`, `gender`, `group` (`seniori` · `seniorke` · `kup` · `mladje-kategorije`), `level`, `logo`, `color`, `order`, `parent` (npr. 1. MRL → 1. MRL Sever).

**Season**
`label` („2025/26"), `startDate`, `endDate`, `current` (bool, najviše jedan).

**CompetitionPhase** (zamenjuje ručno pravljenje stranica po fazi/grupi)
| Polje | Napomena |
|---|---|
| `competition`, `season` | |
| `type` | `regular` · `group` · `play-off` · `play-out` · `final-tournament` · `qualification` |
| `name` | npr. „Grupa B", „Play-off" |
| `dscoreLeagueId` | npr. 284 za 2. MLS (ID je po sezoni/fazi) |
| `statsSource` | `dscore` · `kss-live` · `none` + `statsUrl`/ključ |
| `order`, `published` | |

Sve stranice takmičenja (raspored, tabela i delegiranja, statistika, saopštenja, vesti, dokumenta) frontend generiše iz ove tri kolekcije + Article/Document filtriranih po `competition`/`season`.

## 5. Sportski podaci (van CMS-a)

Dva izvora, oba samo za čitanje:

| Izvor | Šta daje | Pristup |
|---|---|---|
| DScore (`new-api.dscore.live`) | utakmice, rezultati, tabele, raspored, delegiranja, live | API ključ, server-side |
| kss-live.com | statistika igrača po ligi | `base64(username:password)` kao Bearer token, server-side |

### 5.1 Šta smo utvrdili (probe 2. oktobra 2026)

DScore API (`https://new-api.dscore.live`, `Authorization: Bearer <ključ>`), samo čitanje. Radni endpointi:

| Endpoint | Sadržaj |
|---|---|
| `GET /leagues?page=N` | lista liga (17 strana), paginirano; svaka lga ima `id`, `name`, `start_date`, `is_visible`, `teams_count` |
| `GET /categories` | stablo kategorija sa ligama: Seniori, Seniorke, Mlađe kategorije, 1.MRL, 1.ŽRL, 2.MRL, 3.MRL |
| `GET /leagues/{id}` | liga + `teams[]`, `contests[]` (cela sezona: raspored i rezultati, ~240 za 2.MLS), `ehanced_data` (statistika timova), `kss_live_slug`, `kss_statistics_enabled` |
| `GET /leagues/{id}/standings` | tabela (`standings`, `prof_standings`, `mini_standings`) |
| `GET /contests/{id}/statistics` | box score obe ekipe po igraču + **play-by-play** (`pbp`, ~500 događaja) |

Ostali pokušaji (`/games`, `/teams`, `/players`, `/leagues/{id}/stats|teams|games`, `/live`…) vraćaju 404. Dokumentacija (`/docs`) je zaključana.

Zaključci:
- **ID lige je po sezoni/fazi** (2.MLS: 184 u 2025/26, 284 u 2026/27) – potvrđuje potrebu za `CompetitionPhase.dscoreLeagueId`. `CompetitionPhase` se može puniti iz `/categories`.
- **Statistiku igrača po ligi možemo sami da agregiramo** iz box score-ova (`/contests/{id}/statistics`), pa nam kss-live.com za to verovatno ne treba. Iz DScore-a dobijamo i play-by-play za „match center".
- **Live:** `contests[]` ima status/rezultat po četvrtinama (`A1..A4`, `B1..B4`, produžeci); posebnog live endpointa nema → polling `/leagues/{id}` ili `/contests/{id}/statistics` za utakmice u toku.
- **kss-live.com** je klasičan PHP/HTML sajt (`/s2627/2mls/rezultati.php`), bez JSON API-ja koji smo našli. Bearer iz kredencijala nije proveren ni na jednom endpointu; ostaje pitanje čemu zapravo služe ti kredencijali (odeljak 8).
- **Privatni podaci u odgovoru:** `contests[]` sadrži e-mail adrese sudija i delegata, a `teams[]` kontakt osobe i telefone. Adapter **mora da ih odbaci** (allowlist polja) pre nego što išta stigne do frontenda ili keša – obaveza prema zakonu o zaštiti podataka o ličnosti.
- Veliki odgovori (`/leagues/284` ≈ 600 KB, `/contests/{id}/statistics` ≈ 50 KB) → obavezan keš, nikad direktno iz browsera.

**Sports-data servis** (deo istog backend-a, poseban modul):
- Adapter po izvoru (`dscore`, `kss-live`) → normalizovani interni model (`Match`, `Standing`, `PlayerStat`, `Team`).
- Keš u Postgres-u (zasebna šema `sports`) + kratki keš u memoriji; periodična sinhronizacija (npr. 1–5 min na dan utakmica, ređe van sezone).
- Frontend čita **samo naš API** (`/api/sports/...`), nikad direktno DScore/kss-live.
- Ključevi i kredencijali **samo na serveru** (env), nikad u browseru ni u repou. Napomena: base64 nije šifrovanje; token tretiramo kao lozinku.
- Rezervni plan ako API nešto ne pokriva: DScore iframe (`/integrations/leagues/league/{id}/...`) u posebnoj komponenti.
- Istorija sezona se čuva kod nas (DScore ne mora da je drži zauvek) — uz proveru uslova korišćenja.

### 5.2 Implementacija adaptera (3. oktobar 2026)

Kod: `src/sports/` (klijent `dscore/client.ts`, normalizacija `dscore/normalize.ts`, keš `cache.ts`, servis `service.ts`), keš je skrivena kolekcija `sports-cache`.
Javni API (bez prijave, CORS otvoren, `Cache-Control` za CDN):

| Ruta | Sadržaj |
|---|---|
| `GET /api/sports/leagues` (`?all=1`) | tekuće lige po kategorijama / sve vidljive lige |
| `GET /api/sports/leagues/:id` | liga + timovi |
| `GET /api/sports/leagues/:id/standings` | tabela (+ mini-tabele) |
| `GET /api/sports/leagues/:id/schedule?round=&team=&status=` | utakmice (rezultati po četvrtinama, hala, sudije, video) |
| `GET /api/sports/leagues/:id/leaders?stat=&limit=&minGames=` | statistika igrača, računata iz box score-ova |
| `GET /api/sports/matches/:id` | box score obe ekipe + play-by-play |

Pravila: izlažu se samo vidljive lige (ne i interne tipa „Srbija OSTALO"); polja se biraju jedno po jedno (allowlist), pa e-mail/telefon/kontakt osoba nikad ne prolaze (pokriveno testom `tests/int/dscore-normalize.int.spec.ts`); ako izvor padne, služi se zastareli keš; status utakmice se **izvodi** (DScore polje `status` ostaje „scheduled").
TTL keša: tabela/raspored 2 min, utakmica uživo 15 s, završena 30 dana.

**Limit i provera posetioca (važno).** API javlja `X-RateLimit-Limit: 60`. Naša prva sinhronizacija je slala više zahteva nego što je dozvoljeno, pa je Cloudflare za ceo ključ uključio proveru (`403 public_data_verification_required`). Zaobilaženje nije opcija; klijent sada ograničava broj zahteva (korisnici 40/min, bulk 15/min) i pri 403 pravi pauzu od 10 min uz služenje keša. Za produkciju je potreban dogovor sa DScore-om: ključ za server-server izuzet od provere i potvrđen limit.

Sinhronizacija: `npm run sync:sports -- phases` (takmičenja/sezone/faze iz DScore kategorija), `npm run sync:sports -- stats league=ID` (box score-ovi za statistiku; ~240 utakmica po ligi ≈ 16 min zbog limita).

## 6. Migracija

| Izvor | Metod | Posebno |
|---|---|---|
| Članci (kss ~7.5k, lige ~5.4k) | WP REST API → transformacija HTML-a → Article | čišćenje Avada shortcode-a, mapiranje kategorija, preuzimanje slika |
| Medija (~110k) | batch preuzimanje → object storage | prvo meriti koliko je referencirano; neiskorišćeno ne selimo |
| Godišnje stranice reprezentacija (~150) | parser Avada HTML-a → Person + TeamSeason | najveći rizik; ručni pregled |
| Stranice faza lige (~290) | ne selimo; izvlačimo samo `dscoreLeagueId` iz iframe-a → CompetitionPhase | |
| Dokumenta/odluke | članci u kategorijama odluka + PDF prilozi → Document | |
| Redirekti | iz `legacyUrl` → novi URL | uvoz u `redirects` tabelu |

Migracija je skripta koja se **može ponoviti** (idempotentna po `legacyId`), pa je pokrećemo više puta do go-live-a.

## 7. Tehnički stek (preporuka)

- **CMS/backend:** Payload CMS (MIT) + Postgres, multi-tenant plugin.
- **Frontend:** Next.js (SSR/ISR) – postojeće komponente iz ovog repoa se zadržavaju, izvor podataka se menja.
- **Storage/CDN:** S3-kompatibilan (R2/S3).
- **Pretraga:** Postgres FTS u prvoj fazi (odluke i vesti); eksterni servis tek ako zatreba.

## 8. Faza 2: klupski sajtovi (dizajn se predviđa odmah)

Cilj: klubovi bez budžeta dobijaju sajt preko KSS-a (`imekluba.kss.rs`).

- **Site postaje generički:** `Site.type` = `federation` (kss, lige) | `club`; `Site.hostname` (opciono), `Site.pathPrefix` (opciono), `Site.club` (rel). Tenant se bira jednom funkcijom `resolveSite(host, path)`; `lige.kss.rs` se rešava po hostu, klubovi po putanji.
- **Adresiranje klubova (odluka otvorena, vidi 8.1):** start sa `klubovi.kss.rs/ime-kluba` (jedan običan sertifikat, bez wildcard-a); klub sa sopstvenim domenom dobija mapiranje domena (CNAME + automatski sertifikat); `ime.kss.rs` ostaje opcija ako KSS dobije kontrolu nad DNS-om.
- **Club** (kolekcija): `name`, `city`, `logo`, `colors`, `dscoreClubId` (`team_club_id` iz DScore-a), `contactEmail`, `status` (`pending` · `active` · `suspended`), `site`.
- **Besplatno iz DScore-a:** raspored, rezultati, tabela i statistika kluba generišu se čim je `dscoreClubId` povezan. Klub unosi samo vesti, o klubu, kontakt, galerije, sponzore.
- **Uloge:** `club-admin`, `club-editor` – ograničene na jedan `Site`. Za klubove poseban pojednostavljen panel „Moj klub" (ne puni Payload admin).
- **Teme:** 2–3 fiksne teme + blokovi; bez slobodnog dizajna. Brend kluba = logo + boje.
- **Uključivanje:** klub traži sajt → KSS potvrđuje (npr. e-pošta iz registra) → tenant se otvara.
- **Ograničenja:** kvota skladišta i veličine slika po klubu; KSS može da sakrije/suspenduje sadržaj; KSS oznaka je obavezna.
- **Maloletnici:** pravilo šta se automatski prikazuje (imena, fotografije) za mlađe kategorije, uz saglasnost roditelja – odluka pre pilota.
- **Pilot:** 3–5 klubova pre otvaranja svima.

### 8.1 DNS i adresiranje – nalazi (3. oktobar 2026)

- `kss.rs`: registrar Orion Telekom, DNS kod elomec.com (`ns1/ns2.elomec.com`), `*.kss.rs` ne postoji, nema CAA zapisa.
- `kss.rs`, `www`, `lige`, `shop` → `92.204.189.9`; mejl (MX `mail.kss.rs`, SPF) je na istom domenu → pri prebacivanju sajta MX/SPF ne smeju da se diraju.
- Wildcard sertifikat traži DNS-01 proveru (API nad DNS-om) – kod elomec-a verovatno nije dostupan.
- Rizici wildcard-a: preuzimanje subdomena, kolačići na `.kss.rs`, zauzimanje imena (rezervisana lista, odobravanje), zasebni SEO autoritet po subdomenu.
- Za go-live: ko upravlja DNS-om kod elomec-a i da li se DNS može prebaciti (npr. Cloudflare).

## 9. Status migracije (3. oktobar 2026, lokalna baza)

| | kss | lige |
|---|---|---|
| Članci | 7.477 | 4.588 |
| Dokumenta (odluke) | – | 840 |
| Stranice | 37 | – |
| Selekcije (TeamSeason) | 156 (147 sa spiskom, 9 kao tekst) | – |
| Osobe | ~1.300 | – |

Urađeno: tekst svih članaka, kategorije, dokumenta, stranice, reprezentacije. **Nije urađeno:** slike i PDF-ovi (zahtevaju S3 i traju satima; ~50% slika iz 2018–2023 na lige.kss.rs ne postoji na izvoru), redirekti, `OrganMembers` (organi saveza su uvezeni kao obične stranice), tabele u starim stranicama (spisak je tekst).

## 10. Otvorena pitanja

1. Domen liga: poseban `lige.kss.rs` (preporuka) ili `kss.rs/lige`?
2. Koji endpointi DScore API-ja postoje (utakmice, tabele, delegiranja, live, igrači, istorija)?
3. Čemu služe kss-live.com kredencijali (koji URL/endpoint prima Bearer)? Ako ništa ne daje preko DScore-a, ostajemo samo na DScore-u.
4. Da li se DScore leagueId menja svake sezone/faze (izgleda da da)?
5. Engleska verzija sajta: koji delovi, i ko je održava?
6. Mlađe kategorije (JLS, KLS, ŽKLS, Jr. NBA): da li ih DScore pokriva ili je to ručni unos?
7. Pravila arhiviranja odluka (rokovi čuvanja, javnost)?
8. Provera obima baze lige.kss.rs (62.944 „stranica" u admin listi vs 294 u dashboardu).
