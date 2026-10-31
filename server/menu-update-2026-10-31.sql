-- The final menu, agreed with the restaurant on 2026-10-31: every banquet guest chooses ONE dish from each of three
-- categories - Салаты, Горячие закуски, Горячее. It replaces the first menu (Аперитив, Холодные закуски, Хлеб and three
-- other salads, taken from "Примерное меню 30 ч.pdf").
--
-- schema.sql already seeds this menu for a brand-new database. Run THIS file once on a database that was created
-- before that date, to turn its old menu into the new one: in MySQL Workbench open it, pick the connection to the
-- wedding_rsvp database, Execute. It is safe to run again: the second time nothing changes.
--
-- What it removes: the categories and dishes that are no longer offered and - because a saved answer cannot point at
-- a dish that is gone - every guest's answer to those dishes. The guest's name, attendance and drink stay. Anyone who
-- answered before today has to answer again for the new categories (an answer to the Greek salad is kept: it is still
-- on the menu, now spelled "Салат Греческий").

USE wedding_rsvp;

START TRANSACTION;

INSERT INTO food_categories (id, name_ru, sort_order) VALUES
  (4, 'Салаты',           1),
  (5, 'Горячие закуски',  2),
  (6, 'Горячее',          3)
ON DUPLICATE KEY UPDATE name_ru = VALUES(name_ru), sort_order = VALUES(sort_order);

INSERT INTO food_items (id, category_id, name_ru, sort_order) VALUES
  -- Салаты
  (404, 4, 'Цезарь с креветками',                                                   1),
  (405, 4, 'Оливье с говядиной, перепелиным яйцом и красной икрой',                 2),
  (406, 4, 'Салат с индейкой гриль, апельсинами и авокадо в цитрусовой заправке',   3),
  (403, 4, 'Салат Греческий',                                                       4),
  -- Горячие закуски
  (501, 5, 'Драники из цукини с томатной сальсой и сметанным соусом',                1),
  (502, 5, 'Жюльен из куриной грудки',                                              2),
  -- Горячее
  (601, 6, 'Медальоны из говядины с поджаркой из белых грибов и молодого картофеля с соусом порто', 1),
  (602, 6, 'Куриная грудка в соусе терияки с миндалем и зелёными овощами',          2),
  (603, 6, 'Стейк лосося с овощами гриль в цитрусовом соусе',                       3)
ON DUPLICATE KEY UPDATE name_ru = VALUES(name_ru), category_id = VALUES(category_id), sort_order = VALUES(sort_order);

-- what is no longer on the menu: first the guests' answers that point at it, then the dishes, then the categories
DELETE FROM rsvp_food_choice
WHERE rsvp_id > 0
  AND (category_id NOT IN (4, 5, 6) OR food_item_id NOT IN (403, 404, 405, 406, 501, 502, 601, 602, 603));

DELETE FROM food_items
WHERE id > 0 AND id NOT IN (403, 404, 405, 406, 501, 502, 601, 602, 603);

DELETE FROM food_categories
WHERE id > 0 AND id NOT IN (4, 5, 6);

COMMIT;
