const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'jobtrack.db'));

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    company     TEXT NOT NULL,
    location    TEXT,
    salary      TEXT,
    url         TEXT UNIQUE,
    description TEXT,
    tags        TEXT,          -- JSON array as string
    source      TEXT,          -- linkedin, indeed, bumeran, etc.
    posted_at   TEXT,
    scraped_at  TEXT DEFAULT (datetime('now')),
    status      TEXT DEFAULT 'new',  -- new, saved, applied, interview, offer, rejected
    match_score INTEGER,             -- 0-100, set by AI
    ai_analysis TEXT,                -- full AI analysis JSON
    notes       TEXT,
    next_action TEXT,
    next_action_date TEXT,
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS profile (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    name        TEXT,
    skills      TEXT,   -- JSON array
    experience_years INTEGER,
    desired_role TEXT,
    desired_salary_min INTEGER,
    desired_salary_max INTEGER,
    preferred_locations TEXT,  -- JSON array
    keywords    TEXT,          -- JSON array for searches
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scrape_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source      TEXT,
    keyword     TEXT,
    found       INTEGER,
    new_jobs    INTEGER,
    ran_at      TEXT DEFAULT (datetime('now')),
    error       TEXT
  );

  -- Insert default profile if none exists
  INSERT OR IGNORE INTO profile (id, name, skills, experience_years, desired_role, keywords, preferred_locations)
  VALUES (1, 'Mi Perfil', '["React","TypeScript","JavaScript","CSS"]', 3,
          'Frontend Developer', '["frontend developer","react developer","ui engineer"]',
          '["Argentina","Remote","Remoto"]');
`);

// Prepared statements
const stmts = {
  insertJob: db.prepare(`
    INSERT OR IGNORE INTO jobs (title, company, location, salary, url, description, tags, source, posted_at)
    VALUES (@title, @company, @location, @salary, @url, @description, @tags, @source, @posted_at)
  `),
  updateJobStatus: db.prepare(`
    UPDATE jobs SET status = @status, updated_at = datetime('now') WHERE id = @id
  `),
  updateJobAnalysis: db.prepare(`
    UPDATE jobs SET match_score = @match_score, ai_analysis = @ai_analysis, updated_at = datetime('now') WHERE id = @id
  `),
  updateJobNotes: db.prepare(`
    UPDATE jobs SET notes = @notes, next_action = @next_action, next_action_date = @next_action_date, updated_at = datetime('now') WHERE id = @id
  `),
  getProfile: db.prepare(`SELECT * FROM profile WHERE id = 1`),
  updateProfile: db.prepare(`
    UPDATE profile SET name=@name, skills=@skills, experience_years=@experience_years,
    desired_role=@desired_role, desired_salary_min=@desired_salary_min,
    desired_salary_max=@desired_salary_max, preferred_locations=@preferred_locations,
    keywords=@keywords, updated_at=datetime('now') WHERE id=1
  `),
  logScrape: db.prepare(`
    INSERT INTO scrape_log (source, keyword, found, new_jobs, error) VALUES (@source, @keyword, @found, @new_jobs, @error)
  `),
};

module.exports = { db, stmts };
