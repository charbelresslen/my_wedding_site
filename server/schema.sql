-- The RSVP database: who is coming, whether they come only to the ZAGS ceremony or stay for the banquet too, their one
-- drink preference and, for the banquet, one dish chosen from each menu category (menu content: "Примерное меню 30 ч.pdf").
--
-- Run this once, as an account that can create databases and users (for example root), before the API server (in this
-- same folder) is started for the first time:
--
--   "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p < schema.sql
--
-- It is safe to run again later (CREATE ... IF NOT EXISTS everywhere); it never deletes an existing rsvp.
-- It creates a dedicated, low-privilege user for the API server to use day to day, instead of using root — before
-- running this, replace CHANGE_ME_DB_PASSWORD below with a password of your own (any random string), then copy the
-- same value into server/.env (see .env.example) as DB_PASSWORD.

CREATE DATABASE IF NOT EXISTS wedding_rsvp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'wedding_rsvp'@'localhost' IDENTIFIED BY 'CHANGE_ME_DB_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON wedding_rsvp.* TO 'wedding_rsvp'@'localhost';
FLUSH PRIVILEGES;

USE wedding_rsvp;

-- ============================================================================================= the menu (read by the guest form; edit these rows to change what guests see, no code changes needed)

CREATE TABLE IF NOT EXISTS drink_options (
  id         TINYINT UNSIGNED PRIMARY KEY,
  name_ru    VARCHAR(100) NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL
) ENGINE=InnoDB;

INSERT INTO drink_options (id, name_ru, sort_order) VALUES
  (1,  'Сухое шампанское',        1),
  (2,  'Полусухое шампанское',    2),
  (3,  'Сладкое шампанское',      3),
  (4,  'Полусладкое шампанское',  4),
  (5,  'Сухое белое вино',        5),
  (6,  'Полусухое белое вино',    6),
  (7,  'Полусладкое белое вино',  7),
  (8,  'Сухое красное вино',      8),
  (9,  'Полусухое красное вино',  9),
  (10, 'Полусладкое красное вино', 10),
  (11, 'Водка',                   11),
  (12, 'Коньяк',                  12),
  (13, 'Я не пью алкоголь',       13)
ON DUPLICATE KEY UPDATE name_ru = VALUES(name_ru), sort_order = VALUES(sort_order);

CREATE TABLE IF NOT EXISTS food_categories (
  id         TINYINT UNSIGNED PRIMARY KEY,
  name_ru    VARCHAR(100) NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL
) ENGINE=InnoDB;

INSERT INTO food_categories (id, name_ru, sort_order) VALUES
  (1, 'Аперитив',          1),
  (2, 'Холодные закуски',  2),
  (3, 'Хлеб',              3),
  (4, 'Салаты',            4)
ON DUPLICATE KEY UPDATE name_ru = VALUES(name_ru), sort_order = VALUES(sort_order);

CREATE TABLE IF NOT EXISTS food_items (
  id          SMALLINT UNSIGNED PRIMARY KEY,
  category_id TINYINT UNSIGNED NOT NULL,
  name_ru     VARCHAR(200) NOT NULL,
  sort_order  TINYINT UNSIGNED NOT NULL,
  FOREIGN KEY (category_id) REFERENCES food_categories(id)
) ENGINE=InnoDB;

INSERT INTO food_items (id, category_id, name_ru, sort_order) VALUES
  -- Аперитив
  (101, 1, 'Креветка со свежим огурцом',                 1),
  (102, 1, 'Блинное канапе с сёмгой и маслинами',         2),
  (103, 1, 'Ростбиф с корнишонами и жемчужным луком',     3),
  (104, 1, 'Виноград с сыром',                            4),
  -- Холодные закуски
  (201, 2, 'Лосось слабосолёный с лимоном и маслинами',   1),
  (202, 2, 'Филе слабосолёной сельди с молодым картофелем', 2),
  (203, 2, 'Мясная тарелка',                              3),
  (204, 2, 'Ассорти фермерских сыров',                    4),
  (205, 2, 'Блинные рулетики с лососем и сливочным сыром', 5),
  (206, 2, 'Ветчинные рулетики с сыром',                  6),
  (207, 2, 'Рулетики из баклажанов с сыром и грецкими орехами', 7),
  (208, 2, 'Профитроли с куриным паштетом',               8),
  -- Хлеб
  (301, 3, 'Ржаная булочка',                              1),
  (302, 3, 'Пшеничная булочка',                           2),
  -- Салаты
  (401, 4, 'Салат с ростбифом и печёным перцем',          1),
  (402, 4, '«Мужской каприз»',                            2),
  (403, 4, 'Греческий салат',                             3)
ON DUPLICATE KEY UPDATE name_ru = VALUES(name_ru), category_id = VALUES(category_id), sort_order = VALUES(sort_order);

-- ============================================================================================= the RSVPs guests submit

CREATE TABLE IF NOT EXISTS rsvp (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name  VARCHAR(150) NOT NULL,
  -- 'both' = ceremony and banquet, 'zags_only' = the ZAGS ceremony only (no drink or food choice is stored for these)
  attendance ENUM('both', 'zags_only') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- exactly one drink per rsvp (the primary key is rsvp_id alone, not a composite)
CREATE TABLE IF NOT EXISTS rsvp_drink_choice (
  rsvp_id         INT UNSIGNED NOT NULL PRIMARY KEY,
  drink_option_id TINYINT UNSIGNED NOT NULL,
  FOREIGN KEY (rsvp_id) REFERENCES rsvp(id) ON DELETE CASCADE,
  FOREIGN KEY (drink_option_id) REFERENCES drink_options(id)
) ENGINE=InnoDB;

-- exactly one dish per category per rsvp (the primary key covers both columns)
CREATE TABLE IF NOT EXISTS rsvp_food_choice (
  rsvp_id      INT UNSIGNED NOT NULL,
  category_id  TINYINT UNSIGNED NOT NULL,
  food_item_id SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (rsvp_id, category_id),
  FOREIGN KEY (rsvp_id) REFERENCES rsvp(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES food_categories(id),
  FOREIGN KEY (food_item_id) REFERENCES food_items(id)
) ENGINE=InnoDB;

-- a convenient single view for looking at the guest list (e.g. in MySQL Workbench): one row per rsvp, the drink name
-- and every chosen dish concatenated, so nobody has to hand-join five tables to see who is coming and what they picked
CREATE OR REPLACE VIEW rsvp_overview AS
SELECT
  r.id,
  r.full_name,
  CASE r.attendance WHEN 'both' THEN 'Церемония и банкет' ELSE 'Только церемония в ЗАГСе' END AS attendance,
  d.name_ru AS drink,
  (
    SELECT GROUP_CONCAT(CONCAT(fc.name_ru, ': ', fi.name_ru) ORDER BY fc.sort_order SEPARATOR '; ')
    FROM rsvp_food_choice rfc
    JOIN food_categories fc ON fc.id = rfc.category_id
    JOIN food_items fi ON fi.id = rfc.food_item_id
    WHERE rfc.rsvp_id = r.id
  ) AS dishes,
  r.created_at
FROM rsvp r
LEFT JOIN rsvp_drink_choice rdc ON rdc.rsvp_id = r.id
LEFT JOIN drink_options d ON d.id = rdc.drink_option_id
ORDER BY r.created_at;
