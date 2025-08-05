import sqlite3
import os
import datetime

DATABASE = "showtracker.db"
DEBUG_MODE = True  # Toggle for debug output

def log_debug(message):
    if DEBUG_MODE:
        print(f"[DEBUG] {message}")

def create_tables():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    log_debug("Creating 'users' table...")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)

    log_debug("Creating 'media' table...")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS media (
        id TEXT PRIMARY KEY,
        username TEXT,
        type TEXT,
        title TEXT,
        year TEXT,
        overview TEXT,
        poster_path TEXT,
        status TEXT,
        watched_episodes INTEGER,
        total_episodes INTEGER,
        progress INTEGER,
        season INTEGER,
        episode INTEGER,
        added_date TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(username) REFERENCES users(username)
    )
    """)

    log_debug("Creating 'activities' table...")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        media_id TEXT,
        media_type TEXT,
        media_title TEXT,
        action TEXT,
        message TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(username) REFERENCES users(username)
    )
    """)

    conn.commit()
    conn.close()
    log_debug("All tables created successfully!")

if __name__ == "__main__":
    if not os.path.exists(DATABASE):
        log_debug("Database file not found. Creating new database...")
    else:
        log_debug("Database file exists. Updating tables if needed...")

    create_tables()
    print("✅ Database and tables are ready.")
