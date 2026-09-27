# Wedding site

Angular 21 (standalone components, zoneless, signals). Built one step at a time.

## Run it

```bash
npm install        # first time only
npm start          # dev server on http://localhost:4200
npm run build      # production build into dist/wedding-site
npm test           # unit tests
```

> Use the project's own Angular (`npm start`, `npx ng ...`), not a globally installed `ng`.
> Angular 21 needs Node 20.19+, 22.12+ or 24+.

Ready to put it online for real guests? See **[DEPLOY.md](DEPLOY.md)** (a Linux server) or
**[DEPLOY-WINDOWS.md](DEPLOY-WINDOWS.md)** (a Windows VM).

## What exists so far

**Step 1 – envelope intro** (`src/app/intro-video/`)

- The sealed envelope shows for 0.8 s (counted from opening the site), then the video starts by itself.
- Sound: it always tries to start **with sound**. Browsers, however, refuse to start sound on a page the visitor
  has not touched yet (a rule of iPhone/Android/desktop browsers that no website can bypass). In that case the
  video starts silently and **the first touch, click or key press anywhere** switches the sound on, mid-video,
  with no button and nothing drawn on screen. If even silent autoplay is refused (e.g. iOS Low Power Mode) a small
  Russian caption "Нажмите, чтобы открыть" appears and a tap starts it. A tap during the first 0.8 s starts
  it right away, with sound. (The only way to guarantee sound for every visitor is a tap-to-open step first.)
- The sealed-envelope poster is an image layered *above* the video and dissolves only once the video is
  really delivering frames, so nothing blank or bright can flash when playback starts.
- ~1.4 s before the end the whole intro fades out to the main page (`src/app/home/`), which holds the sections below, one under the other.
- The whole 1.6 MB video is downloaded into memory first, so it can never stall on the network.
- The video is always shown whole (never cropped) and nothing is drawn over it. Spare screen area is the ivory
  `--paper` colour (`src/styles.css`, used as `--backdrop` in `intro-video.css`).

**Step 2 – the welcome section** (`src/app/hero/`)

- Layout: your photo, unframed and full width (edge to edge on phones), then "Добро пожаловать на свадьбу", a
  small soft divider, and the names "Шарбель & Анна" in Great Vibes between your two burgundy flower corners at the bottom. There is no "scroll down"
  cue any more; the room it used to take under the writing is kept (`--foot-h` in `hero.css`), so the writing stays
  exactly where it was.
  The photo keeps the framing of your reference crop (window + couple) and shows more of the width when the screen
  is short; only the last few percent of the floor melt into the page. The writing is pinned to the bottom, right
  beside the flowers: on a taller phone the spare height goes between the photo and the writing, never between the
  writing and the flowers. The flowers hug the writing column (not the screen edges), and a test with their real
  petal shapes confirms no petal or stem touches the writing on 16 screen sizes.
- Colours: background `#fdf4eb`; ALL writing, including the "&", is burgundy `#540f08` (`--ink` in
  `src/styles.css`). Gold is used only for the tiny twinkling glints.
- The site is entirely Russian (`<html lang="ru">`). Fonts are self-hosted in `src/fonts/` (Great Vibes for the
  names and titles, Cormorant Garamond Italic for the small lines), Cyrillic + Latin subsets. Every letter used was
  checked to be a real drawn glyph. A future section that needs the rarer Cyrillic letters (cyrillic-ext) or digits in
  the script font needs its subset added in `styles.css`. (Comforter, the free Cyrillic font closest to the monogram on
  the wax seal, was tried on the whole site and rejected as too scary; Great Vibes stays.)
- Files (`public/media/`): `hero-couple.webp` (your photo, untouched), `flower-left.webp` / `flower-right.webp`
  (your flower cut-outs, recoloured from cream and gold to the site's burgundy, see "All the flowers are burgundy" below), `divider.webp` (your divider, cropped to its content and shrunk to 1000 px wide,
  lossless so no haze shows around it).
- Layouts: portrait phones and tablets (one column, at most 560 px wide) and screens wider than tall, including
  phones held sideways and desktops (photo left, writing right).
- Entrance: while the envelope video fades, none of the page's writing or flowers is visible (only the photo shows
  through). As soon as the video is almost gone (55% into its 1.4 s dissolve, when it is only about 10% visible, so
  the last, nearly invisible stretch is not waited for), EVERYTHING starts together with the same timing: names,
  small line, divider and flowers fade in over 0.6 s (the names simply appear, no typewriter effect) and the
  divider unrolls softly; the page is complete about 1.2 s after the dissolve starts, before the video would have
  ended. A few gold glints then twinkle. `prefers-reduced-motion` shows the finished page without motion.
  The timing lives in `ALMOST_GONE_FRACTION` (`intro-video.ts`) and the `transition` lines at the end of `hero.css`.
- While building: open `http://localhost:4200/?nointro` to skip the video (the entrance still plays).

**Step 3 – the date** (`src/app/date-section/`)

- The wedding month as a calendar on a soft cream card (no scratching any more): "Декабрь" in Great Vibes with
  **2 0 2 6** in spaced capitals under it, your small divider, then a Monday-first calendar (ПН ... ВС) with the days
  1-31; the **19th** is marked by a burgundy disc with a ring that breathes out around it, and the "СБ" head above its
  column is stressed. Under the card: "Суббота, 19 декабря 2026". The date is set in one place at the top of
  `date-section.ts` (`WEDDING`): the month, the layout of the weeks, the weekday, the caption and the sentence for
  screen readers all follow from it. The calendar is decoration for screen readers, who get one sentence.
- Entrance when the section scrolls into view: the title, year and divider rise, the card fades in, the days come in one
  after the other like a wave running down the month, then the disc pops onto the 19th (a small overshoot), the ring
  breathes out three times and the caption appears. `prefers-reduced-motion` shows it finished, without the ring.
- **Exact geometry:** every size inside the card is computed from the card's own width in plain lengths (`--col`, `--row`,
  `--disc` in `date-section.css`: no `aspect-ratio`, no centring of unsized boxes), the disc is centred by exact offsets and
  the number inside it by flex, and the 19's cell only fades in (it never slides), so nothing can leave the 19 lower than the
  numbers beside it. Measured in a real browser at 10 widths from 280 to 1280 px: the baselines of 18, 19 and 20 differ by
  0.00 px.
- **Petals:** when the middle of the section reaches the middle of the screen (a band of 30% of the screen height
  around the centre, so a fast flick cannot skip it), a quick shower of 48 tiny rose petals falls from the top of the
  screen down to the middle of it and fades out before reaching it: burgundy `#540f08`, each petal with its own opacity
  (20-85%), size, speed and sway; it is released within 1.4 s and over in about 4 s, then removes itself. It falls
  again each time you come back to the section after it has been out of sight, but not while you are still in it.
  Pure CSS transform/opacity animation (runs on the compositor); two layers per petal and 48 petals keep even a slow
  phone smooth (timing constants: `COUNT`, `EMIT_SECONDS`, `fall` in `petal-shower.ts`). Guests who prefer reduced
  motion get no petals.
- Browser tab icon: a burgundy tile with the cream script "Ш" (`public/favicon.ico` with 16/32/48 px, `favicon-32.png`,
  `favicon-192.png` with "Ш&А", `apple-touch-icon.png`, all linked in `src/index.html` with `?v=2` so browsers do not
  keep showing the old Angular icon). If your browser still shows the old one, hard-refresh or reopen the tab.

**Step 4 – the invitation** (`src/app/invitation/`)

- The wall of the ZAGS hall (`public/media/zags-wall.webp`, cropped from your wall picture) is the card: it melts into
  the cream page at the top and bottom (and at the sides on a big screen, where the card is at most 640 px wide). On a
  narrow phone the wall is drawn a little wider than the screen (about 460 px, the extra is cropped at the sides) so the
  big panel the writing sits on is large enough to read.
- Written on the panel, all burgundy: "Вы приглашены на церемонию бракосочетания" (small capitals), **Шарбель** and
  **& Анна** on two lines in Great Vibes (like the first section), your small divider, "Дорогие родные и друзья" and "Будем счастливы разделить с вами день, с которого
  начнётся наша семья." The wording is in `invitation.html`. There are no parents' names, place or time on it yet (not
  given); the date is not repeated here (it has its own section above).
- The peony clusters (`peony-left.webp` / `peony-right.webp`) are your flower picture stood upright as in the reference
  card: the peony at the bottom, its leaf pointing to the middle of the card and the stems rising along the outer edge
  (your picture lies on its side, so it is mirrored and turned about 98 degrees counter-clockwise for the left corner;
  the right one is its mirror image). They sit low, in the lower wall panel and just below the wall's faded bottom
  edge, so they do not crowd the carved ornaments. They are recoloured from cream and gold to the site's burgundy (see "All the flowers are burgundy" below), with a soft burgundy-tinted shadow baked into the pictures. To redo the pictures (different crop of the wall, another rotation angle, shadow strength) run
  `python tools/invitation-assets/make_assets.py [angle]`; the two source pictures are kept next to it.
- Everything is sized as a fraction of the wall's width (container query units), so the writing stays inside its panel
  on every screen. When the section scrolls into view the wall fades in, the lines of writing appear one after another,
  and the peonies grow into their corners and then sway very gently. `prefers-reduced-motion` shows it finished.
  Only opacity and transforms are animated.
- The scroll-triggered sections (date, invitation, programme, countdown, gifts) share one small helper, `src/app/shared/reveal-on-view.ts`.

**Step 4b – "Наша история"** (`src/app/couple/`)

- Your own two photos, right after the invitation, so a guest who has never met you both gets a face to the names: "Наша
  история" in Great Vibes, your small divider, one sentence ("Мы благодарны судьбе за каждый день, что привёл нас друг к
  другу, — и с трепетом ждём дня, когда мы официально станем одной семьёй." — say if you would like different wording),
  then the two pictures, on a small vintage board: a thin double line like a picture frame's mat, a soft aged-paper
  background, and the two photos printed with a plain white border like real prints, each held down with a strip of
  washi tape at an angle — nothing drawn over the pictures themselves and nothing cropped in a way that hides anything.
  The dinner picture is the larger print, sitting straight-ish; the picture by the sea is the smaller one, tilted,
  taped down on top of its corner, the way a candid photo would be stuck onto a scrapbook page.
- Made from your two pictures by `python tools/couple-assets/make_assets.py` (`couple-beach.webp`, `couple-dinner.webp`
  in `public/media/`; only resized and recompressed, the originals are kept next to the script). To use different
  photos, replace the two source files and run it again. The frame, the paper, the prints' white borders and the tape
  are all drawn in CSS, not pictures, so their colours (`couple.css`) follow the site's palette exactly.
- Entrance when it scrolls into view: the heading, the sentence and the board rise into place one after another, and
  the smaller, taped-down photo settles into place a beat after, so it visibly lands there. `prefers-reduced-motion`
  shows it finished, `transform`/`opacity` only.

**Step 5 – the programme of the day** (`src/app/timeline/`)

- "Программа дня" in Great Vibes with your long ornamental separator under it, then a vertical timeline in the style of
  your reference: the pictures and times alternate left and right of a central rail with a small diamond marker at
  each step. **16:00 Прибытие в ЗАГС** (bride and groom), **18:00 Приветственный напиток** (glasses in the arch),
  **19:00 Банкетный ужин** (the domed dish). Times and wording are at the top of `timeline.ts`; the pictures are in
  `public/media/timeline-*.webp`.
- The rail is your two sticks: the finial of the first stick at the top, the finial of the last stick at the bottom and
  a plain piece of rod stretched between them (all cut from the same columns of your pictures, so they line up).
- The burgundy flower rides the rail as you scroll. It waits at the first marker, slides down in step with the scroll
  (turning a little on the way), is level with each step's marker as it passes it, and rests on the last marker when
  the timeline has been scrolled through (or when the page ends). Only one transform of one element is written per
  frame, nothing is measured while scrolling. `prefers-reduced-motion`: it still follows the scroll but does not turn.
  The tuning constants (`FOCUS_START`, `FOCUS_END`, `TURN_DEGREES`, `CATCH_UP`) are at the top of `timeline.ts`.
- Each step fades in (picture from its side, then the writing) when it scrolls into view.
- The pictures are made from your originals by `python tools/timeline-assets/make_assets.py` (the originals are kept
  next to the script).

**Step 6 – the countdown** (`src/app/countdown/`)

- "До начала торжества" in Great Vibes, your small divider, and a clock in the same script: days : hours : minutes :
  seconds, each with its label under it. The labels take the right Russian form as the numbers change (1 день,
  2 дня, 5 дней; 1 час, 2 часа, 5 часов; 1 минута, 2 минуты, 5 минут; 1 секунда, 2 секунды, 5 секунд).
- Whenever a digit changes it rolls: each digit sits in its own window; the old digit goes up and out of the window
  while the next one rises into it right behind it, at the same speed and with the same easing (0.6 s), so the two
  never overlap or touch and nothing fades (only a transform is animated, so it runs on the compositor). Only the digits
  that really change roll: every second the last digit of the seconds, every ten seconds the tens, and so on up to the
  days. `prefers-reduced-motion`: the digits simply change.
- The digits stand upright. Great Vibes leans to the right, so the digits are skewed back by 21 degrees (`skewX(21deg)`
  on an inner `.ink` element, the average lean of its digits measured on the rendered glyphs); that keeps their weight
  but makes them narrower and stops them leaning into their neighbours.
- The moment it counts down to is at the top of `countdown.ts` (`CELEBRATION`): **19 December 2026, 16:00** (the arrival
  at the ZAGS in the programme), read as the guest's own local time. To pin it to the venue's time zone whatever the
  guest's is, give it an offset, e.g. `'2026-12-19T16:00:00+03:00'`. When the time comes the title turns into
  "Торжество началось" and the clock stops at 00 : 00 : 00.
- The clock ticks on the second straight from the device clock (it cannot drift), only while the section is near the
  screen and the tab is in front; it catches up at once when you come back. Screen readers are given one calm sentence
  ("До начала торжества: 84 дня, 17 часов, 16 минут", updated once a minute), not the ticking digits.

**Step 7 – the location** (`src/app/location/`)

- "Локация" in Great Vibes with your small divider and the big burgundy peony cluster at the top right (your photo 2), then the
  two places one under the other, laid out like your reference: the kind of place in script (**Церемония** / **Банкет**),
  the city in spaced capitals (**ЕКАТЕРИНБУРГ**), the name (**Дворец бракосочетания** / **Отель «Гранд Авеню»**) and the
  street (**улица Карла Либкнехта, 3** / **проспект Ленина, 40**), then the place's photo (your ZAGS and hotel photos,
  melting into the page at the top and bottom, with the burgundy sprig of flowers from your photo 3 on its bottom-left corner),
  its map, and under the map a burgundy button **Открыть в Яндекс Картах** that opens the place in Yandex Maps in a new
  tab (on a phone with the Yandex Maps app it opens there). Texts, photos, coordinates and links are all in `VENUES` at
  the top of `location.ts`.
- **The maps.** Each map starts as a **picture** from Yandex Static Maps (`static-maps.yandex.ru`, 615x450, a red pin on the
  exact spot, the Yandex credit inside the picture, about 58 kB each, no key needed): it is there at once and can never
  be a blank grid. **Tap the map** (the round "move" mark in its corner) and the **movable Yandex map** (`yandex.ru/map-widget`,
  a very heavy page) loads behind the picture: a spinner shows in the corner while it loads, and it fades in over the
  picture 4.5 s after its page has loaded (`TILES_MS` in `venue-map.ts`); then you can move and zoom it. The picture is
  kept in front for that long because nothing on the page can tell when the map has drawn its tiles (it is a frame from
  another site), and before that Yandex's map shows an empty dotted grid, which is what looked like a "blank map" on a slow
  connection. If the picture cannot be loaded, the movable map is loaded instead, straight away (with the spinner until its
  page has loaded). The button under the map opens the place in Yandex Maps (the app, on a phone that has it).
- The coordinates are the ones Yandex Maps itself gives for each place (read from your two links): the ZAGS is the
  organisation "Управление ЗАГС Свердловской области, Дворец бракосочетания", Karla Libknekhta 3 (60.612029, 56.836194) and
  Lenina 40 is the Grand Avenue Hotel (60.612638, 56.838967). (The `ll=` numbers inside your links are only where your
  own map view was centred, a few hundred metres off, so they were not used for the pins.) The buttons use your links,
  cleaned of the search context and pointing at yandex.ru so the page opens in Russian.
- **The frame:** burgundy (`#6f0116`, the colour of your ornament picture, so the two meet in one colour), 2 px, rounded,
  with your ornament picture on its top edge and, turned upside down, on its bottom edge. The ornament's own horizontal
  line lies exactly on the frame's line (checked to the pixel), so the frame and the ornament read as one drawing.
  `tools/location-assets/make_assets.py` prints the ornament's baseline position (90.91% of its height) that the CSS
  in `venue-map.css` relies on.
- **Smoothness:** when the site opens, the only things fetched from Yandex are the two small map pictures (when they come
  near the screen); the heavy movable map is only loaded when a map is tapped. A transparent cover (a real button, so the
  keyboard reaches it too) lies over the map: a swipe over it scrolls the page instead of dragging the map (no scroll trap),
  a tap makes the map movable, and a tap anywhere outside the map puts the cover back. Measured in a real browser: swipe
  over the cover scrolls the page, and there are no slow frames while scrolling through the section.
- The section is added after the countdown in `src/app/home/home.ts` (move the `<app-location />` line to put it
  elsewhere). Its parts play their entrance one by one as they scroll into view (helper `revealParts` in
  `src/app/shared/reveal-on-view.ts`, now also used by the timeline); `prefers-reduced-motion` shows it finished.
- The pictures are made from your originals by `python tools/location-assets/make_assets.py` (originals kept next to it); the peony and the sprig are recoloured there from cream and gold to the site's burgundy.

**Step 8 – the dress code** (`src/app/dress-code/`)

- "Дресс-код" in Great Vibes with your small divider, then your picture of the guests in the palette (`dress-people.webp`,
  your transparent cut-out trimmed to the figures and shrunk to 1200 px, 176 kB, with a soft shadow on the floor under their
  feet; it stands inside the screen with a margin on each side, so the guests at the two ends do not touch the screen's
  edge; on a big screen its very ends also melt away in a light fade), then the invitation in the style of your
  reference: "Мы будем рады видеть вас" in italics and **"в нарядах этих оттенков"** in the script, and under it the palette.
- **The palette** is six circles drawn in CSS (no pictures): **Бордо** `#540f08`, **Шоколад** `#321b0d`, **Мокко** `#8d6752`,
  **Пудровый** `#cf9f9d` (the four colours read from your circles picture), then **Чёрный** `#161312` and **Молочный**
  `#fdf4eb`, exactly the colour of the site's background (`--bg`), added at your request. Each circle has its colour, a soft
  light from the top left, an inner ring, a hairline outer ring (so the cream one shows on the cream page) and a shadow,
  and its name in small italics under it. Six in a row (three and three on a very narrow phone); all sizes come from the
  width of the column in plain lengths, so they cannot drift between browsers. Colours and names are in `SHADES` at the top
  of `dress-code.ts`.
- Entrance when it scrolls into view: the title, the figures and the sentence rise one after the other, then the circles
  pop in left to right (a small overshoot). On a computer a circle rises a few pixels under the pointer. Both are
  `transform`/`opacity` only; `prefers-reduced-motion` shows it finished.
- The section is added after the location in `src/app/home/home.ts` (move the `<app-dress-code />` line to put it elsewhere).
  The picture is made from your original by `python tools/dresscode-assets/make_assets.py` (the original is kept next to it).

**Step 10 – RSVP** (`src/app/rsvp/`, and the small server in `server/`)

- A quiet card: "Подтверждение" in Great Vibes, your small divider, a sentence asking guests to confirm **by 30 November
  2026**, and an **RSVP** button (kept in Latin on purpose, like on your reference card — it is the one word of the site
  that is not Russian; say if you would rather it read "Подтвердить"). The button opens a form in a soft, blurred-backdrop
  dialog, closable with the × button, the Escape key or a tap outside it.
- **The form:** full name; then one choice — **на церемонии в ЗАГСе и на банкете** (both) or **только на церемонии в
  ЗАГСе** (ZAGS only). Guests staying only for the ceremony are done there: nothing else is asked of them, since the menu
  below does not concern them. Guests staying for the banquet also choose **one drink** (your list from the reference photo:
  8 kinds of champagne/wine, vodka, cognac, or "I don't drink alcohol", all translated to Russian) and **one dish from each
  of 4 menu categories** — Аперитив, Холодные закуски, Хлеб, Салаты — read from "Примерное меню 30 ч.pdf". The two
  single-item categories of that menu (the potato pancakes and the baked pork) are not asked about — with only one dish,
  there is nothing to choose, so the caterer simply serves them to everyone; nothing is lost, and the form stays shorter.
  A ✓ press submits it; a quiet checkmark and "Спасибо, {имя}! Мы очень ждём встречи с вами." replace the form on success.
- **Why there is a `server/` folder.** A guest's phone cannot write into a MySQL database directly — browsers are not
  allowed to speak the database's protocol, only HTTP. So a small Node server sits between the form and the database: it
  hands the form its menu (`GET /api/menu`) and saves one guest's answer (`POST /api/rsvp`). The menu itself is **not**
  written in the Angular code: it lives in the database (seeded by `server/schema.sql`), fetched by the form the moment it
  opens, so you can rename a dish or add a drink by editing a table, with no code change and no rebuild.
- **The database.** Six MySQL tables (see `server/schema.sql`, which creates and comments every one): `rsvp` (name, "both"
  or "zags_only", the time it was sent), `drink_options` and `food_categories`/`food_items` (the menu, seeded with your
  content), `rsvp_drink_choice` (one row per rsvp — its own primary key is the rsvp, so it cannot hold two) and
  `rsvp_food_choice` (one row per rsvp *and category*, so exactly one dish per category is possible, never two, never
  none). A view, `rsvp_overview`, lists every guest with their drink and dishes in one readable row — open it in MySQL
  Workbench (`SELECT * FROM rsvp_overview;`) whenever you want to see who is coming.
- **To set it up (once):** you already have MySQL 8.0 and MySQL Workbench installed and running.
  1. Run `server/schema.sql` against your MySQL server as an account that can create databases — easiest is to open the
     file in MySQL Workbench (your existing "Local instance MySQL80" connection) and press the ⚡ *Execute* button. It only
     creates things (`IF NOT EXISTS`), so running it again later is harmless and never deletes an RSVP. It also creates a
     separate, low-privilege `wedding_rsvp` database user for everyday use, so the server never needs your root password.
  2. In `server/`, copy `.env.example` to `.env` (already filled in with matching values — nothing to edit for local use).
  3. `npm install` once, then `npm start`, inside `server/`. It prints `RSVP API listening on http://localhost:3010`
     (port 3001 would have been the more obvious choice, but it was already taken by another project on this machine).
  4. Keep the Angular app running as usual (`npm start` in the project root). Open the site, scroll to "Подтверждение".
     **This has already been done once** — the schema is in place, the server has run a real submission end to end, and
     your own test RSVP is sitting in the `rsvp` table; delete it in Workbench whenever you like, it will not be missed.
- **Only reachable from this Wi-Fi for now** (or wherever `server/` and MySQL actually run — a VM works the same way).
  The form always asks for the API at the *same address the page itself was loaded from*, just on the API's own port
  (`API_PORT`, `src/app/rsvp/rsvp.ts` — nothing to edit there when the site moves to a VM or a real server, only the
  page's own address changes and the form follows it automatically); the server's CORS rule (`server/index.js`) already
  allows any address on a private network (Wi-Fi, or a private VM address) automatically. A VM or a server with a real,
  public address needs one manual step: add that exact address to `ALLOWED_ORIGINS` in the server's `.env` (see
  DEPLOY.md), since it is no longer "on the same private network" as a guest's own phone. **See
  [DEPLOY.md](DEPLOY.md)** (Linux) or **[DEPLOY-WINDOWS.md](DEPLOY-WINDOWS.md)** (a Windows VM) for the one-time setup
  that puts the site, the API and the database on a real address so any guest can open it and RSVP.

**Step 9 – the gifts** (`src/app/gift/`)

- "О подарках" in Great Vibes with your small divider, written on **the wall** from your picture (`gift-wall.webp`, your
  transparent cut-out, 115 kB): the text sits on its big empty panel, between the carved corner ornaments, exactly like the
  text on the card of your reference. A **burgundy flower cluster at the top-left and one at the bottom-right** (your two
  flower pictures, `gift-flower-tl.webp` / `gift-flower-br.webp`, about 66 kB each) hug the corners of the visible screen.
- **The flowers were cream and gold; they are recoloured to the site's burgundy** by `tools/gift-assets/make_assets.py`, with
  the same recolour as every other flower of the site (see "All the flowers are burgundy" below).
- **The words** (Russian, all in `gift.html`; the "kids" paragraph of the reference is left out, as you asked):
  1. "Лучшая поддержка для нас — ваша любовь, ваши молитвы и ваше присутствие рядом."
  2. "Если захотите порадовать нас подарком, мы будем тронуты конвертом: пусть он станет вашим вкладом в нашу молодую семью."
  3. (under a small drawn envelope with a heart, where the reference has its "gift list" link) "А вместо букетов мы с радостью
     примем лотерейные билеты: цветы завянут, а вдруг нам повезёт!"
- **Layout:** the wall is drawn a little wider than a phone (about 470 px; the extra at the sides is cropped) so the panel is
  large enough to read; on a big screen the card is 640 px wide and the flowers overhang its corners a little (the stage does
  not clip them, so they stay whole; the extra of the wall on a phone is cropped by the section, which is as wide as the phone). Every size inside it is a fraction of the wall's width
  (container query units), so the writing stays inside its panel on every screen (checked at 280, 320, 390, 768, 1280 px).
- When it scrolls into view the wall fades in, the lines appear one after another, and the flowers grow into their corners
  and then sway very gently (transform only). `prefers-reduced-motion` shows it finished.
- The section is added after the dress code in `src/app/home/home.ts` (move the `<app-gift />` line to put it elsewhere).

**All the flowers are burgundy, their middles cream** (`tools/burgundy.py`)

- The flower pictures were delivered cream and gold. On every section that has them (the first section under the photo, the
  invitation, the location and the gifts; the programme's flower and the rail's top finial were already burgundy) they are
  recoloured to the site's burgundy by one shared function, `recolour()` in `tools/burgundy.py`: each pixel's brightness is
  looked up in a ramp from dark burgundy (`#540f08` is its third stop, at brightness 150) to a soft rose highlight, so the
  petals keep all their folds and light and only the colour changes (the transparency is untouched).
- **The pearl and the little beads in the middle of each flower are painted cream**, the colour of the page itself, instead
  of burgundy — the "dots" you asked to match the background. `recolour()` finds them itself: told roughly where a flower's
  middle is (a point and a radius, measured once by eye on the source picture), it looks for the ring of small, strongly
  golden beads around that point, follows it all the way round, fills the pearl at its centre, and paints the whole shape
  cream — keeping the beads' own light and shade (another small ramp, `CREAM` in `tools/burgundy.py`), so they still read as
  a string of pearls, not a flat sticker. The programme's flower and the finial's small flower were burgundy from the start
  (no gold to find), so a second function, `cream_spheres()`, does the same for them by brightness alone.
- To make every flower darker or lighter, or its middles more or less cream, edit `RAMP`, `CREAM` or `SPHERE` in
  `tools/burgundy.py` and run the five scripts again: `tools/hero-assets/`, `tools/invitation-assets/`,
  `tools/location-assets/`, `tools/gift-assets/` and `tools/timeline-assets/make_assets.py` (each writes into
  `public/media/`; the cream-and-gold or plain-burgundy originals are kept beside the scripts, so nothing is lost). If a
  flower ever changes and the middle moves, the three numbers next to its name at the top of that script (`x, y, radius`,
  measured on the source picture with its transparent edges cropped) need updating to match.
- To get the cream and gold flowers of one section back, or leave one flower's middle burgundy, take the `recolour(...)`
  call (or its list of middles) out of its script and run it.

**Step 11 – the closing card** (`src/app/closing/`)

- The very last thing on the page: the same two flowers as the welcome section at the top (a bookend), your small
  divider, "До скорой встречи!" in Great Vibes, and underneath it, quietly, "Сделано с любовью" — with no name or brand
  on it, like you asked. Change the wording in `closing.html` if you would like something else.

**Step 12 – the music** (`src/app/background-music/`)

- "Ambient Piano" by AtlasAudio: a quiet instrumental piece (piano over a soft pad, no words), chosen from Pixabay's
  library of music that is free to use, including here, without asking anyone or naming them (the
  [Pixabay Content License](https://pixabay.com/service/license-summary/)). It starts the moment the envelope has
  (almost) finished opening — the same moment the page itself appears — and loops for as long as a guest stays on the
  page. A small round button in the corner (bottom right) is the only way to stop it; browsers require *some* way to
  silence sound that starts on its own, so this one small addition was necessary, not optional. Tap it again to bring
  the music back; the choice is remembered for next time the same guest opens the page.
- Made from the file kept in `tools/music-assets/` (the untouched original, and `make_assets.py`, which halves its
  size for the web without an audible difference through a phone speaker) into `public/media/background-music.mp3`
  (2.9 MB, downloaded once).
- Sound cannot start on its own until a guest has touched the page once — the same rule the envelope's own video
  already works around. It is tried three ways, in order: with sound; if that is refused, silently, so it is at
  least already playing; and the very first tap, click or key anywhere switches the sound on (exactly like the
  envelope), so nearly every guest hears it within a second or two of the page appearing, without ever being stuck
  silent. The button reflects the truth at every moment — if the page is, right now, actually silent, it shows that.
- To use a different piece of music, replace `tools/music-assets/source-ambient-piano.mp3` with another file and run
  `python tools/music-assets/make_assets.py`. To change how loud it is, edit `VOLUME` in `background-music.ts`
  (currently `0.4`, meant to sit under everything else rather than compete with it).

## The video files (`public/media/`)

`envelope.mp4` is built from your watermark-free export `wm_free_cover.mp4`:

- the **video stream is copied untouched** (decoded pixels are identical to the export). Only metadata changed:
  colours are explicitly tagged BT.709/limited range (the export had no colour tags, so browsers could guess
  differently) and the index (`moov`) is moved to the front of the file;
- the **audio track is re-encoded** (AAC 192k): +12 dB linear gain (the export was very quiet, about −37 LUFS,
  now about −26 LUFS, peak −1.9 dB) and a 1.4 s fade-out over the last seconds (iOS ignores JavaScript volume
  changes, so the fade has to be in the file).

`envelope-poster.jpg` is frame 0 of the video, converted with the same BT.709 maths a browser uses, so the
poster and the video match colour for colour.

To redo both from a new export (`ffmpeg` is not installed system-wide):

```bash
# video + audio (replace <duration-1.5> with the clip length minus 1.5, e.g. 6.667 for an 8.167 s clip)
ffmpeg -i NEW.mp4 -map 0:v:0 -map 0:a:0 -c:v copy \
  -bsf:v "h264_metadata=video_full_range_flag=0:colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1" \
  -c:a aac -b:a 192k -ar 48000 \
  -af "volume=12dB,alimiter=limit=0.89:level=disabled,afade=t=out:st=<duration-1.5>:d=1.4:curve=qsin" \
  -movflags +faststart public/media/envelope.mp4

# poster
ffmpeg -i public/media/envelope.mp4 -frames:v 1 \
  -vf "scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24,scale=out_color_matrix=bt601:out_range=pc,format=yuvj444p" \
  -c:v mjpeg -q:v 2 public/media/envelope-poster.jpg
```
