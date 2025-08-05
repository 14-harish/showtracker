# ShowTracker

**ShowTracker** is a Flask-based web app that helps users track TV shows and movies — with progress tracking, search, and watchlist management.

---

## Features

-  User registration and login
-  Search TV shows & movies via TMDb API
-  Add to personal watchlist
-  Track season/episode/movie progress
-  Status: Plan to Watch / Watching / Completed / Dropped
-  Activity log (recently updated)
-  Frontend image verification before adding media

---

## Tech Stack

- Python (Flask)
- SQLite
- JavaScript, HTML, CSS
- TMDb API
- (Optional) Groq API (for image verification)

---

## Getting Started

### Prerequisites
- Python 3.6+
- TMDb API key
- (Optional) Groq API key for image verification

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/14-harish/showtracker.git
cd showtracker

# 2. Create a virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create the database
python create_db.py

# 5. Set your environment variables (e.g. in .env)
export TMDB_API_KEY=your_key_here
export GROQ_API_KEY=your_key_here

# 6. Run the app
python app.py

project structure
showtracker/
│
├── app.py
├── create_db.py
├── requirements.txt
├── .gitignore
│
├── static/
│   ├── CSS/showtrack.css
│   ├── JS/showtrack.js
│   └── images/
│
├── templates/
│   └── showtrack.html
│
└── showtracker.db (ignored in repo)
