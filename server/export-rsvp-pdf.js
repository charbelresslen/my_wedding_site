// Exports the guest list into a formatted, print-ready .pdf for the restaurant/caterer: who is coming, who is
// having which drink, who is having which dish, and a dashboard of totals. Run from this folder:
//
//   node export-rsvp-pdf.js
//
// Reads the same server/.env this API server uses (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME) and writes
// rsvp-export-<date>.pdf next to this file. Renders an HTML report with a real (headless) browser (Puppeteer), so
// the fonts, colours and table styling come out exactly as designed - safe to run again any time, it only reads
// the database.
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { createPool, fetchRsvpData, formatDate, ATTENDANCE_LABEL } = require('./rsvp-data');

const FONTS_DIR = path.join(__dirname, '..', 'src', 'fonts');

async function main() {
  const pool = createPool();

  try {
    const data = await fetchRsvpData(pool);
    const html = buildHtml(data);

    const browser = await puppeteer.launch({ headless: 'new' });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluateHandle('document.fonts.ready');

      const stamp = new Date().toISOString().slice(0, 10);
      const outPath = path.join(__dirname, `rsvp-export-${stamp}.pdf`);
      await page.pdf({
        path: outPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
        displayHeaderFooter: true,
        headerTemplate: '<span></span>', // blank: the report has its own in-page banner instead
        footerTemplate: `
          <div style="width:100%; font-family:Georgia,serif; font-size:8.5px; color:#8a7a68; padding:0 12mm; display:flex; justify-content:space-between;">
            <span>Шарбель &amp; Анна — банкет</span>
            <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
          </div>`,
      });
      console.log(`Written: ${outPath}`);
    } finally {
      await browser.close();
    }
  } finally {
    await pool.end();
  }
}

// ================================================================= fonts (embedded, so the PDF never depends on
// the machine it's rendered on having them installed - the site's own local files, base64-inlined)

function fontFace(family, file, weight, style) {
  const bytes = fs.readFileSync(path.join(FONTS_DIR, file));
  const base64 = bytes.toString('base64');
  return `
    @font-face {
      font-family: '${family}';
      src: url(data:font/woff2;base64,${base64}) format('woff2');
      font-weight: ${weight};
      font-style: ${style};
      font-display: block;
    }`;
}

function buildFontFaces() {
  return [
    fontFace('Great Vibes', 'great-vibes-latin.woff2', 400, 'normal'),
    fontFace('Great Vibes', 'great-vibes-cyrillic.woff2', 400, 'normal'),
    fontFace('Cormorant Garamond', 'cormorant-italic-latin.woff2', 500, 'italic'),
    fontFace('Cormorant Garamond', 'cormorant-italic-cyrillic.woff2', 500, 'italic'),
  ].join('\n');
}

// ================================================================= small helpers

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** A horizontal gold bar sized relative to `max`, with the count printed after it - a lightweight in-row bar chart. */
function bar(value, max) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const muted = value === 0 ? ' muted' : '';
  return `
    <div class="bar-cell${muted}">
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      <span class="bar-value">${value}</span>
    </div>`;
}

// ================================================================= sections

function renderCover({ guests, byAttendance }) {
  return `
    <header class="cover">
      <div class="cover-names">Шарбель <span class="amp">&amp;</span> Анна</div>
      <div class="cover-sub">Списки для банкета — подготовлено ${esc(formatDate(new Date()))}</div>
      <div class="kpis">
        <div class="kpi"><div class="kpi-value">${guests.length}</div><div class="kpi-label">Всего гостей</div></div>
        <div class="kpi"><div class="kpi-value">${byAttendance.both || 0}</div><div class="kpi-label">Церемония и банкет</div></div>
        <div class="kpi"><div class="kpi-value">${byAttendance.zags_only || 0}</div><div class="kpi-label">Только ЗАГС</div></div>
      </div>
    </header>`;
}

function sectionTitle(title, subtitle) {
  return `
    <div class="section-title">
      <h2>${esc(title)}</h2>
      <span class="section-sub">${esc(subtitle)}</span>
    </div>`;
}

function renderGuestsTable(guests) {
  const rows = guests
    .map(
      (g, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${esc(g.full_name)}</td>
        <td class="center"><span class="pill ${g.attendance === 'both' ? 'pill-gold' : 'pill-quiet'}">${esc(ATTENDANCE_LABEL[g.attendance] || g.attendance)}</span></td>
        <td class="center muted-text">${esc(formatDate(g.created_at))}</td>
      </tr>`,
    )
    .join('');
  return `
    <section class="section">
      ${sectionTitle('Список гостей', `Подтвердили присутствие: ${guests.length}`)}
      <table>
        <thead><tr><th class="num">№</th><th>ФИО</th><th class="center">Формат участия</th><th class="center">Дата подтверждения</th></tr></thead>
        <tbody>${rows || emptyRow(4)}</tbody>
      </table>
    </section>`;
}

function renderDrinksTable(drinkRows) {
  const rows = drinkRows
    .map(
      (r, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${esc(r.full_name)}</td>
        <td>${esc(r.drink || '—')}</td>
      </tr>`,
    )
    .join('');
  return `
    <section class="section">
      ${sectionTitle('Напитки по гостям', `Гостей на банкете: ${drinkRows.length}`)}
      <table>
        <thead><tr><th class="num">№</th><th>ФИО</th><th>Напиток</th></tr></thead>
        <tbody>${rows || emptyRow(3)}</tbody>
      </table>
    </section>`;
}

function renderMealsTable(categories, mealsByGuest) {
  const rows = mealsByGuest
    .map(
      (g, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${esc(g.full_name)}</td>
        ${categories.map((c) => `<td>${esc(g.choices.get(c.id) || '—')}</td>`).join('')}
      </tr>`,
    )
    .join('');
  return `
    <section class="section">
      ${sectionTitle('Меню по гостям', `Гостей на банкете: ${mealsByGuest.length}`)}
      <table class="meals-table">
        <thead><tr><th class="num">№</th><th>ФИО</th>${categories.map((c) => `<th>${esc(c.name_ru)}</th>`).join('')}</tr></thead>
        <tbody>${rows || emptyRow(2 + categories.length)}</tbody>
      </table>
    </section>`;
}

function renderDashboard({ drinkCounts, mealCounts }) {
  const drinkMax = Math.max(1, ...drinkCounts.map((d) => d.cnt));
  const drinkRows = drinkCounts
    .map((d) => `<tr><td>${esc(d.drink)}</td><td class="bar-td">${bar(d.cnt, drinkMax)}</td></tr>`)
    .join('');

  const mealMax = Math.max(1, ...mealCounts.map((m) => m.cnt));

  return `
    <section class="section">
      ${sectionTitle('Дашборд банкета', 'Сколько чего заказать у ресторана')}
      <div class="dash-card">
        <h3>Напитки</h3>
        <table class="dash-table">
          <thead><tr><th>Напиток</th><th>Кол-во</th></tr></thead>
          <tbody>${drinkRows || emptyRow(2)}</tbody>
        </table>
      </div>
      <div class="dash-card" style="margin-top:6mm">
        <h3>Меню</h3>
        <table class="dash-table">
          <thead><tr><th>Категория</th><th>Блюдо</th><th>Кол-во</th></tr></thead>
          <tbody>${mealCountRows(mealCounts, mealMax)}</tbody>
        </table>
      </div>
    </section>`;
}

/** The meal-count rows, with the category name shown only once per group of items. */
function mealCountRows(mealCounts, mealMax) {
  let last = null;
  return mealCounts
    .map((m) => {
      const cat = m.category === last ? '' : esc(m.category);
      last = m.category;
      return `<tr><td class="${cat ? 'cat' : ''}">${cat}</td><td>${esc(m.item)}</td><td class="bar-td">${bar(m.cnt, mealMax)}</td></tr>`;
    })
    .join('');
}

function emptyRow(colCount) {
  return `<tr><td colspan="${colCount}" class="empty">Пока нет данных</td></tr>`;
}

// ================================================================= document

function buildHtml(data) {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<style>
  ${buildFontFaces()}

  :root {
    --ink: #540f08;
    --gold: #b58f56;
    --paper: #efe7da;
    --bg: #fdf4eb;
    --text: #2b1b12;
    --muted: #8a7a68;
    --zebra: #f8f1e6;
  }

  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  body {
    margin: 0;
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 10.5px;
    color: var(--text);
    background: #fff;
  }

  .cover {
    text-align: center;
    padding: 4mm 0 8mm;
    border-bottom: 2px solid var(--gold);
    margin-bottom: 8mm;
  }
  .cover-names {
    font-family: 'Great Vibes', cursive;
    font-size: 42px;
    color: var(--ink);
    line-height: 1;
  }
  .cover .amp { color: var(--gold); }
  .cover-sub {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-style: italic;
    font-size: 13px;
    color: var(--muted);
    margin-top: 2mm;
  }

  .kpis { display: flex; justify-content: center; gap: 6mm; margin-top: 6mm; }
  .kpi {
    background: var(--paper);
    border: 1px solid var(--gold);
    border-radius: 10px;
    padding: 4mm 8mm;
    min-width: 34mm;
  }
  .kpi-value { font-family: Georgia, serif; font-size: 24px; font-weight: 700; color: var(--ink); }
  .kpi-label { font-size: 9.5px; color: var(--muted); margin-top: 1mm; }

  .section { page-break-before: always; }
  .cover + .section { page-break-before: avoid; }

  .section-title { margin-bottom: 4mm; }
  .section-title h2 {
    font-family: Georgia, serif;
    font-size: 18px;
    color: var(--ink);
    margin: 0 0 1mm;
    border-left: 4px solid var(--gold);
    padding-left: 3mm;
  }
  .section-sub { font-size: 9.5px; color: var(--muted); padding-left: 3mm; }

  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }

  th {
    background: var(--ink);
    color: #fff;
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    text-align: left;
    padding: 2.6mm 3mm;
    border-bottom: 2px solid var(--gold);
  }
  td {
    padding: 2.2mm 3mm;
    border-bottom: 1px solid #ecdfc9;
    vertical-align: middle;
  }
  tbody tr:nth-child(even) td { background: var(--zebra); }

  .num { width: 8mm; text-align: center; color: var(--muted); }
  .center { text-align: center; }
  .muted-text { color: var(--muted); }
  .empty { text-align: center; color: var(--muted); font-style: italic; padding: 8mm 0; }

  .pill {
    display: inline-block;
    padding: 0.8mm 3mm;
    border-radius: 20px;
    font-size: 9px;
    font-weight: 600;
  }
  .pill-gold { background: var(--gold); color: #fff; }
  .pill-quiet { background: #e7ddcb; color: var(--ink); }

  .meals-table th, .meals-table td { font-size: 9.5px; }

  .dash-card { margin-bottom: 2mm; }
  .dash-card h3 {
    font-family: Georgia, serif;
    font-size: 13px;
    color: var(--ink);
    margin: 0 0 2mm;
  }
  .dash-table td.cat { font-weight: 700; color: var(--ink); }
  .dash-table .bar-td { width: 48mm; }

  .bar-cell { display: flex; align-items: center; gap: 2.5mm; }
  .bar-track { flex: 1; height: 3mm; background: #ecdfc9; border-radius: 3mm; overflow: hidden; }
  .bar-fill { height: 100%; background: linear-gradient(90deg, var(--gold), #d9b878); border-radius: 3mm; }
  .bar-value { width: 6mm; text-align: right; font-weight: 700; color: var(--ink); font-size: 9.5px; }
  .bar-cell.muted .bar-value { color: var(--muted); font-weight: 400; }
</style>
</head>
<body>
  ${renderCover(data)}
  ${renderGuestsTable(data.guests)}
  ${renderDrinksTable(data.drinkRows)}
  ${renderMealsTable(data.categories, data.mealsByGuest)}
  ${renderDashboard(data)}
</body>
</html>`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
