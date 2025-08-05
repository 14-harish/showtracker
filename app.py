from flask import Flask, request, jsonify, render_template, send_from_directory, session
import sqlite3
import os
import requests
import datetime
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv("SECRET_KEY")

DATABASE = "showtracker.db"
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
TMDB_API_KEY = os.getenv("TMDB_API_KEY")

DEBUG_MODE = True  # Toggle this to enable/disable debug prints

def log_debug(message, data=None):
    if DEBUG_MODE:
        print(f"[DEBUG] {message}")
        if data:
            print(data)

def init_db():
    if not os.path.exists(DATABASE):
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE users (
                username TEXT PRIMARY KEY,
                email TEXT UNIQUE,
                password TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE media (
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

        cursor.execute("""
            CREATE TABLE activities (
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
        log_debug("Database initialized")

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def search_tmdb(query, media_type="multi", year=None):
    url = f"https://api.themoviedb.org/3/search/{media_type}"
    params = {
        "api_key": TMDB_API_KEY,
        "query": query
    }
    if year:
        if media_type == "tv":
            params["first_air_date_year"] = year
        elif media_type == "movie":
            params["year"] = year
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    return resp.json().get('results', [])

@app.route("/")
def index():
    return render_template("showtrack.html")

@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory("static", filename)

@app.route("/register", methods=["POST"])
def register():
    data = request.json or {}
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    if not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", (username, email, password))
        conn.commit()
        return jsonify({"message": "Registration successful"}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username or Email already exists"}), 400
    finally:
        conn.close()

@app.route("/login", methods=["POST"])
def login():
    data = request.json or {}
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    conn.close()

    if user and user["password"] == password:
        session['username'] = username
        return jsonify({"message": "Login successful", "user": {"username": user["username"], "email": user["email"]}}), 200
    else:
        return jsonify({"error": "Invalid username or password"}), 401

@app.route("/media", methods=["POST"])
def add_media():
    data = request.json or {}
    log_debug("add_media called with:", data)

    required_fields = ["username", "id", "type", "title"]
    if not all(data.get(field) for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""INSERT INTO media 
                          (id, username, type, title, year, overview, poster_path, status, watched_episodes,
                           total_episodes, progress, season, episode) 
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                       (data["id"], data["username"], data["type"], data["title"], data.get("year"), data.get("overview"),
                        data.get("poster_path"), data.get("status", "to-watch"), data.get("watched_episodes", 0),
                        data.get("total_episodes", 0), data.get("progress", 0), data.get("season"), data.get("episode")))
        conn.commit()

        cursor.execute("""INSERT INTO activities (username, media_id, media_type, media_title, action, message) 
                          VALUES (?, ?, ?, ?, 'add', ?)""",
                       (data["username"], data["id"], data["type"], data["title"],
                        f"Added {data['type']} '{data['title']}' to watchlist"))
        conn.commit()

        log_debug("Media added successfully")
        return jsonify({"message": "Media added successfully"}), 201
    except sqlite3.IntegrityError as e:
        log_debug("Integrity error:", str(e))
        return jsonify({"error": "Media already exists"}), 400
    except Exception as e:
        log_debug("Database error:", str(e))
        return jsonify({"error": "Database insertion failed"}), 500
    finally:
        conn.close()

@app.route("/media/<username>", methods=["GET"])
def get_media(username):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM media WHERE username = ?", (username,))
    rows = cursor.fetchall()
    conn.close()
    media_list = [dict(row) for row in rows]
    log_debug(f"Fetched {len(media_list)} media items for {username}")
    return jsonify({"media": media_list}), 200

@app.route("/media/<media_id>", methods=["PUT"])
def update_media(media_id):
    data = request.json or {}
    log_debug("update_media called with:", data)

    fields = []
    params = []

    for field in ["status", "watched_episodes", "progress", "season", "episode"]:
        if field in data:
            fields.append(f"{field} = ?")
            params.append(data[field])

    if not fields:
        return jsonify({"error": "No updates provided"}), 400

    params.append(media_id)
    query = f"UPDATE media SET {', '.join(fields)} WHERE id = ?"

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(query, params)
        if cursor.rowcount == 0:
            return jsonify({"error": "Media not found"}), 404
        conn.commit()

        cursor.execute("""INSERT INTO activities (username, media_id, media_type, media_title, action, message) 
                          VALUES (?, ?, ?, ?, 'update', ?)""",
                       (data.get("username"), media_id, data.get("type"), data.get("title"),
                        f"Updated {data.get('type')} '{data.get('title')}'"))
        conn.commit()

        log_debug("Media updated successfully")
        return jsonify({"message": "Media updated successfully"}), 200
    except Exception as e:
        log_debug("Database update error:", str(e))
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route("/media/<media_id>", methods=["DELETE"])
def delete_media(media_id):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM media WHERE id = ?", (media_id,))
        if cursor.rowcount == 0:
            return jsonify({"error": "Media not found"}), 404
        conn.commit()
        log_debug(f"Media {media_id} deleted")
        return jsonify({"message": "Media deleted"}), 200
    except Exception as e:
        log_debug("Database delete error:", str(e))
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route("/activities/<username>", methods=["GET"])
def get_activities(username):
    limit = request.args.get("limit", 5, type=int)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM activities WHERE username=? ORDER BY timestamp DESC LIMIT ?", (username, limit))
    rows = cursor.fetchall()
    conn.close()
    activities = [dict(row) for row in rows]
    log_debug(f"Fetched {len(activities)} activities for {username}")
    return jsonify({"activities": activities}), 200

@app.route("/search", methods=["GET"])
def search():
    query = request.args.get("query")
    year = request.args.get("year")
    media_type = request.args.get("type", "multi")

    if not query:
        return jsonify({"error": "Query parameter is required"}), 400

    try:
        results = search_tmdb(query, media_type, year)
        log_debug(f"Search returned {len(results)} results for query '{query}'")
        return jsonify({"results": results}), 200
    except Exception as e:
        log_debug("TMDB search error:", str(e))
        return jsonify({"error": str(e)}), 500

@app.route("/verify-image", methods=["POST"])
def verify_image():
    data = request.json or {}
    title = data.get("title")
    image_url = data.get("image_url")

    # Placeholder logic for image verification
    # You can integrate AI or external service here
    log_debug("Image verification requested", data)

    # For now, always return True
    return jsonify({"is_match": True}), 200

if __name__ == "__main__":
    init_db()
    app.run(debug=True)
