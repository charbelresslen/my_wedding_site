// Exports the guest list into a formatted .xlsx workbook for the restaurant/caterer: who is coming, who is having
// which drink, who is having which dish, and a dashboard of totals. Run from this folder:
//
//   node export-rsvp.js
//
// Reads the same server/.env this API server uses (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME) and writes
// rsvp-export-<date>.xlsx next to this file. Safe to run again any time - it only reads the database.
'use strict';

require('dotenv').config();
const path = require('path');
const mysql = require('mysql2/promise');
const ExcelJS = require('exceljs');

// The site's own palette (see src/styles.css): burgundy ink, gold accent, ivory paper, cream page background.
const C = {
  ink: 'FF540F08',
  gold: 'FFB58F56',
  paper: 'FFEFE7DA',
  bg: 'FFFDF4EB',
  white: 'FFFFFFFF',
  text: 'FF2B1B12',
  zebra: 'FFF8F1E6',
};

const ATTENDANCE_LABEL = { both: 'Церемония и банкет', zags_only: 'Только ЗАГС' };

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'wedding_rsvp',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wedding_rsvp',
  });

  try {
    const [guests] = await pool.query(
      `SELECT id, full_name, attendance, created_at FROM rsvp ORDER BY created_at ASC`,
    );
    const [drinkRows] = await pool.query(`
      SELECT r.full_name, r.created_at, d.name_ru AS drink
      FROM rsvp r
      LEFT JOIN rsvp_drink_choice rdc ON rdc.rsvp_id = r.id
      LEFT JOIN drink_options d ON d.id = rdc.drink_option_id
      WHERE r.attendance = 'both'
      ORDER BY r.created_at ASC
    `);
    const [categories] = await pool.query(
      `SELECT id, name_ru, sort_order FROM food_categories ORDER BY sort_order`,
    );
    const [foodChoiceRows] = await pool.query(`
      SELECT r.id AS rsvp_id, r.full_name, r.created_at, fc.id AS category_id, fi.name_ru AS item_name
      FROM rsvp r
      JOIN rsvp_food_choice rfc ON rfc.rsvp_id = r.id
      JOIN food_categories fc ON fc.id = rfc.category_id
      JOIN food_items fi ON fi.id = rfc.food_item_id
      WHERE r.attendance = 'both'
      ORDER BY r.created_at ASC
    `);
    const [attendanceCounts] = await pool.query(
      `SELECT attendance, COUNT(*) AS cnt FROM rsvp GROUP BY attendance`,
    );
    const [drinkCounts] = await pool.query(`
      SELECT d.name_ru AS drink, d.sort_order, COUNT(rdc.rsvp_id) AS cnt
      FROM drink_options d
      LEFT JOIN rsvp_drink_choice rdc ON rdc.drink_option_id = d.id
      GROUP BY d.id
      ORDER BY d.sort_order
    `);
    const [mealCounts] = await pool.query(`
      SELECT fc.name_ru AS category, fc.sort_order AS csort, fi.name_ru AS item, fi.sort_order AS isort, COUNT(rfc.rsvp_id) AS cnt
      FROM food_items fi
      JOIN food_categories fc ON fc.id = fi.category_id
      LEFT JOIN rsvp_food_choice rfc ON rfc.food_item_id = fi.id
      GROUP BY fi.id
      ORDER BY fc.sort_order, fi.sort_order
    `);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'wedding-rsvp export-rsvp.js';
    workbook.created = new Date();

    buildGuestsSheet(workbook, guests);
    buildDrinksSheet(workbook, drinkRows);
    buildMealsSheet(workbook, categories, foodChoiceRows);
    buildDashboardSheet(workbook, { guests, attendanceCounts, drinkCounts, mealCounts });

    const stamp = new Date().toISOString().slice(0, 10);
    const outPath = path.join(__dirname, `rsvp-export-${stamp}.xlsx`);
    await workbook.xlsx.writeFile(outPath);
    console.log(`Written: ${outPath}`);
  } finally {
    await pool.end();
  }
}

// ================================================================= shared styling helpers

/** A big banner title spanning every column of the sheet, then a blank spacer row. Returns the next free row. */
function addBanner(sheet, colCount, title, subtitle) {
  sheet.mergeCells(1, 1, 1, colCount);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: 'Georgia', size: 20, bold: true, color: { argb: C.white } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 34;
  for (let c = 1; c <= colCount; c++) sheet.getCell(1, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.ink } };

  sheet.mergeCells(2, 1, 2, colCount);
  const subCell = sheet.getCell(2, 1);
  subCell.value = subtitle;
  subCell.font = { name: 'Calibri', size: 11, italic: true, color: { argb: C.ink } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(2).height = 20;
  for (let c = 1; c <= colCount; c++) sheet.getCell(2, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.paper } };

  return 3; // the row the column header belongs on
}

/** Styles the header row (bold gold-on-ink) at `rowNum` across `colCount` columns, and freezes everything above it. */
function styleHeaderRow(sheet, rowNum, colCount) {
  const row = sheet.getRow(rowNum);
  row.height = 22;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: C.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.gold } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder();
  }
  sheet.views = [{ state: 'frozen', ySplit: rowNum }];
}

function thinBorder() {
  const side = { style: 'thin', color: { argb: 'FFDDD0BE' } };
  return { top: side, left: side, bottom: side, right: side };
}

/** Zebra-stripes and borders every data row from `firstRow` to `lastRow`, across `colCount` columns. */
function styleDataRows(sheet, firstRow, lastRow, colCount, centerCols = []) {
  for (let r = firstRow; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    const banded = (r - firstRow) % 2 === 1;
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.font = { name: 'Calibri', size: 11, color: { argb: C.text } };
      cell.border = thinBorder();
      if (banded) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.zebra } };
      if (centerCols.includes(c)) cell.alignment = { vertical: 'middle', horizontal: 'center' };
      else cell.alignment = { vertical: 'middle', horizontal: 'left' };
    }
  }
}

function formatDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}.${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

// ================================================================= sheet 1: guest list

function buildGuestsSheet(workbook, guests) {
  const sheet = workbook.addWorksheet('Гости', { properties: { tabColor: { argb: C.ink } } });
  sheet.columns = [{ width: 6 }, { width: 34 }, { width: 26 }, { width: 20 }];

  const headerRow = addBanner(sheet, 4, 'Список гостей', `Подтвердили присутствие: ${guests.length}`);
  sheet.getRow(headerRow).values = ['№', 'ФИО', 'Формат участия', 'Дата подтверждения'];
  styleHeaderRow(sheet, headerRow, 4);

  guests.forEach((g, i) => {
    sheet.getRow(headerRow + 1 + i).values = [
      i + 1,
      g.full_name,
      ATTENDANCE_LABEL[g.attendance] || g.attendance,
      formatDate(g.created_at),
    ];
  });
  styleDataRows(sheet, headerRow + 1, headerRow + guests.length, 4, [1, 3, 4]);
  sheet.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: 4 } };
}

// ================================================================= sheet 2: drinks

function buildDrinksSheet(workbook, drinkRows) {
  const sheet = workbook.addWorksheet('Напитки', { properties: { tabColor: { argb: C.gold } } });
  sheet.columns = [{ width: 6 }, { width: 34 }, { width: 30 }];

  const headerRow = addBanner(sheet, 3, 'Напитки по гостям', `Гостей на банкете: ${drinkRows.length}`);
  sheet.getRow(headerRow).values = ['№', 'ФИО', 'Напиток'];
  styleHeaderRow(sheet, headerRow, 3);

  drinkRows.forEach((r, i) => {
    sheet.getRow(headerRow + 1 + i).values = [i + 1, r.full_name, r.drink || '—'];
  });
  styleDataRows(sheet, headerRow + 1, headerRow + drinkRows.length, 3, [1, 3]);
  sheet.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: 3 } };
}

// ================================================================= sheet 3: meals (pivoted: one column per category)

function buildMealsSheet(workbook, categories, foodChoiceRows) {
  const sheet = workbook.addWorksheet('Меню', { properties: { tabColor: { argb: C.gold } } });
  const colCount = 2 + categories.length;
  sheet.columns = [{ width: 6 }, { width: 34 }, ...categories.map(() => ({ width: 26 }))];

  // one row per banquet guest, in first-confirmed order
  const byGuest = new Map(); // rsvp_id -> { full_name, created_at, choices: Map<category_id, item_name> }
  for (const row of foodChoiceRows) {
    let entry = byGuest.get(row.rsvp_id);
    if (!entry) {
      entry = { full_name: row.full_name, created_at: row.created_at, choices: new Map() };
      byGuest.set(row.rsvp_id, entry);
    }
    entry.choices.set(row.category_id, row.item_name);
  }
  const guestRows = [...byGuest.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const headerRow = addBanner(sheet, colCount, 'Меню по гостям', `Гостей на банкете: ${guestRows.length}`);
  sheet.getRow(headerRow).values = ['№', 'ФИО', ...categories.map((c) => c.name_ru)];
  styleHeaderRow(sheet, headerRow, colCount);

  guestRows.forEach((g, i) => {
    sheet.getRow(headerRow + 1 + i).values = [
      i + 1,
      g.full_name,
      ...categories.map((c) => g.choices.get(c.id) || '—'),
    ];
  });
  styleDataRows(sheet, headerRow + 1, headerRow + guestRows.length, colCount, [1]);
  sheet.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: colCount } };
}

// ================================================================= sheet 4: dashboard

function buildDashboardSheet(workbook, { guests, attendanceCounts, drinkCounts, mealCounts }) {
  const sheet = workbook.addWorksheet('Дашборд', { properties: { tabColor: { argb: C.ink } } });
  sheet.columns = [{ width: 30 }, { width: 14 }, { width: 30 }, { width: 30 }];

  addBanner(sheet, 4, 'Дашборд банкета', `Обновлено: ${formatDate(new Date())}`);

  const byAttendance = Object.fromEntries(attendanceCounts.map((r) => [r.attendance, r.cnt]));
  const kpis = [
    { label: 'Всего гостей', value: guests.length },
    { label: 'Церемония и банкет', value: byAttendance.both || 0 },
    { label: 'Только ЗАГС', value: byAttendance.zags_only || 0 },
  ];

  // three KPI cards, side by side, each a merged 2-row block, laid out across columns A-D as merged pairs
  const kpiTop = 4;
  const cardSpans = [
    [1, 1],
    [2, 2],
    [3, 4],
  ];
  kpis.forEach((kpi, i) => {
    const [c1, c2] = cardSpans[i];
    sheet.mergeCells(kpiTop, c1, kpiTop, c2);
    sheet.mergeCells(kpiTop + 1, c1, kpiTop + 1, c2);
    const valueCell = sheet.getCell(kpiTop, c1);
    valueCell.value = kpi.value;
    valueCell.font = { name: 'Georgia', size: 28, bold: true, color: { argb: C.ink } };
    valueCell.alignment = { vertical: 'middle', horizontal: 'center' };
    const labelCell = sheet.getCell(kpiTop + 1, c1);
    labelCell.value = kpi.label;
    labelCell.font = { name: 'Calibri', size: 12, color: { argb: C.text } };
    labelCell.alignment = { vertical: 'middle', horizontal: 'center' };
    for (const r of [kpiTop, kpiTop + 1]) {
      for (let c = c1; c <= c2; c++) {
        sheet.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.paper } };
        sheet.getCell(r, c).border = thinBorder();
      }
    }
  });
  sheet.getRow(kpiTop).height = 40;
  sheet.getRow(kpiTop + 1).height = 20;

  let cursor = kpiTop + 3; // blank row after the cards

  // ---- drinks table ----
  sheet.mergeCells(cursor, 1, cursor, 2);
  sheet.getCell(cursor, 1).value = 'Напитки';
  sheet.getCell(cursor, 1).font = { name: 'Georgia', size: 14, bold: true, color: { argb: C.white } };
  sheet.getCell(cursor, 1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(cursor).height = 24;
  for (const c of [1, 2]) sheet.getCell(cursor, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.ink } };
  cursor += 1;

  const drinksHeaderRow = cursor;
  sheet.getCell(cursor, 1).value = 'Напиток';
  sheet.getCell(cursor, 2).value = 'Кол-во';
  styleHeaderRow2Col(sheet, cursor);
  cursor += 1;
  const drinksFirstDataRow = cursor;
  drinkCounts.forEach((d) => {
    sheet.getCell(cursor, 1).value = d.drink;
    sheet.getCell(cursor, 2).value = d.cnt;
    cursor += 1;
  });
  const drinksLastDataRow = cursor - 1;
  styleDataRows(sheet, drinksFirstDataRow, drinksLastDataRow, 2, [2]);
  addCountDataBar(sheet, `B${drinksFirstDataRow}:B${drinksLastDataRow}`);

  cursor += 2; // blank rows before the meals table

  // ---- meals table (grouped by category, with a coloured sub-header per category) ----
  sheet.mergeCells(cursor, 1, cursor, 3);
  sheet.getCell(cursor, 1).value = 'Меню банкета';
  sheet.getCell(cursor, 1).font = { name: 'Georgia', size: 14, bold: true, color: { argb: C.white } };
  sheet.getCell(cursor, 1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(cursor).height = 24;
  for (const c of [1, 2, 3]) sheet.getCell(cursor, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.ink } };
  cursor += 1;

  const mealsHeaderRow = cursor;
  sheet.getCell(cursor, 1).value = 'Категория';
  sheet.getCell(cursor, 2).value = 'Блюдо';
  sheet.getCell(cursor, 3).value = 'Кол-во';
  styleHeaderRow(sheet, mealsHeaderRow, 3);
  cursor += 1;

  const mealsFirstDataRow = cursor;
  let lastCategory = null;
  mealCounts.forEach((m) => {
    sheet.getCell(cursor, 1).value = m.category === lastCategory ? '' : m.category;
    sheet.getCell(cursor, 2).value = m.item;
    sheet.getCell(cursor, 3).value = m.cnt;
    lastCategory = m.category;
    cursor += 1;
  });
  const mealsLastDataRow = cursor - 1;
  styleDataRows(sheet, mealsFirstDataRow, mealsLastDataRow, 3, [3]);
  addCountDataBar(sheet, `C${mealsFirstDataRow}:C${mealsLastDataRow}`);

  // re-bold the category column where it's not blank, so groups stand out
  for (let r = mealsFirstDataRow; r <= mealsLastDataRow; r++) {
    const cell = sheet.getCell(r, 1);
    if (cell.value) cell.font = { ...cell.font, bold: true, color: { argb: C.ink } };
  }
}

function styleHeaderRow2Col(sheet, rowNum) {
  for (const c of [1, 2]) {
    const cell = sheet.getCell(rowNum, c);
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: C.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.gold } };
    cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'center', indent: c === 1 ? 1 : 0 };
    cell.border = thinBorder();
  }
  sheet.getRow(rowNum).height = 20;
}

/** A small in-cell "bar chart": a gold data bar sized to each cell's value relative to the range. */
function addCountDataBar(sheet, ref) {
  sheet.addConditionalFormatting({
    ref,
    rules: [
      {
        type: 'dataBar',
        cfvo: [{ type: 'min' }, { type: 'max' }],
        color: { argb: C.gold },
        gradient: true,
        border: false,
        priority: 1,
      },
    ],
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
