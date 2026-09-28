// Shared database access for the export scripts (export-rsvp.js, export-rsvp-pdf.js): one place that knows the
// schema (see schema.sql) so both exports always agree on what "the guest list" means.
'use strict';

const mysql = require('mysql2/promise');

const ATTENDANCE_LABEL = { both: 'Церемония и банкет', zags_only: 'Только ЗАГС' };

function createPool() {
  return mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'wedding_rsvp',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wedding_rsvp',
  });
}

async function fetchRsvpData(pool) {
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

  // one row per banquet guest, food choices pivoted into { categoryId: itemName }
  const byGuest = new Map();
  for (const row of foodChoiceRows) {
    let entry = byGuest.get(row.rsvp_id);
    if (!entry) {
      entry = { full_name: row.full_name, created_at: row.created_at, choices: new Map() };
      byGuest.set(row.rsvp_id, entry);
    }
    entry.choices.set(row.category_id, row.item_name);
  }
  const mealsByGuest = [...byGuest.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const byAttendance = Object.fromEntries(attendanceCounts.map((r) => [r.attendance, r.cnt]));

  return { guests, drinkRows, categories, mealsByGuest, attendanceCounts, byAttendance, drinkCounts, mealCounts };
}

function formatDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}.${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

module.exports = { createPool, fetchRsvpData, formatDate, ATTENDANCE_LABEL };
