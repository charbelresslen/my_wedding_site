// The small local API between the RSVP form and the MySQL database. It only ever does two things: hand the guest
// form its menu (GET /api/menu) and save one guest's answer (POST /api/rsvp). See README.md to run it, and
// schema.sql for the tables it reads and writes.
'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
// localhost, or any private-network address (192.168.x.x, 10.x.x.x, 172.16-31.x.x) - covers a phone testing over the
// same Wi-Fi without needing its ever-changing address added to ALLOWED_ORIGINS by hand. Only outside production:
// once this is deployed for real, a guest's phone is never "on the private network" this server runs on, so this
// path never matches for them - only the real domain in ALLOWED_ORIGINS does.
const PRIVATE_HOST = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'wedding_rsvp',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'wedding_rsvp',
  waitForConnections: true,
  connectionLimit: 5,
  dateStrings: true,
});

const app = express();
app.use(express.json());
app.use(
  cors({
    origin(origin, callback) {
      // same-origin tools (curl, server-side calls) send no Origin header at all - allow those; a browser always sends one
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      try {
        const { hostname } = new URL(origin);
        if (process.env.NODE_ENV !== 'production' && PRIVATE_HOST.test(hostname)) return callback(null, true);
      } catch {
        /* an unparseable Origin header falls through to the rejection below */
      }
      // Logged so a deployment where the site loads but the API rejects it (see DEPLOY-WINDOWS.md /
      // DEPLOY.md) shows exactly which origin string is missing from ALLOWED_ORIGINS, instead of a
      // silent rejection with no clue what to add.
      console.warn(`CORS: rejected origin "${origin}" — add it to ALLOWED_ORIGINS in server/.env if this should be allowed`);
      callback(new Error('Not allowed by CORS'));
    },
  }),
);

// Turns a rejected CORS origin into a real JSON response (403) instead of Express's default HTML error page, so it
// is distinguishable client-side from a network-unreachable failure (no response at all) or a database error (500).
app.use((err, _req, res, next) => {
  if (err && err.message === 'Not allowed by CORS') return res.status(403).json({ error: 'CORS_NOT_ALLOWED' });
  next(err);
});

/** The menu, straight from the database, in the order it should be shown (edit the tables, not this file, to change it). */
async function loadMenu() {
  const [drinkRows] = await pool.query('SELECT id, name_ru AS name FROM drink_options ORDER BY sort_order');
  const [categoryRows] = await pool.query('SELECT id, name_ru AS name FROM food_categories ORDER BY sort_order');
  const [itemRows] = await pool.query('SELECT id, category_id, name_ru AS name FROM food_items ORDER BY category_id, sort_order');
  const foodCategories = categoryRows.map((category) => ({
    ...category,
    items: itemRows.filter((item) => item.category_id === category.id).map(({ id, name }) => ({ id, name })),
  }));
  return { drinkOptions: drinkRows, foodCategories };
}

app.get('/api/menu', async (_req, res) => {
  try {
    res.json(await loadMenu());
  } catch (err) {
    console.error('GET /api/menu', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

app.post('/api/rsvp', async (req, res) => {
  const body = req.body || {};
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const attendance = body.attendance;

  if (!fullName) return res.status(400).json({ error: 'MISSING_NAME' });
  if (fullName.length > 150) return res.status(400).json({ error: 'NAME_TOO_LONG' });
  if (attendance !== 'both' && attendance !== 'zags_only') return res.status(400).json({ error: 'INVALID_ATTENDANCE' });

  let drinkOptionId = null;
  let foodChoices = null; // Map<categoryId, itemId>

  if (attendance === 'both') {
    drinkOptionId = Number(body.drinkOptionId);
    if (!Number.isInteger(drinkOptionId)) return res.status(400).json({ error: 'MISSING_DRINK' });

    const menu = await loadMenu();
    if (!menu.drinkOptions.some((d) => d.id === drinkOptionId)) return res.status(400).json({ error: 'INVALID_DRINK' });

    const submitted = body.foodChoices && typeof body.foodChoices === 'object' ? body.foodChoices : {};
    foodChoices = new Map();
    for (const category of menu.foodCategories) {
      const itemId = Number(submitted[category.id]);
      if (!category.items.some((item) => item.id === itemId)) {
        return res.status(400).json({ error: 'MISSING_FOOD_CHOICE', category: category.id });
      }
      foodChoices.set(category.id, itemId);
    }
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute('INSERT INTO rsvp (full_name, attendance) VALUES (?, ?)', [fullName, attendance]);
    const rsvpId = result.insertId;

    if (attendance === 'both') {
      await connection.execute('INSERT INTO rsvp_drink_choice (rsvp_id, drink_option_id) VALUES (?, ?)', [rsvpId, drinkOptionId]);
      for (const [categoryId, itemId] of foodChoices) {
        await connection.execute('INSERT INTO rsvp_food_choice (rsvp_id, category_id, food_item_id) VALUES (?, ?, ?)', [rsvpId, categoryId, itemId]);
      }
    }

    await connection.commit();
    res.status(201).json({ id: rsvpId });
  } catch (err) {
    await connection.rollback();
    console.error('POST /api/rsvp', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  } finally {
    connection.release();
  }
});

app.listen(PORT, () => {
  console.log(`RSVP API listening on http://localhost:${PORT}`);
});
