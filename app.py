import base64
import csv
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from werkzeug.wrappers import Request
from google import genai
import psycopg

# Increase maximum form memory buffer to 64MB
Request.max_form_memory_size = 64 * 1024 * 1024

try:
    from elevenlabs.client import ElevenLabs
except ImportError:
    ElevenLabs = None

# Load environment variables from .env
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
TIGER_DATA_URL = os.getenv("TIGER_DATA_URL") or os.getenv("DATABASE_URL")
DEFAULT_ELEVENLABS_VOICE_ID = "ktHrlQPfUoEUQDP8xbm1"
SECTION_1_ELEVENLABS_VOICE_ID = "ktHrlQPfUoEUQDP8xbm1"

DATA_DIR = Path(__file__).resolve().parent / "hackumbc-2026-main" / "data"
STUDENTS_CURRENT_CSV = DATA_DIR / "students_current.csv"
ALUMNI_CSV = DATA_DIR / "alumni.csv"
COURSE_CATALOG_CSV = DATA_DIR / "course_catalog.csv"
EMPLOYMENT_HISTORY_CSV = DATA_DIR / "employment_history.csv"
STUDENT_EXPERIENCE_CSV = DATA_DIR / "student_experience.csv"
TRANSCRIPTS_CSV = DATA_DIR / "transcripts.csv"

# Initialize Google GenAI Client
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# Initialize ElevenLabs Client
elevenlabs_client = (
    ElevenLabs(api_key=ELEVENLABS_API_KEY) if ElevenLabs and ELEVENLABS_API_KEY else None
)

app = Flask(__name__)
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024 * 1024

SUBMISSIONS_STORE = {}

USERS_TABLE_DDL = """
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    role TEXT NOT NULL,
    name TEXT,
    college_year TEXT,
    major TEXT,
    major_track TEXT,
    gpa TEXT,
    other_school_info TEXT,
    target_salary TEXT,
    target_company_industry TEXT,
    target_location TEXT,
    career_goals TEXT,
    expected_grad_year TEXT,
    coursework_current TEXT,
    coursework_planned TEXT,
    coursework_past TEXT,
    campus_involvement TEXT,
    professional_experience TEXT,
    advisor_notes TEXT
);
"""


def get_db_connection():
    """Return a psycopg connection to Tiger Data (PostgreSQL)."""
    if not TIGER_DATA_URL:
        raise RuntimeError("TIGER_DATA_URL / DATABASE_URL is not configured in .env")
    return psycopg.connect(TIGER_DATA_URL)


@app.after_request
def add_no_cache_headers(response):
    """Prevent browser caching of static JS/CSS during active development."""
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@app.route("/", methods=["GET"])
def index():
    """Entrypoint: Section 1 (Academic Foundations)."""
    return render_template("section1.html")


@app.route("/section/1", methods=["GET"])
@app.route("/section/1/intro", methods=["GET"])
def section1():
    """Section 1: Academic Foundations Advisor Intro & Questions."""
    return render_template("section1.html")


@app.route("/loading", methods=["GET"])
def loading():
    """Dedicated Asynchronous Loading Screen."""
    next_sec = request.args.get("next", "2")
    return render_template("loading.html", next_sec=next_sec)


@app.route("/section/2", methods=["GET"])
@app.route("/section/2/intro", methods=["GET"])
def section2():
    """Section 2: Course Advising Specialist Intro & Checklist."""
    return render_template("section2.html")


@app.route("/section/3", methods=["GET"])
@app.route("/section/3/intro", methods=["GET"])
def section3():
    """Section 3: Student Engagement Mentor Intro & Co-Curriculars."""
    return render_template("section3.html")


@app.route("/section/4", methods=["GET"])
@app.route("/section/4/intro", methods=["GET"])
def section4():
    """Section 4: Career & Industry Strategist Intro & Tech Stacks."""
    return render_template("section4.html")


@app.route("/section/5", methods=["GET"])
@app.route("/section/5/intro", methods=["GET"])
def section5():
    """Section 5: Council Synthesis Intro & Comprehensive Final Report."""
    return render_template("section5.html")



@app.route("/api/academic-options", methods=["GET"])
def get_academic_options():
    """
    Query the existing students_current table in Tiger Data (PostgreSQL)
    to return unique available Majors, Major Tracks, and Minors.
    """
    majors_set = set()
    tracks_set = set()
    minors_set = set()
    tracks_by_major = {}

    queried_db = False
    if TIGER_DATA_URL:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT DISTINCT major, track, minor
                        FROM students_current
                        WHERE major IS NOT NULL
                          AND major <> ''
                          AND major <> 'Not Applicable'
                        ORDER BY major, track, minor;
                        """
                    )
                    for major_val, track_val, minor_val in cur.fetchall():
                        major_clean = (major_val or "").strip()
                        track_clean = (track_val or "").strip()
                        minor_clean = (minor_val or "").strip()
                        if major_clean:
                            majors_set.add(major_clean)
                            tracks_by_major.setdefault(major_clean, set())
                            if track_clean and track_clean != "Not Applicable":
                                tracks_set.add(track_clean)
                                tracks_by_major[major_clean].add(track_clean)
                        if minor_clean and minor_clean != "Not Applicable":
                            minors_set.add(minor_clean)
                    queried_db = True
        except Exception as exc:
            print(f"Warning: Database query to students_current failed, falling back to CSV: {exc}")

    if not queried_db and STUDENTS_CURRENT_CSV.exists():
        try:
            with STUDENTS_CURRENT_CSV.open("r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    major_clean = (row.get("major") or "").strip()
                    track_clean = (row.get("track") or "").strip()
                    minor_clean = (row.get("minor") or "").strip()
                    if major_clean and major_clean != "Not Applicable":
                        majors_set.add(major_clean)
                        tracks_by_major.setdefault(major_clean, set())
                        if track_clean and track_clean != "Not Applicable":
                            tracks_set.add(track_clean)
                            tracks_by_major[major_clean].add(track_clean)
                    if minor_clean and minor_clean != "Not Applicable":
                        minors_set.add(minor_clean)
        except Exception as exc:
            print(f"Warning: CSV read failed for academic options: {exc}")

    if not majors_set:
        majors_set = {"Computer Science", "Data Science", "Information Systems", "Cybersecurity", "Computer Engineering"}
    if not tracks_set:
        tracks_set = {"Artificial Intelligence and Machine Learning", "Cybersecurity", "Data Science", "General", "Software Engineering"}
    if not minors_set:
        minors_set = {"Business Administration", "Cybersecurity", "Data Science", "Economics", "Mathematics", "Statistics"}

    return jsonify({
        "source": "tiger_data_postgres" if queried_db else "dataset_fallback",
        "majors": sorted(majors_set),
        "tracks": sorted(tracks_set),
        "minors": sorted(minors_set),
        "tracks_by_major": {m: sorted(t_set) for m, t_set in sorted(tracks_by_major.items())},
    }), 200


def _load_course_catalog() -> dict:
    """Load and index course catalog from CSV or database."""
    catalog = {}
    if COURSE_CATALOG_CSV.exists():
        try:
            with COURSE_CATALOG_CSV.open("r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    cid = (row.get("course_id") or "").strip()
                    if cid:
                        catalog[cid] = row
        except Exception as exc:
            print(f"Warning: Failed to read course_catalog.csv: {exc}")
    return catalog


@app.route("/api/course-options", methods=["GET", "POST"])
def get_course_options():
    """
    Dynamically return:
    1. required_courses: Major-specific required courses filtered by credit tier (max 6-8).
    2. popular_electives: Electives filtered by popularity among alumni/students sharing Major, Minor, Track, and Career Path (max 6-8).
    3. dynamic_phrasing: Heading text based on credits:
       - <= 30 credits: "Do any of these electives interest you?"
       - > 30 credits: "Which of these electives have you taken?"
    4. all_catalog_courses: Full catalog for planned course selection.
    """
    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
    else:
        payload = request.args

    major = (payload.get("major") or "Computer Science").strip()
    minor = (payload.get("minor") or "").strip()
    major_track = (payload.get("majorTrack") or payload.get("track") or "").strip()
    target_ind = (payload.get("targetCompanyIndustry") or payload.get("industry") or "").strip()
    career_goals = (payload.get("careerGoals") or payload.get("goals") or "").strip()

    try:
        credits_completed = float(payload.get("creditsCompleted") or payload.get("credits") or payload.get("credits_completed") or 15)
    except (ValueError, TypeError):
        credits_completed = 15.0

    catalog_dict = _load_course_catalog()

    # 1. Filter out general education subjects and ensure strictly related to major discipline
    GEN_ED_EXCLUDE = {"ENGL", "HIST", "PHIL", "ARTH", "MUSC", "PSYC", "SOCY", "SPAN", "CHEM", "BIOL"}

    discipline_subject_map = {
        "Computer Science": {"CMSC"},
        "Information Systems": {"IS", "MGMT", "ACCT", "ECON"},
        "Data Science": {"DATA", "CMSC", "STAT"},
        "Cybersecurity": {"CMSC", "IS"},
        "Computer Engineering": {"CMPE", "CMSC"},
    }
    allowed_major_subjects = discipline_subject_map.get(major, {"CMSC"})

    required_courses = []
    electives_pool = []
    all_catalog = []

    for cid, c in catalog_dict.items():
        ctitle = c.get("course_title") or cid
        ctype = c.get("course_type") or "Core"
        req_majors = [m.strip() for m in (c.get("required_for_majors") or "").split("|") if m]
        c_subj = c.get("subject") or cid[:4]

        # Extract numeric catalog level
        try:
            course_num = int("".join(filter(str.isdigit, str(c.get("catalog_number") or cid))))
        except ValueError:
            course_num = 200

        item = {
            "course_id": cid,
            "subject": c_subj,
            "catalog_number": c.get("catalog_number", str(course_num)),
            "course_num": course_num,
            "course_title": ctitle,
            "credits": int(c.get("credits", 3) or 3),
            "course_level": c.get("course_level", "Upper"),
            "course_type": ctype,
            "skill_tags": (c.get("skill_tags") or "").replace("|", ", "),
            "difficulty_index": float(c.get("difficulty_index", 3.0) or 3.0),
        }
        all_catalog.append(item)

        # Exclude gen-eds from major requirements
        if c_subj in GEN_ED_EXCLUDE:
            continue

        # Check if strictly related to major discipline
        is_major_discipline = (c_subj in allowed_major_subjects) or (major in req_majors)

        if is_major_discipline and (ctype in ("Core", "Capstone") or major in req_majors):
            # Credit-based Tier Filtering:
            # - credits < 30: Show only lower-level (100/200 level)
            # - credits >= 30 and credits <= 80: Show mid-to-high level (200/300/400 level)
            # - credits > 80: Show only high-level (300/400 level)
            if credits_completed < 30:
                if course_num < 300:
                    required_courses.append(item)
            elif credits_completed <= 80:
                if 200 <= course_num <= 499:
                    required_courses.append(item)
            else:  # credits > 80
                if course_num >= 300:
                    required_courses.append(item)
        elif ctype in ("Elective", "Specialized", "Upper") and is_major_discipline:
            electives_pool.append(item)

    # Sort required courses by catalog number
    required_courses.sort(key=lambda x: (0 if x["course_level"] == "Lower" else 1, x["course_num"], x["course_id"]))
    # Limit to 6-8 required courses
    required_courses = required_courses[:8]

    # 2. Electives Popularity Query (Major, Minor, Track, Career Path)
    top_alumni_cids = set()
    if ALUMNI_CSV.exists():
        try:
            with ALUMNI_CSV.open("r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    row_maj = row.get("major", "")
                    if row_maj == major or not row_maj:
                        top_alumni_cids.add(row.get("campus_id"))
        except Exception as exc:
            print(f"Warning: Failed reading alumni.csv for electives: {exc}")

    elective_counts = {}
    if TRANSCRIPTS_CSV.exists() and top_alumni_cids:
        try:
            with TRANSCRIPTS_CSV.open("r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row.get("campus_id") in top_alumni_cids:
                        cid = row.get("course_id")
                        if cid:
                            elective_counts[cid] = elective_counts.get(cid, 0) + 1
        except Exception as exc:
            print(f"Warning: Failed reading transcripts.csv for electives: {exc}")

    max_count = max(elective_counts.values()) if elective_counts else 100
    ranked_electives = []
    combined_keywords = f"{target_ind} {career_goals} {major_track} {minor}".lower()

    for e in electives_pool:
        cid = e["course_id"]
        cnt = elective_counts.get(cid, 0)
        boost = 0

        # Career / Industry alignment boost
        if any(k in combined_keywords for k in ["ai", "data", "ml", "machine"]) and any(k in e["skill_tags"].lower() for k in ["ai", "data", "python", "mining", "learning", "statistics"]):
            boost += 50
        if any(k in combined_keywords for k in ["security", "cyber", "defense", "clearance"]) and any(k in e["skill_tags"].lower() for k in ["security", "crypto", "network", "linux"]):
            boost += 50
        if any(k in combined_keywords for k in ["web", "software", "cloud", "fullstack", "dev"]) and any(k in e["skill_tags"].lower() for k in ["web", "cloud", "software", "testing", "design", "sql"]):
            boost += 50

        # Track / Minor alignment boost
        if major_track and major_track != "Not Applicable" and major_track.lower() in e["skill_tags"].lower():
            boost += 40
        if minor and minor != "Not Applicable" and minor.lower() in (e["subject"].lower() + " " + e["course_title"].lower() + " " + e["skill_tags"].lower()):
            boost += 30

        e_copy = dict(e)
        e_copy["alumni_count"] = cnt
        e_copy["score"] = cnt + boost
        e_copy["popularity_pct"] = f"{min(98, max(42, int((cnt / max(1, max_count)) * 100)))}%"
        ranked_electives.append(e_copy)

    ranked_electives.sort(key=lambda x: x["score"], reverse=True)
    all_catalog.sort(key=lambda x: x["course_id"])

    # Dynamic phrasing based on credits
    dynamic_phrasing = "Do any of these electives interest you?" if credits_completed <= 30 else "Which of these electives have you taken?"

    return jsonify({
        "major": major,
        "credits_completed": credits_completed,
        "dynamic_phrasing": dynamic_phrasing,
        "required_courses": required_courses,
        "popular_electives": ranked_electives[:8],
        "all_catalog_courses": all_catalog,
    }), 200


@app.route("/api/search-classes", methods=["GET"])
def search_classes():
    """
    Live autocomplete search endpoint for course catalog.
    Queries PostgreSQL using ILIKE across course_id, course_title, and subject.
    """
    query = (request.args.get("q") or "").strip()
    if not query:
        return jsonify({"results": []}), 200

    search_pattern = f"%{query}%"
    results = []

    if TIGER_DATA_URL:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT course_id, course_title, subject, catalog_number, credits, course_level, course_type, skill_tags
                        FROM course_catalog
                        WHERE course_id ILIKE %s
                           OR course_title ILIKE %s
                           OR (subject || ' ' || catalog_number) ILIKE %s
                           OR skill_tags ILIKE %s
                        ORDER BY
                            CASE WHEN course_id ILIKE %s THEN 0
                                 WHEN course_title ILIKE %s THEN 1
                                 ELSE 2 END,
                            course_id ASC
                        LIMIT 12;
                        """,
                        (search_pattern, search_pattern, search_pattern, search_pattern, f"{query}%", f"{query}%"),
                    )
                    for row in cur.fetchall():
                        results.append({
                            "course_id": row[0],
                            "course_title": row[1],
                            "subject": row[2],
                            "catalog_number": row[3],
                            "credits": int(row[4]) if row[4] else 3,
                            "course_level": row[5] or "Upper",
                            "course_type": row[6] or "Elective",
                            "skill_tags": (row[7] or "").replace("|", ", "),
                            "display_name": f"{row[0]}: {row[1]} ({row[4] or 3} cr)",
                        })
        except Exception as exc:
            print(f"Warning: Database search_classes failed, using CSV fallback: {exc}")

    # Fallback to local catalog index if database is not active or returns empty
    if not results:
        catalog_dict = _load_course_catalog()
        q_clean = query.lower().replace(" ", "")
        q_words = query.lower().split()
        matched = []

        for cid, c in catalog_dict.items():
            cid_clean = cid.lower().replace(" ", "")
            ctitle = (c.get("course_title") or "").lower()
            csubj = (c.get("subject") or "").lower()
            cat_num = str(c.get("catalog_number") or "").lower()
            skill_tags = (c.get("skill_tags") or "").lower()
            full_str = f"{cid} {ctitle} {csubj} {cat_num} {skill_tags}".lower()

            score = 0
            if q_clean == cid_clean:
                score += 100
            elif cid_clean.startswith(q_clean):
                score += 80
            elif q_clean in cid_clean:
                score += 60
            elif ctitle.startswith(query.lower()):
                score += 70
            elif all(w in full_str for w in q_words):
                score += 40
            elif any(w in full_str for w in q_words):
                score += 20

            if score > 0:
                matched.append((
                    score,
                    {
                        "course_id": cid,
                        "course_title": c.get("course_title") or cid,
                        "subject": c.get("subject", ""),
                        "catalog_number": c.get("catalog_number", ""),
                        "credits": int(c.get("credits", 3) or 3),
                        "course_level": c.get("course_level", "Upper"),
                        "course_type": c.get("course_type", "Elective"),
                        "skill_tags": (c.get("skill_tags") or "").replace("|", ", "),
                        "display_name": f"{cid}: {c.get('course_title') or cid} ({c.get('credits', 3) or 3} cr)",
                    }
                ))

        matched.sort(key=lambda x: x[0], reverse=True)
        results = [m[1] for m in matched[:12]]

    return jsonify({"results": results}), 200


def _infer_industry_label(raw_industry, career_goals, major):
    """Map user free-text industry/company/goal input to the closest dataset industry."""
    combined = f"{raw_industry or ''} {career_goals or ''}".lower()
    mapping = [
        (["defense", "aerospace", "lockheed", "northrop", "boeing", "raytheon", "dod", "clearance"], "Defense & Aerospace"),
        (["cyber", "security", "nsa", "soc", "pentest", "infosec", "crowdstrike"], "Cybersecurity Services"),
        (["cloud", "aws", "azure", "infrastructure", "devops", "sre"], "Cloud & Infrastructure"),
        (["finance", "bank", "fintech", "capital", "jp morgan", "goldman", "trading", "quant"], "Financial Services"),
        (["health", "medical", "biotech", "clinical", "pharma", "hospital", "epic"], "Healthcare & Life Sciences"),
        (["federal", "government", "civic", "public", "agency", "nasa", "nih"], "Federal Government"),
        (["contract", "booz", "leidos", "caci", "saic", "peraton"], "Federal Contracting"),
        (["consult", "deloitte", "accenture", "mckinsey", "pwc", "kpmg", "ey"], "Consulting & Professional Services"),
        (["ecommerce", "retail", "amazon", "shopify", "stripe"], "E-Commerce & Retail Tech"),
        (["software", "tech", "google", "microsoft", "meta", "apple", "ai", "ml", "data", "product", "swe", "engineer"], "Software Products"),
    ]
    for keywords, label in mapping:
        if any(k in combined for k in keywords):
            return label

    major_defaults = {
        "Computer Science": "Software Products",
        "Data Science": "Software Products",
        "Information Systems": "Consulting & Professional Services",
        "Cybersecurity": "Cybersecurity Services",
        "Health Informatics": "Healthcare & Life Sciences",
        "Computer Engineering": "Defense & Aerospace",
    }
    return major_defaults.get(major, "Software Products")


# ==============================================================================
# SECTION 3: CAMPUS INVOLVEMENT & CO-CURRICULARS METADATA & QUERY ENGINE
# ==============================================================================

CAMPUS_ACTIVITIES_METADATA = {
    # --- Student Organizations (Clubs & Chapters) ---
    "Association for Computing Machinery Student Chapter": {
        "category": "Student Organization",
        "description": "UMBC's premier computing society hosting technical workshops, tech talks, and collaborative coding sessions.",
        "skills": ["Algorithms", "Software Engineering", "Tech Networking", "Peer Collaboration"],
        "departments": ["Computer Science", "Data Science", "Computer Engineering", "Cybersecurity"],
        "industries": ["Software Products", "Financial Services", "Defense & Aerospace", "Cloud & Infrastructure"],
    },
    "Retriever Cyber Club": {
        "category": "Student Organization",
        "description": "Hands-on security workshops, blue/red teaming labs, and CTF tournament preparations.",
        "skills": ["Network Security", "Penetration Testing", "Linux Admin", "Incident Response"],
        "departments": ["Cybersecurity", "Computer Science", "Information Systems"],
        "industries": ["Cybersecurity Services", "Defense & Aerospace", "Federal Government", "Federal Contracting"],
    },
    "CyberDawgs": {
        "category": "Student Organization",
        "description": "UMBC's premier collegiate cyber defense and offensive security student team organization.",
        "skills": ["Network Hardening", "Penetration Testing", "Security Operations", "Linux"],
        "departments": ["Cybersecurity", "Computer Science", "Information Systems"],
        "industries": ["Cybersecurity Services", "Defense & Aerospace", "Federal Government"],
    },
    "Data Science Collective": {
        "category": "Student Organization",
        "description": "Student community exploring predictive modeling, data visualization, and applied ML pipelines.",
        "skills": ["Python", "Machine Learning", "Data Wrangling", "Statistical Modeling", "SQL"],
        "departments": ["Data Science", "Computer Science", "Information Systems"],
        "industries": ["Financial Services", "Healthcare & Life Sciences", "Software Products", "Consulting & Professional Services"],
    },
    "Artificial Intelligence Student Group": {
        "category": "Student Organization",
        "description": "Dedicated student group discussing LLMs, neural networks, reinforcement learning, and computer vision.",
        "skills": ["PyTorch", "Deep Learning", "NLP", "Computer Vision"],
        "departments": ["Computer Science", "Data Science"],
        "industries": ["Software Products", "Defense & Aerospace", "Healthcare & Life Sciences"],
    },
    "Open Source Society": {
        "category": "Student Organization",
        "description": "Collaborative developers contributing to major open-source repositories and building campus software tooling.",
        "skills": ["Git/GitHub", "Code Review", "CI/CD", "Collaborative Development"],
        "departments": ["Computer Science", "Information Systems", "Data Science"],
        "industries": ["Software Products", "Cloud & Infrastructure", "E-Commerce & Retail Tech"],
    },
    "Google Developer Student Club": {
        "category": "Student Organization",
        "description": "Google-supported student chapter building mobile, cloud, and web projects for local communities.",
        "skills": ["Flutter", "Firebase", "GCP", "Web Development"],
        "departments": ["Computer Science", "Information Systems", "Data Science"],
        "industries": ["Software Products", "Cloud & Infrastructure", "E-Commerce & Retail Tech"],
    },
    "IEEE Student Branch": {
        "category": "Student Organization",
        "description": "Technical society focusing on hardware, signal processing, embedded systems, and computing standards.",
        "skills": ["Hardware Design", "Signal Processing", "Embedded C", "Circuit Analysis"],
        "departments": ["Computer Engineering", "Computer Science"],
        "industries": ["Defense & Aerospace", "Software Products"],
    },
    "Retriever Robotics": {
        "category": "Student Organization",
        "description": "Build autonomous and teleoperated robots for intercollegiate engineering challenges.",
        "skills": ["Embedded C/C++", "ROS", "Microcontrollers", "Hardware/Software Integration"],
        "departments": ["Computer Engineering", "Computer Science"],
        "industries": ["Defense & Aerospace", "Software Products", "Healthcare & Life Sciences"],
    },
    "Information Systems Student Association": {
        "category": "Student Organization",
        "description": "Professional development, enterprise systems, cloud tools, and business tech networking.",
        "skills": ["Enterprise Architecture", "Database Systems", "Project Management", "Agile"],
        "departments": ["Information Systems", "Health Informatics"],
        "industries": ["Consulting & Professional Services", "Financial Services", "Federal Contracting"],
    },
    "Cloud Computing Club": {
        "category": "Student Organization",
        "description": "Hands-on cloud architecture labs exploring AWS, Azure, GCP, containerization, and infrastructure as code.",
        "skills": ["AWS", "Docker", "Kubernetes", "DevOps", "Terraform"],
        "departments": ["Computer Science", "Information Systems", "Cybersecurity"],
        "industries": ["Cloud & Infrastructure", "Software Products", "Financial Services"],
    },
    "Game Developers Club": {
        "category": "Student Organization",
        "description": "Game engine design, Unreal/Unity development, graphics programming, and indie game projects.",
        "skills": ["C# / C++", "Unity/Unreal", "Game Physics", "3D Graphics", "Asset Pipelines"],
        "departments": ["Computer Science"],
        "industries": ["Software Products", "E-Commerce & Retail Tech"],
    },
    "Linux Users Group": {
        "category": "Student Organization",
        "description": "Exploring open-source operating systems, kernel configuration, and Unix systems administration.",
        "skills": ["Linux / Unix", "Bash Scripting", "Systems Architecture", "Server Admin"],
        "departments": ["Computer Science", "Cybersecurity", "Computer Engineering"],
        "industries": ["Cloud & Infrastructure", "Defense & Aerospace", "Cybersecurity Services"],
    },
    "Women in Computing": {
        "category": "Student Organization",
        "description": "Empowering women and non-binary students in technology through mentorship, technical workshops, and industry panels.",
        "skills": ["Leadership", "Industry Networking", "Career Development", "Mentorship"],
        "departments": ["Computer Science", "Information Systems", "Data Science", "Cybersecurity"],
        "industries": ["Software Products", "Financial Services", "Defense & Aerospace", "Consulting & Professional Services"],
    },
    "National Society of Black Engineers Chapter": {
        "category": "Student Organization",
        "description": "UMBC NSBE chapter fostering engineering excellence, leadership, and corporate recruitment.",
        "skills": ["Leadership", "Professional Networking", "Engineering Ethics", "Teamwork"],
        "departments": ["Computer Science", "Computer Engineering", "Information Systems"],
        "industries": ["Defense & Aerospace", "Software Products", "Financial Services", "Federal Contracting"],
    },
    "Society of Hispanic Professional Engineers Chapter": {
        "category": "Student Organization",
        "description": "UMBC SHPE chapter providing STEM leadership development and nationwide career conferences.",
        "skills": ["Leadership", "Project Management", "Technical Presentations", "Networking"],
        "departments": ["Computer Science", "Computer Engineering", "Information Systems"],
        "industries": ["Defense & Aerospace", "Software Products", "Consulting & Professional Services"],
    },
    "Society of Asian Scientists and Engineers": {
        "category": "Student Organization",
        "description": "UMBC SASE chapter advancing Asian heritage scientists and engineers in education and industry.",
        "skills": ["Professional Development", "Leadership", "Networking", "STEM Community"],
        "departments": ["Computer Science", "Computer Engineering", "Information Systems"],
        "industries": ["Software Products", "Defense & Aerospace", "Consulting & Professional Services"],
    },
    "Society of Women Engineers Chapter": {
        "category": "Student Organization",
        "description": "UMBC SWE chapter supporting women engineers through professional development and industry networking.",
        "skills": ["Leadership", "Engineering Networking", "Career Panels", "Mentorship"],
        "departments": ["Computer Engineering", "Computer Science", "Information Systems"],
        "industries": ["Defense & Aerospace", "Software Products", "Consulting & Professional Services"],
    },
    "Health Informatics Student Association": {
        "category": "Student Organization",
        "description": "Bridging clinical electronic records, health IT systems, and biomedical data analytics.",
        "skills": ["Health Data Systems", "HIPAA Compliance", "Clinical Analytics", "SQL"],
        "departments": ["Health Informatics", "Information Systems", "Data Science"],
        "industries": ["Healthcare & Life Sciences", "Federal Government", "Consulting & Professional Services"],
    },
    "Product Club": {
        "category": "Student Organization",
        "description": "Product management, user experience design, wireframing, and market strategy workshops.",
        "skills": ["Product Strategy", "User Research", "Wireframing", "Scrum / Agile"],
        "departments": ["Information Systems", "Computer Science"],
        "industries": ["Software Products", "E-Commerce & Retail Tech", "Consulting & Professional Services"],
    },
    "Entrepreneurship and Innovation Club": {
        "category": "Student Organization",
        "description": "Startup incubation, venture creation, and pitch competitions for tech founders.",
        "skills": ["Venture Strategy", "Pitching", "Market Analysis", "Business Models"],
        "departments": ["Information Systems", "Computer Science"],
        "industries": ["Software Products", "Financial Services", "Consulting & Professional Services"],
    },
    "UMBC Esports & Gaming Club": {
        "category": "Student Organization",
        "description": "Competitive gaming, broadcast production, event logistics, and community tournament organization.",
        "skills": ["Live Production", "Community Management", "Event Organizing", "Broadcast Tools"],
        "departments": ["Computer Science", "Information Systems"],
        "industries": ["Software Products", "E-Commerce & Retail Tech"],
    },
    "Design & User Experience Club": {
        "category": "Student Organization",
        "description": "UI/UX wireframing, Figma design systems, usability research, and frontend prototyping.",
        "skills": ["Figma", "UI/UX Design", "Wireframing", "User Research"],
        "departments": ["Information Systems", "Computer Science"],
        "industries": ["Software Products", "Consulting & Professional Services"],
    },
    "Mobile Application Development Club": {
        "category": "Student Organization",
        "description": "Building native and cross-platform mobile applications in Swift, Kotlin, and React Native.",
        "skills": ["iOS / Android", "Swift", "Kotlin", "React Native", "Mobile APIs"],
        "departments": ["Computer Science", "Information Systems"],
        "industries": ["Software Products", "E-Commerce & Retail Tech"],
    },
    "Quantum Computing Student Interest Group": {
        "category": "Student Organization",
        "description": "Exploring quantum algorithms, Qiskit circuits, qubit simulation, and quantum cryptography.",
        "skills": ["Quantum Algorithms", "Qiskit", "Linear Algebra", "Python"],
        "departments": ["Computer Science", "Computer Engineering"],
        "industries": ["Defense & Aerospace", "Software Products", "Financial Services"],
    },
    "Biomedical Engineering Society Student Chapter": {
        "category": "Student Organization",
        "description": "Interdisciplinary society connecting computing, biomechanics, and medical technology innovations.",
        "skills": ["Biomedical Devices", "Signal Processing", "Data Modeling"],
        "departments": ["Computer Engineering", "Health Informatics"],
        "industries": ["Healthcare & Life Sciences", "Defense & Aerospace"],
    },

    # --- Competitive Teams ---
    "Capture the Flag Team": {
        "category": "Competitive Team",
        "description": "Competitive cybersecurity team competing in regional & national collegiate CTF tournaments.",
        "skills": ["Binary Exploitation", "Cryptography", "Reverse Engineering", "Web Security"],
        "departments": ["Cybersecurity", "Computer Science"],
        "industries": ["Cybersecurity Services", "Defense & Aerospace", "Federal Government"],
    },
    "Collegiate Cyber Defense Team": {
        "category": "Competitive Team",
        "description": "Defensive security squad defending live enterprise infrastructure against red team attacks in CCDC.",
        "skills": ["System Hardening", "Firewall Configuration", "SIEM Monitoring", "Active Directory"],
        "departments": ["Cybersecurity", "Information Systems", "Computer Science"],
        "industries": ["Cybersecurity Services", "Defense & Aerospace", "Financial Services"],
    },
    "Programming Contest Team": {
        "category": "Competitive Team",
        "description": "UMBC's competitive algorithm squad training for ICPC collegiate challenges.",
        "skills": ["Advanced Algorithms", "Dynamic Programming", "Graph Theory", "C++"],
        "departments": ["Computer Science"],
        "industries": ["Software Products", "Financial Services"],
    },
    "Analytics Case Competition Team": {
        "category": "Competitive Team",
        "description": "Intercollegiate business analytics team solving live corporate data challenges.",
        "skills": ["Business Intelligence", "Predictive Analytics", "Executive Presenting", "Tableau"],
        "departments": ["Data Science", "Information Systems"],
        "industries": ["Consulting & Professional Services", "Financial Services"],
    },
    "Robotics Competition Team": {
        "category": "Competitive Team",
        "description": "Engineering team designing combat and autonomous navigational competitive robots.",
        "skills": ["Autonomous Navigation", "Sensors/Actuators", "Kinematics", "SolidWorks"],
        "departments": ["Computer Engineering", "Computer Science"],
        "industries": ["Defense & Aerospace", "Software Products"],
    },
    "Collegiate Penetration Testing Team": {
        "category": "Competitive Team",
        "description": "Offensive security squad performing ethical hacking and simulated network penetration tests in CPTC.",
        "skills": ["Penetration Testing", "Vulnerability Assessment", "Metasploit", "Exploit Dev"],
        "departments": ["Cybersecurity", "Computer Science"],
        "industries": ["Cybersecurity Services", "Defense & Aerospace", "Federal Government"],
    },
    "Autonomous Vehicle Racing Team": {
        "category": "Competitive Team",
        "description": "Intercollegiate engineering team developing autonomous navigation, perception, and control systems.",
        "skills": ["Computer Vision", "ROS", "Control Systems", "Sensor Fusion", "C++"],
        "departments": ["Computer Engineering", "Computer Science"],
        "industries": ["Defense & Aerospace", "Software Products"],
    },
    "Data Mining & Kaggle Competition Team": {
        "category": "Competitive Team",
        "description": "Competitive predictive modeling team building ensemble ML solutions for global Kaggle challenges.",
        "skills": ["Feature Engineering", "Ensemble Modeling", "XGBoost", "PyTorch", "Data Science"],
        "departments": ["Data Science", "Computer Science", "Information Systems"],
        "industries": ["Financial Services", "Software Products", "Healthcare & Life Sciences"],
    },
}


def _get_popular_campus_clubs_table(target_industry: str = None) -> list:
    """
    Generate the benchmark data table showing the most popular student organizations
    and competitive teams among all current students in the Tiger Data database.
    """
    counts = {}
    if STUDENT_EXPERIENCE_CSV.exists() and STUDENTS_CURRENT_CSV.exists():
        try:
            curr_cids = set()
            with STUDENTS_CURRENT_CSV.open("r", encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    cid = row.get("campus_id")
                    if cid:
                        curr_cids.add(cid)

            with STUDENT_EXPERIENCE_CSV.open("r", encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    cid = row.get("campus_id")
                    if cid in curr_cids:
                        ename = row.get("experience_name", "").strip()
                        etype = row.get("experience_type", "").strip()
                        if etype in ("Student Organization", "Competitive Team") and ename in CAMPUS_ACTIVITIES_METADATA:
                            counts[ename] = counts.get(ename, 0) + 1
        except Exception as exc:
            print(f"Warning: Failed to compute student activity counts from CSV: {exc}")

    table = []
    filtered_counts = {k: v for k, v in counts.items() if k in CAMPUS_ACTIVITIES_METADATA}
    sorted_clubs = sorted(filtered_counts.items(), key=lambda x: x[1], reverse=True)
    if not sorted_clubs:
        sorted_clubs = [
            ("Association for Computing Machinery Student Chapter", 195),
            ("Data Science Collective", 182),
            ("Retriever Cyber Club", 170),
            ("Google Developer Student Club", 158),
            ("Open Source Society", 145),
            ("Retriever Robotics", 140),
            ("Artificial Intelligence Student Group", 135),
            ("Women in Computing", 128),
            ("IEEE Student Branch", 120),
            ("Game Developers Club", 116),
            ("Capture the Flag Team", 112),
            ("Programming Contest Team", 108),
            ("Cloud Computing Club", 105),
            ("Information Systems Student Association", 102),
        ]

    for rank, (name, cnt) in enumerate(sorted_clubs[:12], start=1):
        meta = CAMPUS_ACTIVITIES_METADATA.get(name, {})
        cat = meta.get("category", "Student Organization")
        relevance = "High Alignment"
        if target_industry and meta.get("industries") and target_industry in meta.get("industries"):
            relevance = f"🔥 Critical for {target_industry}"
        elif cat == "Competitive Team":
            relevance = "High Technical Distinction"
        else:
            relevance = "Strong Co-Curricular Foundation"

        table.append({
            "rank": rank,
            "name": name,
            "category": cat,
            "student_count": cnt,
            "relevance": relevance,
            "skills": ", ".join(meta.get("skills", [])[:3]),
        })

    return table


@app.route("/api/involvement-options", methods=["GET", "POST"])
def get_involvement_options():
    """
    Query Tiger Data / dataset using the user's current session state to return:
    1. popular_activities: Top 6-8 student organizations & competitive teams tailored to student's major & industry for Q1 checkboxes.
    2. all_organizations: Full list of UMBC student organizations & competitive teams for Q2 autocomplete.
    3. campus_club_stats: Top organizations & teams table data across current students in database.
    """
    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
    else:
        payload = request.args

    major = (payload.get("major") or "Computer Science").strip()
    major_track = (payload.get("majorTrack") or payload.get("track") or "").strip()
    target_ind_raw = (payload.get("targetCompanyIndustry") or payload.get("industry") or "").strip()
    career_goals = (payload.get("careerGoals") or "").strip()
    matched_industry = _infer_industry_label(target_ind_raw, career_goals, major)

    scored_activities = []
    for name, meta in CAMPUS_ACTIVITIES_METADATA.items():
        cat = meta.get("category", "Student Organization")
        deps = meta.get("departments", [])
        inds = meta.get("industries", [])

        score = 0
        if major in deps:
            score += 40
        if matched_industry in inds:
            score += 50
        if cat == "Competitive Team":
            score += 30

        # Special major-specific boosts
        if "Cyber" in major or "Cyber" in major_track:
            if any(k in name.lower() for k in ["cyber", "flag", "defense", "security", "linux"]):
                score += 80
        if "Data" in major or "AI" in major_track or "Machine" in major_track:
            if any(k in name.lower() for k in ["data", "ai", "artificial", "analytics", "statistics"]):
                score += 80

        scored_activities.append({
            "name": name,
            "category": cat,
            "description": meta.get("description", ""),
            "skills": ", ".join(meta.get("skills", [])),
            "score": score,
        })

    scored_activities.sort(key=lambda x: x["score"], reverse=True)
    popular_activities = scored_activities[:8]

    # Always ensure popular_activities has at least 6 items
    if len(popular_activities) < 6:
        defaults = [
            "Association for Computing Machinery Student Chapter",
            "Data Science Collective",
            "Open Source Society",
            "Retriever Cyber Club",
            "Google Developer Student Club",
            "Retriever Robotics",
            "Capture the Flag Team",
            "Women in Computing",
        ]
        for d in defaults:
            if not any(a["name"] == d for a in popular_activities):
                meta = CAMPUS_ACTIVITIES_METADATA.get(d, {})
                popular_activities.append({
                    "name": d,
                    "category": meta.get("category", "Student Organization"),
                    "description": meta.get("description", ""),
                    "skills": ", ".join(meta.get("skills", [])),
                    "score": 10,
                })

    all_organizations = [
        {
            "name": name,
            "category": meta.get("category", "Student Organization"),
            "description": meta.get("description", ""),
            "skills": ", ".join(meta.get("skills", [])),
        }
        for name, meta in sorted(CAMPUS_ACTIVITIES_METADATA.items())
    ]

    campus_club_stats = _get_popular_campus_clubs_table(matched_industry)

    return jsonify({
        "major": major,
        "matched_industry": matched_industry,
        "popular_activities": popular_activities,
        "all_organizations": all_organizations,
        "campus_club_stats": campus_club_stats,
    }), 200


@app.route("/api/search-organizations", methods=["GET"])
def search_organizations():
    """
    Live autocomplete search endpoint for campus organizations and activities.
    """
    query = (request.args.get("q") or "").strip()
    if not query:
        return jsonify({"results": []}), 200

    q_lower = query.lower()
    q_words = q_lower.split()
    matched = []

    for name, meta in CAMPUS_ACTIVITIES_METADATA.items():
        name_lower = name.lower()
        cat_lower = meta.get("category", "").lower()
        desc_lower = meta.get("description", "").lower()
        skills_lower = " ".join(meta.get("skills", [])).lower()
        full_haystack = f"{name_lower} {cat_lower} {desc_lower} {skills_lower}"

        score = 0
        if q_lower == name_lower:
            score += 100
        elif name_lower.startswith(q_lower):
            score += 80
        elif q_lower in name_lower:
            score += 60
        elif all(w in full_haystack for w in q_words):
            score += 40
        elif any(w in full_haystack for w in q_words):
            score += 20

        if score > 0:
            matched.append((
                score,
                {
                    "name": name,
                    "category": meta.get("category", "Student Organization"),
                    "description": meta.get("description", ""),
                    "skills": ", ".join(meta.get("skills", [])),
                    "display_name": f"{name} ({meta.get('category', 'Club')})",
                }
            ))

    matched.sort(key=lambda x: x[0], reverse=True)
    results = [m[1] for m in matched[:10]]
    return jsonify({"results": results}), 200


def analyze_student_involvement(user_data: dict, matches: list = None) -> dict:
    """
    Analyze student's campus involvement, leadership density, outlier factor,
    and generate visual metrics and data table for Section 3 report.
    """
    major = (user_data.get("major") or "Computer Science").strip()
    target_ind = (user_data.get("targetCompanyIndustry") or "").strip() or _infer_industry_label(
        user_data.get("targetCompanyIndustry"), user_data.get("careerGoals"), major
    )
    class_year = (user_data.get("classYear") or "Freshman").strip()

    selected_acts = list(user_data.get("selectedActivities") or user_data.get("selected_activities") or [])
    other_orgs = list(user_data.get("otherOrganizations") or user_data.get("other_organizations") or [])
    custom_act = (user_data.get("customActivity") or user_data.get("custom_activity") or "").strip()
    impact_text = (user_data.get("campusImpact") or user_data.get("impactStatement") or user_data.get("campus_impact") or "").strip()

    all_user_activities = list(selected_acts) + list(other_orgs)
    if custom_act and custom_act not in all_user_activities:
        all_user_activities.append(custom_act)

    total_activities_count = len(all_user_activities)

    # Calculate Engagement Score (0 - 100)
    base_score = 45 if total_activities_count > 0 else 30
    act_points = min(40, total_activities_count * 12)
    impact_points = 20 if len(impact_text) > 100 else (12 if len(impact_text) > 30 else (5 if impact_text else 0))
    engagement_score = min(98, max(25, base_score + act_points + impact_points))

    # Leadership Density Assessment
    combined_text = f"{impact_text} {' '.join(all_user_activities)}".lower()
    leadership_keywords = ["lead", "organize", "president", "officer", "mentor", "ta", "founder", "captain", "director", "chair", "board", "executive", "head"]
    if any(k in combined_text for k in leadership_keywords):
        leadership_factor = "High (Leadership & Mentorship)"
        leadership_desc = "Demonstrated organizational or mentorship leadership driving campus initiatives."
    elif total_activities_count >= 2:
        leadership_factor = "Moderate (Active Contributor)"
        leadership_desc = "Consistently contributing across multiple technical or student communities."
    elif total_activities_count == 1:
        leadership_factor = "Emerging (Active Member)"
        leadership_desc = "Engaged in foundational campus activity with opportunity for project leadership."
    else:
        leadership_factor = "Foundational Exploration"
        leadership_desc = "Early exploration phase; opportunity to join high-impact technical student groups."

    # Outlier Factor Detection from Paragraph Input
    outlier_keywords = ["bot", "founded", "built", "shipped", "ctf", "research", "paper", "award", "open source", "steam", "patent", "startup", "nonprofit", "hackathon", "first place", "winner", "competition", "hardware", "indie", "robotics"]
    outlier_hits = [k for k in outlier_keywords if k in combined_text]
    if len(outlier_hits) >= 2 or (len(outlier_hits) >= 1 and len(impact_text) > 80):
        outlier_status = "High Outlier Match"
        outlier_summary = f"Distinctive experiences identified ({', '.join(outlier_hits[:3])}) mirroring high-earning non-traditional alumni trajectories."
    elif len(outlier_hits) == 1:
        outlier_status = "Moderate Outlier Potential"
        outlier_summary = "Unique personal initiative demonstrating self-directed technical ownership beyond the classroom."
    else:
        outlier_status = "Standard Curriculum Path"
        outlier_summary = "Well-aligned with standard departmental extracurricular milestones."

    # Alignment with top-earning alumni in target industry
    alignment_pct = min(98, max(45, 60 + total_activities_count * 8 + (10 if len(outlier_hits) > 0 else 0)))

    # Get data table of top campus clubs in the database
    popular_clubs_table = _get_popular_campus_clubs_table(target_ind)

    return {
        "total_activities_count": total_activities_count,
        "all_user_activities": all_user_activities,
        "selected_activities": selected_acts,
        "other_organizations": other_orgs,
        "custom_activity": custom_act,
        "campus_impact": impact_text,
        "engagement_score": engagement_score,
        "engagement_rating": "Distinguished Engagement" if engagement_score >= 85 else ("Competitive Engagement" if engagement_score >= 65 else "Developing Engagement"),
        "leadership_factor": leadership_factor,
        "leadership_desc": leadership_desc,
        "outlier_status": outlier_status,
        "outlier_summary": outlier_summary,
        "alignment_pct": f"{alignment_pct}%",
        "popular_clubs_table": popular_clubs_table,
    }


# ==============================================================================
# TIGER DATA (POSTGRESQL & DATASET) QUERY ENGINE FOR THE 5 SECTIONS
# ==============================================================================

def query_tiger_data(section_name: str, user_data: dict) -> list:
    """
    Query Tiger Data (PostgreSQL) or cached dataset for the top 3 best alumni matches
    relevant to the requested section.
    """
    clean_section = (section_name or "").lower().strip().replace(" ", "_").replace("-", "_")
    major = (user_data.get("major") or "Computer Science").strip()
    major_track = (user_data.get("majorTrack") or "").strip()
    class_year = (user_data.get("classYear") or "Freshman").strip()
    target_ind_raw = (user_data.get("targetCompanyIndustry") or "").strip()
    career_goals = (user_data.get("careerGoals") or "").strip()
    matched_industry = _infer_industry_label(target_ind_raw, career_goals, major)

    matches = []

    # --------------------------------------------------------------------------
    # SECTION 1: BASIC INFORMATION (Top 3 Alumni Profile Matches)
    # --------------------------------------------------------------------------
    if clean_section in ("basic_info", "section_1", "1", "basic"):
        if TIGER_DATA_URL:
            try:
                with get_db_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            SELECT
                                campus_id, major, track, final_gpa, time_to_degree_years,
                                first_employer, first_job_title, first_employer_industry,
                                first_job_annual_salary_usd, graduation_year
                            FROM alumni
                            WHERE major = %s
                              AND first_job_annual_salary_usd <> 'Not Applicable'
                            ORDER BY
                              CASE WHEN first_employer_industry = %s THEN 0 ELSE 1 END,
                              CASE WHEN track = %s THEN 0 ELSE 1 END,
                              CAST(NULLIF(first_job_annual_salary_usd, 'Not Applicable') AS NUMERIC) DESC
                            LIMIT 3;
                            """,
                            (major, matched_industry, major_track),
                        )
                        for row in cur.fetchall():
                            sal_str = f"${int(float(row[8])):,}" if row[8] and row[8] != "Not Applicable" else "$98,000"
                            matches.append({
                                "campus_id": row[0],
                                "major": row[1],
                                "track": row[2] if row[2] and row[2] != "Not Applicable" else "General Track",
                                "final_gpa": float(row[3]) if row[3] else 3.75,
                                "time_to_degree_years": float(row[4]) if row[4] else 4.0,
                                "first_employer": row[5] or "Amazon Web Services",
                                "first_job_title": row[6] or "Software Engineer I",
                                "first_employer_industry": row[7] or matched_industry,
                                "first_job_annual_salary_usd": sal_str,
                                "graduation_year": row[9] or 2024,
                                "match_score": 96,
                                "match_reason": f"Shared {row[1]} Major & Placement in {row[7] or matched_industry}",
                            })
            except Exception as exc:
                print(f"Tiger Data query warning (basic_info): {exc}")

        if not matches:
            matches = [
                {
                    "campus_id": "ALUM-1048",
                    "major": major,
                    "track": major_track if major_track and major_track != "Not Applicable" else "Software Engineering",
                    "final_gpa": 3.84,
                    "time_to_degree_years": 4.0,
                    "first_employer": "Amazon Web Services",
                    "first_job_title": "Software Development Engineer",
                    "first_employer_industry": matched_industry,
                    "first_job_annual_salary_usd": "$114,000",
                    "graduation_year": 2024,
                    "match_score": 98,
                    "match_reason": f"Top-earning {major} alum in {matched_industry} with 3.8+ GPA trajectory",
                },
                {
                    "campus_id": "ALUM-2182",
                    "major": major,
                    "track": "Cybersecurity & Systems",
                    "final_gpa": 3.72,
                    "time_to_degree_years": 4.0,
                    "first_employer": "Northrop Grumman",
                    "first_job_title": "Systems Software Specialist",
                    "first_employer_industry": "Defense & Aerospace",
                    "first_job_annual_salary_usd": "$98,500",
                    "graduation_year": 2023,
                    "match_score": 94,
                    "match_reason": f"Directly matched {major} curriculum with rapid 4-year completion",
                },
                {
                    "campus_id": "ALUM-3390",
                    "major": major,
                    "track": "Data Science & AI",
                    "final_gpa": 3.68,
                    "time_to_degree_years": 4.0,
                    "first_employer": "T. Rowe Price",
                    "first_job_title": "Quantitative Developer",
                    "first_employer_industry": "Financial Services",
                    "first_job_annual_salary_usd": "$102,000",
                    "graduation_year": 2024,
                    "match_score": 91,
                    "match_reason": "High-performing alumnus with balanced coursework and internship portfolio",
                },
            ]

    # --------------------------------------------------------------------------
    # SECTION 2: COURSE ADVISING (Top 3 Alumni Course & Elective Matches)
    # --------------------------------------------------------------------------
    elif clean_section in ("course_advising", "section_2", "2", "courses", "course"):
        taken_req = [c.upper().replace(" ", "") for c in (user_data.get("takenRequiredCourses") or user_data.get("taken_required_courses") or [])]
        taken_elec = [c.upper().replace(" ", "") for c in (user_data.get("takenElectives") or user_data.get("taken_electives") or [])]
        user_courses_set = set(taken_req + taken_elec)

        catalog_dict = _load_course_catalog()

        # Check local CSVs for top alumni matching profile + coursework
        if ALUMNI_CSV.exists() and TRANSCRIPTS_CSV.exists():
            try:
                alumni_transcripts = {}
                with TRANSCRIPTS_CSV.open("r", encoding="utf-8") as f:
                    for t in csv.DictReader(f):
                        cid = t.get("campus_id")
                        if cid:
                            alumni_transcripts.setdefault(cid, set()).add((t.get("course_id") or "").upper().replace(" ", ""))

                alumni_rows = []
                with ALUMNI_CSV.open("r", encoding="utf-8") as f:
                    for row in csv.DictReader(f):
                        if row.get("major") == major or not row.get("major"):
                            alumni_rows.append(row)

                scored = []
                for a in alumni_rows:
                    cid = a.get("campus_id")
                    a_courses = alumni_transcripts.get(cid, set())
                    overlap = len(user_courses_set.intersection(a_courses)) if user_courses_set else 2

                    try:
                        sal = float(a.get("first_job_annual_salary_usd", 0))
                    except (ValueError, TypeError):
                        sal = 90000

                    ind_match = 1.35 if a.get("first_employer_industry") == matched_industry else 1.0
                    total_score = (sal / 1000.0) * ind_match + (overlap * 12.0)
                    scored.append((total_score, a, overlap, a_courses))

                scored.sort(key=lambda x: x[0], reverse=True)

                for score, a, overlap, a_courses in scored[:3]:
                    sal_val = a.get("first_job_annual_salary_usd")
                    sal_fmt = f"${int(float(sal_val)):,}" if sal_val and sal_val != "Not Applicable" else "$108,000"

                    # Find their key electives from catalog
                    their_elecs = []
                    for c_code in a_courses:
                        raw_cat = catalog_dict.get(c_code)
                        if raw_cat and raw_cat.get("course_type") == "Elective":
                            their_elecs.append(f"{c_code} ({raw_cat.get('course_title', '')})")

                    if not their_elecs:
                        their_elecs = ["CMSC471 (Artificial Intelligence)", "CMSC461 (Database Systems)", "CMSC426 (Computer Security)"]

                    matches.append({
                        "campus_id": a.get("campus_id"),
                        "first_employer": a.get("first_employer") or "Tech Leader",
                        "first_job_title": a.get("first_job_title") or "Software Engineer",
                        "first_job_annual_salary_usd": sal_fmt,
                        "first_employer_industry": a.get("first_employer_industry") or matched_industry,
                        "final_gpa": a.get("final_gpa") or "3.8",
                        "time_to_degree_years": a.get("time_to_degree_years") or "4.0",
                        "key_electives": their_elecs[:3],
                        "overlap_courses_count": overlap,
                        "match_reason": f"Matched {overlap} shared foundational courses with {sal_fmt} career outcome in {a.get('first_employer_industry', matched_industry)}",
                    })
            except Exception as exc:
                print(f"Dataset scoring error for course_advising: {exc}")

        if not matches:
            matches = [
                {
                    "campus_id": "ALUM-2091",
                    "first_employer": "Google",
                    "first_job_title": "Software Engineer II",
                    "first_job_annual_salary_usd": "$128,000",
                    "final_gpa": "3.88",
                    "time_to_degree_years": "4.0",
                    "key_electives": ["CMSC 471 (Artificial Intelligence)", "CMSC 441 (Algorithms)", "CMSC 426 (Computer Security)"],
                    "match_reason": "High coursework similarity: cleared core sequence in 2 years and paired AI + Algorithms electives.",
                },
                {
                    "campus_id": "ALUM-1544",
                    "first_employer": "Northrop Grumman",
                    "first_job_title": "Cyber Systems Engineer",
                    "first_job_annual_salary_usd": "$98,000",
                    "final_gpa": "3.75",
                    "time_to_degree_years": "4.0",
                    "key_electives": ["CMSC 426 (Computer Security)", "CMSC 481 (Computer Networks)", "CMSC 461 (Databases)"],
                    "match_reason": "Security specialization track: paired Systems Programming with Computer Networks for top defense offers.",
                },
                {
                    "campus_id": "ALUM-3810",
                    "first_employer": "Capital One",
                    "first_job_title": "Data Engineer",
                    "first_job_annual_salary_usd": "$106,000",
                    "final_gpa": "3.80",
                    "time_to_degree_years": "4.0",
                    "key_electives": ["CMSC 461 (Database Systems)", "CMSC 478 (Machine Learning)", "STAT 453 (Applied Statistics)"],
                    "match_reason": "Data track: Database Systems combined with Machine Learning catalyzed quantitative FinTech offers.",
                },
            ]

    # --------------------------------------------------------------------------
    # SECTION 3: CAMPUS INVOLVEMENT (Top 3 Alumni Co-Curricular & Outlier Matches)
    # --------------------------------------------------------------------------
    elif clean_section in ("campus_involvement", "section_3", "3", "involvement", "campus"):
        if TIGER_DATA_URL:
            try:
                with get_db_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            WITH top_engaged_alums AS (
                                SELECT campus_id, first_employer, first_job_title, first_job_annual_salary_usd
                                FROM alumni
                                WHERE major = %s
                                  AND engagement_activity_count >= 1
                                  AND first_job_annual_salary_usd <> 'Not Applicable'
                                ORDER BY
                                  CASE WHEN first_employer_industry = %s THEN 0 ELSE 1 END,
                                  CAST(NULLIF(first_job_annual_salary_usd, 'Not Applicable') AS NUMERIC) DESC
                                LIMIT 3
                            )
                            SELECT
                                a.campus_id, a.first_employer, a.first_job_title, a.first_job_annual_salary_usd,
                                se.experience_name, se.experience_type, se.duration_terms, se.hours_per_week, se.outcome
                            FROM top_engaged_alums a
                            LEFT JOIN student_experience se ON se.campus_id = a.campus_id
                            WHERE (se.experience_type IS NULL OR se.experience_type IN ('Student Organization', 'Competitive Team'))
                              AND (se.experience_type NOT ILIKE '%research%' AND se.experience_name NOT ILIKE '%research%');
                            """,
                            (major, matched_industry),
                        )
                        grouped = {}
                        for row in cur.fetchall():
                            cid = row[0]
                            if cid not in grouped:
                                sal_fmt = f"${int(float(row[3])):,}" if row[3] and row[3] != "Not Applicable" else "$101,000"
                                grouped[cid] = {
                                    "campus_id": cid,
                                    "first_employer": row[1] or "Booz Allen Hamilton",
                                    "first_job_title": row[2] or "Solutions Consultant",
                                    "first_job_annual_salary_usd": sal_fmt,
                                    "activities": [],
                                }
                            if row[4]:
                                grouped[cid]["activities"].append({
                                    "experience_name": row[4],
                                    "experience_type": row[5] or "Student Organization",
                                    "duration_terms": row[6] or 2,
                                    "hours_per_week": row[7] or "6",
                                    "outcome": row[8] or "Active Member / Leadership",
                                })
                        for item in grouped.values():
                            if not item["activities"]:
                                item["activities"] = [
                                    {"experience_name": "ACM Student Chapter", "experience_type": "Student Organization", "duration_terms": 3, "hours_per_week": "4", "outcome": "Technical Workshops & Networking"},
                                    {"experience_name": "Data Science Collective", "experience_type": "Student Organization", "duration_terms": 3, "hours_per_week": "5", "outcome": "Campus Project Collaboration"},
                                ]
                        matches = list(grouped.values())[:3]
            except Exception as exc:
                print(f"Tiger Data query warning (campus_involvement): {exc}")

        if not matches:
            matches = [
                {
                    "campus_id": "ALUM-3015",
                    "first_employer": "Booz Allen Hamilton",
                    "first_job_title": "AI/ML Solutions Engineer",
                    "first_job_annual_salary_usd": "$102,000",
                    "activities": [
                        {"experience_name": "Open Source Society Lead", "experience_type": "Student Organization", "duration_terms": 3, "hours_per_week": "8", "outcome": "Built project portfolio & tech network"},
                        {"experience_name": "ACM Student Chapter Officer", "experience_type": "Student Organization", "duration_terms": 4, "hours_per_week": "6", "outcome": "Led technical workshops in Python/Cloud"},
                    ],
                    "outlier_insight": "Combined open-source project leadership with student chapter workshops; recruiter cited active collaboration as primary hiring factor.",
                },
                {
                    "campus_id": "ALUM-4120",
                    "first_employer": "Lockheed Martin",
                    "first_job_title": "Software Engineer",
                    "first_job_annual_salary_usd": "$96,000",
                    "activities": [
                        {"experience_name": "Capture The Flag (CTF) Team", "experience_type": "Competitive Team", "duration_terms": 4, "hours_per_week": "7", "outcome": "Top 10 collegiate ranking"},
                        {"experience_name": "Retriever Cyber Club Officer", "experience_type": "Student Organization", "duration_terms": 3, "hours_per_week": "6", "outcome": "Conducted campus security workshops"},
                    ],
                    "outlier_insight": "Competitive CTF participation and cyber club leadership directly substituted for traditional coursework during defense interviews.",
                },
                {
                    "campus_id": "ALUM-2879",
                    "first_employer": "T. Rowe Price",
                    "first_job_title": "FinTech Systems Analyst",
                    "first_job_annual_salary_usd": "$99,500",
                    "activities": [
                        {"experience_name": "Data Science Collective", "experience_type": "Student Organization", "duration_terms": 3, "hours_per_week": "5", "outcome": "Conducted campus analytics project"},
                        {"experience_name": "Game Developers Club", "experience_type": "Creative Outlier", "duration_terms": 2, "hours_per_week": "6", "outcome": "Shipped indie game demo on Steam"},
                    ],
                    "outlier_insight": "12% outlier correlation: Game development involvement demonstrated full-cycle project ownership in recruiter screens.",
                },
            ]

    # --------------------------------------------------------------------------
    # SECTION 4: PROFESSIONAL INVOLVEMENT (Top 3 Skills & Internships Matches)
    # --------------------------------------------------------------------------
    elif clean_section in ("professional_involvement", "section_4", "4", "professional", "skills", "experience", "internships"):
        if TIGER_DATA_URL:
            try:
                with get_db_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            WITH top_alums AS (
                                SELECT
                                    a.campus_id, a.first_employer, a.first_job_title,
                                    a.first_employer_industry, a.first_job_annual_salary_usd,
                                    a.internship_count
                                FROM alumni a
                                WHERE a.major = %s
                                  AND a.first_job_annual_salary_usd <> 'Not Applicable'
                                ORDER BY
                                  CASE WHEN a.first_employer_industry = %s THEN 0 ELSE 1 END,
                                  a.internship_count DESC,
                                  CAST(NULLIF(a.first_job_annual_salary_usd, 'Not Applicable') AS NUMERIC) DESC
                                LIMIT 3
                            )
                            SELECT
                                ta.campus_id, ta.first_employer, ta.first_job_title,
                                ta.first_employer_industry, ta.first_job_annual_salary_usd,
                                ta.internship_count,
                                eh.role_skill_tags,
                                se.experience_name, se.organization
                            FROM top_alums ta
                            LEFT JOIN employment_history eh ON eh.campus_id = ta.campus_id
                            LEFT JOIN student_experience se ON se.campus_id = ta.campus_id AND se.experience_type = 'Internship';
                            """,
                            (major, matched_industry),
                        )
                        grouped = {}
                        for row in cur.fetchall():
                            cid = row[0]
                            if cid not in grouped:
                                sal_fmt = f"${int(float(row[4])):,}" if row[4] and row[4] != "Not Applicable" else "$108,000"
                                grouped[cid] = {
                                    "campus_id": cid,
                                    "first_employer": row[1] or "Microsoft",
                                    "first_job_title": row[2] or "Software Engineer",
                                    "first_employer_industry": row[3] or matched_industry,
                                    "first_job_annual_salary_usd": sal_fmt,
                                    "internship_count": row[5] or 2,
                                    "internships_held": [],
                                    "skills_mastered": set(),
                                }
                            if row[7]:
                                intern_str = f"{row[7]} ({row[8] or 'Industry Partner'})"
                                if intern_str not in grouped[cid]["internships_held"]:
                                    grouped[cid]["internships_held"].append(intern_str)
                            if row[6]:
                                for tag in str(row[6]).replace(";", "|").replace(",", "|").split("|"):
                                    clean_tag = tag.strip()
                                    if clean_tag:
                                        grouped[cid]["skills_mastered"].add(clean_tag)

                        for item in grouped.values():
                            item["skills_mastered"] = list(item["skills_mastered"])[:5]
                            if not item["internships_held"]:
                                item["internships_held"] = [
                                    f"Software Engineering Intern ({item['first_employer']})",
                                    "Undergraduate Developer (Campus IT & Research)",
                                ]
                            if not item["skills_mastered"]:
                                item["skills_mastered"] = ["Python", "AWS Cloud", "PostgreSQL", "Docker", "Git"]

                        matches = list(grouped.values())[:3]
            except Exception as exc:
                print(f"Tiger Data query warning (professional_involvement): {exc}")

        if not matches:
            matches = [
                {
                    "campus_id": "ALUM-5088",
                    "first_employer": "Amazon Web Services",
                    "first_job_title": "Cloud Solutions Engineer",
                    "first_employer_industry": matched_industry,
                    "first_job_annual_salary_usd": "$115,000",
                    "internship_count": 2,
                    "internships_held": [
                        "Junior Cloud Engineering Intern at T. Rowe Price",
                        "Software Dev Intern at Local Tech Startup",
                    ],
                    "skills_mastered": ["Python", "AWS Lambda", "Terraform", "Docker", "REST APIs"],
                    "industry_alignment": "Held 2 pre-graduation internships; acquired AWS Cloud Practitioner credential in Junior Year.",
                },
                {
                    "campus_id": "ALUM-4612",
                    "first_employer": "Johns Hopkins Applied Physics Lab",
                    "first_job_title": "Embedded Software Developer",
                    "first_employer_industry": "Defense & Research",
                    "first_job_annual_salary_usd": "$102,000",
                    "internship_count": 2,
                    "internships_held": [
                        "DoD Cyber Summer Fellow (Cleared)",
                        "Undergraduate Research Assistant (Autonomous Robotics Lab)",
                    ],
                    "skills_mastered": ["C++", "Linux Kernel", "Git", "Embedded Systems", "Network Sockets"],
                    "industry_alignment": "Leveraged on-campus research fellowship to secure high-security clearance internship.",
                },
                {
                    "campus_id": "ALUM-3741",
                    "first_employer": "Bloomberg LP",
                    "first_job_title": "Software Infrastructure Engineer",
                    "first_employer_industry": "Financial Services",
                    "first_job_annual_salary_usd": "$120,000",
                    "internship_count": 3,
                    "internships_held": [
                        "FinTech Software Intern at Fannie Mae",
                        "Data Platform Intern at Regional Health Org",
                        "Teaching Assistant for Data Structures (CMSC 341)",
                    ],
                    "skills_mastered": ["Java", "SQL / PostgreSQL", "Kafka", "Distributed Systems", "CI/CD"],
                    "industry_alignment": "Progressive internship ladder from regional non-profit to national financial technology leader.",
                },
            ]

    # --------------------------------------------------------------------------
    # SECTION 5: FINAL REPORT (Comprehensive Top 3 Alumni Roadmaps)
    # --------------------------------------------------------------------------
    else:
        if TIGER_DATA_URL:
            try:
                with get_db_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            SELECT
                                campus_id, major, track, final_gpa, time_to_degree_years,
                                first_employer, first_job_title, first_employer_industry,
                                first_job_annual_salary_usd, internship_count, engagement_activity_count
                            FROM alumni
                            WHERE major = %s
                              AND first_job_annual_salary_usd <> 'Not Applicable'
                            ORDER BY
                              CASE WHEN first_employer_industry = %s THEN 0 ELSE 1 END,
                              CAST(NULLIF(first_job_annual_salary_usd, 'Not Applicable') AS NUMERIC) DESC
                            LIMIT 3;
                            """,
                            (major, matched_industry),
                        )
                        for row in cur.fetchall():
                            sal_str = f"${int(float(row[8])):,}" if row[8] and row[8] != "Not Applicable" else "$108,000"
                            matches.append({
                                "campus_id": row[0],
                                "major": row[1],
                                "track": row[2] if row[2] and row[2] != "Not Applicable" else "Standard Track",
                                "final_gpa": float(row[3]) if row[3] else 3.8,
                                "time_to_degree_years": float(row[4]) if row[4] else 4.0,
                                "first_employer": row[5] or "Amazon",
                                "first_job_title": row[6] or "Software Engineer",
                                "first_employer_industry": row[7] or matched_industry,
                                "first_job_annual_salary_usd": sal_str,
                                "internships": row[9] or 2,
                                "activities_count": row[10] or 2,
                                "blueprint_summary": f"Completed {row[1]} in {row[4]} years with {row[9]} internships -> {row[6]} at {row[5]} ({sal_str})",
                            })
            except Exception as exc:
                print(f"Tiger Data query warning (final_report): {exc}")

        if not matches:
            matches = [
                {
                    "campus_id": "ALUM-1048",
                    "major": major,
                    "track": major_track if major_track and major_track != "Not Applicable" else "Software Engineering",
                    "final_gpa": 3.84,
                    "time_to_degree_years": 4.0,
                    "first_employer": "Amazon Web Services",
                    "first_job_title": "Software Development Engineer",
                    "first_employer_industry": matched_industry,
                    "first_job_annual_salary_usd": "$114,000",
                    "internships": 2,
                    "activities_count": 3,
                    "key_courses": ["CMSC 441 (Algorithms)", "CMSC 471 (AI)", "CMSC 447 (Software Eng)"],
                    "blueprint_summary": f"Gold standard 4-year plan: 2 internships, HackUMBC participation, and high-impact AI/Systems electives.",
                },
                {
                    "campus_id": "ALUM-3741",
                    "major": major,
                    "track": "Data Science & Cloud",
                    "final_gpa": 3.75,
                    "time_to_degree_years": 4.0,
                    "first_employer": "Bloomberg LP",
                    "first_job_title": "Software Infrastructure Engineer",
                    "first_employer_industry": "Financial Services",
                    "first_job_annual_salary_usd": "$120,000",
                    "internships": 3,
                    "activities_count": 2,
                    "key_courses": ["CMSC 461 (Databases)", "CMSC 478 (Machine Learning)", "STAT 453"],
                    "blueprint_summary": "High-velocity pathway: Mastered SQL/Cloud early, served as Peer TA, landed top FinTech infrastructure role.",
                },
                {
                    "campus_id": "ALUM-2182",
                    "major": major,
                    "track": "Cybersecurity",
                    "final_gpa": 3.72,
                    "time_to_degree_years": 4.0,
                    "first_employer": "Northrop Grumman",
                    "first_job_title": "Systems Security Engineer",
                    "first_employer_industry": "Defense & Aerospace",
                    "first_job_annual_salary_usd": "$98,500",
                    "internships": 2,
                    "activities_count": 3,
                    "key_courses": ["CMSC 426 (Security)", "CMSC 481 (Networks)", "CMSC 313 (Assembly)"],
                    "blueprint_summary": "Specialized defense track: CTF competitive team involvement paired with security clearance internships.",
                },
            ]

    return matches


def _get_ultimate_alumni_match(user_data: dict) -> dict:
    """
    Run a comprehensive scoring query across all collected session data
    (academics, coursework, involvement, career path, impact statement)
    to identify the single absolute best alumni match in Tiger Data.
    """
    major = (user_data.get("major") or "Computer Science").strip()
    major_track = (user_data.get("majorTrack") or "").strip()
    target_ind_raw = (user_data.get("targetCompanyIndustry") or "").strip()
    career_goals = (user_data.get("careerGoals") or "").strip()
    matched_industry = _infer_industry_label(target_ind_raw, career_goals, major)

    ultimate = None

    if TIGER_DATA_URL:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT
                            a.campus_id, a.major, a.track, a.final_gpa, a.time_to_degree_years,
                            a.first_employer, a.first_job_title, a.first_employer_industry,
                            a.first_job_annual_salary_usd, a.internship_count, a.engagement_activity_count
                        FROM alumni a
                        WHERE a.major = %s
                          AND a.first_job_annual_salary_usd <> 'Not Applicable'
                        ORDER BY
                          CASE WHEN a.first_employer_industry = %s THEN 0 ELSE 1 END,
                          CAST(NULLIF(a.first_job_annual_salary_usd, 'Not Applicable') AS NUMERIC) DESC
                        LIMIT 1;
                        """,
                        (major, matched_industry),
                    )
                    row = cur.fetchone()
                    if row:
                        sal_str = f"${int(float(row[8])):,}" if row[8] and row[8] != "Not Applicable" else "$114,000"
                        cur.execute(
                            """
                            SELECT experience_name, experience_type
                            FROM student_experience
                            WHERE campus_id = %s
                            LIMIT 4;
                            """,
                            (row[0],),
                        )
                        experiences = cur.fetchall()
                        involvements = [e[0] for e in experiences if e[1] in ('Student Organization', 'Competitive Team')]
                        if not involvements:
                            involvements = ["ACM Student Chapter", "Retriever Robotics"]

                        ultimate = {
                            "first_employer": row[5] or "Amazon Web Services",
                            "first_job_title": row[6] or "Software Development Engineer",
                            "first_job_annual_salary_usd": sal_str,
                            "first_employer_industry": row[7] or matched_industry,
                            "major": row[1],
                            "track": row[2] if row[2] and row[2] != "Not Applicable" else (major_track or "Software Engineering"),
                            "final_gpa": float(row[3]) if row[3] else 3.85,
                            "time_to_degree_years": f"{float(row[4]):.1f} Years" if row[4] else "4.0 Years",
                            "internships": f"{row[9] or 2} Summer Internships",
                            "key_involvements": involvements[:3],
                            "key_courses": ["CMSC 441 (Algorithms)", "CMSC 471 (AI)", "CMSC 447 (Software Eng)"],
                            "strategic_takeaway": f"Graduated in {row[4] or 4.0} years, leveraged student organization leadership in {involvements[0] if involvements else 'ACM Chapter'}, completed {row[9] or 2} internships, and secured a {sal_str} starting role at {row[5] or 'Amazon'}.",
                            "match_confidence": "98% Pathway Synergy",
                        }
        except Exception as exc:
            print(f"Tiger Data query warning (_get_ultimate_alumni_match): {exc}")

    if not ultimate:
        if "cyber" in matched_industry.lower() or "cyber" in major.lower():
            ultimate = {
                "first_employer": "Northrop Grumman",
                "first_job_title": "Cyber Systems Engineer",
                "first_job_annual_salary_usd": "$102,000",
                "first_employer_industry": "Cybersecurity Services / Defense",
                "major": major,
                "track": major_track if major_track and major_track != "Not Applicable" else "Cybersecurity Track",
                "final_gpa": 3.78,
                "time_to_degree_years": "4.0 Years",
                "internships": "2 Security Clearance Internships",
                "key_involvements": ["Capture the Flag (CTF) Team", "Retriever Cyber Club"],
                "key_courses": ["CMSC 426 (Computer Security)", "CMSC 481 (Networks)", "CMSC 441 (Algorithms)"],
                "strategic_takeaway": "Paired collegiate CTF competitions with foundational systems coursework, clearing security clearance early to command high-demand defense offers.",
                "match_confidence": "97% Pathway Synergy",
            }
        elif "data" in matched_industry.lower() or "finance" in matched_industry.lower() or "data" in major.lower():
            ultimate = {
                "first_employer": "Bloomberg LP",
                "first_job_title": "Quantitative Software Engineer",
                "first_job_annual_salary_usd": "$122,000",
                "first_employer_industry": "Financial Services & Analytics",
                "major": major,
                "track": major_track if major_track and major_track != "Not Applicable" else "Data Science & Cloud",
                "final_gpa": 3.86,
                "time_to_degree_years": "4.0 Years",
                "internships": "2 Quantitative & FinTech Internships",
                "key_involvements": ["Data Science Collective", "ACM Student Chapter"],
                "key_courses": ["CMSC 461 (Database Systems)", "CMSC 478 (Machine Learning)", "STAT 453 (Applied Stats)"],
                "strategic_takeaway": "Mastered predictive modeling and database architecture early, leading data initiatives and converting junior summer internship into a premium starting offer.",
                "match_confidence": "98% Pathway Synergy",
            }
        else:
            ultimate = {
                "first_employer": "Amazon Web Services",
                "first_job_title": "Software Development Engineer",
                "first_job_annual_salary_usd": "$115,000",
                "first_employer_industry": matched_industry or "Software Products",
                "major": major,
                "track": major_track if major_track and major_track != "Not Applicable" else "Software Engineering",
                "final_gpa": 3.84,
                "time_to_degree_years": "4.0 Years",
                "internships": "2 Summer Software Engineering Internships",
                "key_involvements": ["ACM Student Chapter", "Open Source Society"],
                "key_courses": ["CMSC 441 (Algorithms)", "CMSC 471 (AI)", "CMSC 447 (Software Eng)"],
                "strategic_takeaway": "Maintained a strong 3.8+ GPA in foundational algorithms, drove collaborative projects in the ACM Chapter, and secured early internship returns.",
                "match_confidence": "98% Pathway Synergy",
            }

    return ultimate


def _get_recommended_timeline_steps(user_data: dict, class_analysis: dict = None, involvement_analysis: dict = None) -> list:
    """Generate dynamic 4-stage actionable timeline steps based on student standing and path."""
    class_year = (user_data.get("classYear") or "Freshman").strip()
    target_ind = (user_data.get("targetCompanyIndustry") or "Software Products").strip()

    missing_req = []
    if class_analysis and class_analysis.get("missing_required"):
        missing_req = [c.get("course_id") for c in class_analysis["missing_required"][:2]]
    req_str = f" ({', '.join(missing_req)})" if missing_req else ""

    if class_year in ("Freshman", "Sophomore"):
        return [
            {
                "timeframe": "Next 7 Days",
                "title": "Gateway Core & Pacing Audit",
                "description": f"Audit degree progress in myUMBC and confirm prerequisite enrollment for core courses{req_str}.",
                "badge": "Immediate Priority",
            },
            {
                "timeframe": "In 30-60 Days",
                "title": "Join 1 Technical Organization",
                "description": "Engage actively in ACM Student Chapter or Data Science Collective to start collaborative builds.",
                "badge": "Short-Term Action",
            },
            {
                "timeframe": "In 3-6 Months",
                "title": "First Technical Portfolio Build",
                "description": "Develop a public GitHub project showcasing core competencies in Python, Git, and APIs.",
                "badge": "Recruiting Prep",
            },
            {
                "timeframe": "1-2 Years",
                "title": "Summer Internship Landing",
                "description": f"Leverage campus networking and career fair interviews to lock in a summer internship in {target_ind}.",
                "badge": "Career Milestone",
            },
        ]
    else: # Junior, Senior, More than 4 years
        return [
            {
                "timeframe": "Next 7 Days",
                "title": "Degree Clearance & Capstone Audit",
                "description": f"Confirm all remaining upper-level elective credits{req_str} and graduation clearance with department advising.",
                "badge": "Immediate Priority",
            },
            {
                "timeframe": "In 30-60 Days",
                "title": "Leadership & Project Demonstration",
                "description": "Lead a team project or competition entry demonstrating end-to-end architecture on GitHub.",
                "badge": "Short-Term Action",
            },
            {
                "timeframe": "In 3-6 Months",
                "title": "Technical Interview & Recruiting Push",
                "description": f"Execute structured LeetCode/Systems interview prep and apply to 25+ target employers in {target_ind}.",
                "badge": "Recruiting Sprint",
            },
            {
                "timeframe": "1-2 Years",
                "title": "Full-Time Offer & Launch",
                "description": f"Convert internship experience into full-time return offers targeting starting compensation of $105,000+.",
                "badge": "Career Launch",
            },
        ]


# ==============================================================================
# GEMINI GENERATIVE TEXT INTEGRATION (google-genai SDK)
# ==============================================================================

def generate_gemini_advice(section_name: str, user_data: dict, matches: list, class_analysis: dict = None, involvement_analysis: dict = None) -> str:
    """
    Prompt Gemini via the google-genai SDK:
    'Act as an expert academic advisor. Based on this user data and these database matches,
     write a 2 to 3 sentence message giving the student targeted advice for their [Section Name].
     Base your tone strictly on their class year.'
    """
    class_year = (user_data.get("classYear") or "Freshman").strip()
    major = (user_data.get("major") or "Computer Science").strip()
    major_track = (user_data.get("majorTrack") or "General").strip()
    target_industry = (user_data.get("targetCompanyIndustry") or "").strip() or _infer_industry_label(
        user_data.get("targetCompanyIndustry"), user_data.get("careerGoals"), major
    )
    gpa = str(user_data.get("gpa") or "3.5")
    credits_completed = str(user_data.get("creditsCompleted") or "15")

    section_display_names = {
        "basic_info": "Basic Information and Academic Foundation",
        "course_advising": "Course Advising and Elective Strategy",
        "campus_involvement": "Campus Involvement and Co-Curricular Engagement",
        "professional_involvement": "Professional Involvement, Internships, and Technical Skills",
        "final_report": "Comprehensive Final Academic and Career Roadmap",
    }
    clean_section_key = section_name.lower().replace(" ", "_").replace("-", "_")
    section_title = section_display_names.get(clean_section_key, section_name.title())

    tone_guidelines = {
        "Freshman": "Tone: Directive, encouraging, foundational, clear on early core requirements and habit building.",
        "Sophomore": "Tone: Directive and structured, guiding timely completion of gateway courses and early career exploration.",
        "Junior": "Tone: Inquisitive, strategic, and analytical, pushing for upper-level elective mastery and internship landing.",
        "Senior": "Tone: Action-oriented, inquisitive, focused on capstone execution, career launch, and salary negotiation.",
        "More than 4 years": "Tone: Pragmatic, decisive, accelerating degree completion and leveraging hands-on experience.",
    }
    tone_instruction = tone_guidelines.get(class_year, "Tone: Professional, direct, and tailored to their academic stage.")

    is_tone_shift = bool(class_analysis and class_analysis.get("tone_shift"))
    if is_tone_shift:
        tone_instruction += (
            " Special Directive for Course Advising: The student has completed their upper-level major coursework requirements, "
            "and only foundational/general education courses outside their major department (such as ENGL 100) remain. "
            "Shift your tone to clearly and warmly remind them: 'You should complete these if you have not already.'"
        )

    is_involvement_sec = "campus" in clean_section_key or "3" in clean_section_key or "involvement" in clean_section_key
    involvement_context = ""
    if is_involvement_sec:
        all_acts = list(user_data.get("selectedActivities") or []) + list(user_data.get("otherOrganizations") or [])
        custom_act = (user_data.get("customActivity") or "").strip()
        if custom_act and custom_act not in all_acts:
            all_acts.append(custom_act)
        impact_stmt = (user_data.get("campusImpact") or user_data.get("impactStatement") or "").strip() or "None provided"
        outlier_sum = (involvement_analysis.get("outlier_summary") if involvement_analysis else "") or "Standard engagement profile"
        outlier_status = (involvement_analysis.get("outlier_status") if involvement_analysis else "") or "Standard"
        
        involvement_context = f"""
Student Campus Involvement Profile:
- All Student Activities & Clubs: {', '.join(all_acts) or 'None selected yet'}
- Campus Impact Statement (Paragraph): "{impact_stmt}"
- Outlier Factor Status: {outlier_status} ({outlier_sum})
"""
        tone_instruction += (
            " Special Directive for Campus Involvement: Analyze the student's paragraph impact statement to identify 'outlier' matches—"
            "unique connections to alumni who had similar unconventional or highly specific experiences. Generate a comparative observation "
            "contrasting the user's specific interests and involvement against the commonalities found in the most successful alumni in their career path."
        )

    prompt = f"""Act as an expert academic advisor. Based on this user data and these database matches, write a 2 to 3 sentence message giving the student targeted advice for their {section_title}. Base your tone strictly on their class year.

Student Context:
- Class Standing: {class_year}
- Major & Track: {major} ({major_track})
- Current GPA: {gpa} | Completed Credits: {credits_completed}
- Target Industry & Career Goals: {target_industry} | {user_data.get('careerGoals', 'Launch tech career')}
- Student Input Skills / Experience: {user_data.get('skills', 'Standard Coursework')} | {user_data.get('internships', 'Seeking experience')}
- Selected Campus Activities: {', '.join(user_data.get('selectedActivities', [])) or 'Exploring clubs'}{involvement_context}

Tiger Data Alumni Matches (Top 3):
{json.dumps(matches[:3], indent=2)}

Guidelines:
1. Write EXACTLY 2 to 3 concise, impactful sentences.
2. {tone_instruction}
3. Ground your advice directly in the alumni data matches and the student's stated path. Do not include markdown headers or bullet points."""

    if gemini_client:
        candidate_models = [
            "gemini-3.5-flash-lite",
            "gemini-3.1-flash-lite",
            "gemini-flash-latest",
            "gemini-flash-lite-latest",
            "gemini-3.8-flash",
        ]
        for model_name in candidate_models:
            try:
                response = gemini_client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                if response and response.text:
                    cleaned = response.text.strip()
                    if cleaned:
                        return cleaned
            except Exception as exc:
                print(f"Gemini generation attempt with model {model_name} failed: {exc}")

    # High-quality fallback text adhering strictly to the prompt rules & class year tone
    is_underclassman = class_year in ("Freshman", "Sophomore")
    if "basic" in clean_section_key or "1" in clean_section_key:
        if is_underclassman:
            return (
                f"As a {class_year} in {major}, your immediate focus must be locking in foundational core grades "
                f"while targeting gateway coursework for {target_industry}. Our top alumni matches maintained a 3.7+ GPA "
                f"and cleared their math and programming sequences early to unlock high-earning junior internships."
            )
        else:
            return (
                f"With your current standing as a {class_year} in {major}, have you strategically aligned your remaining "
                f"credits to target top employers in {target_industry}? Alumni with your profile who achieved starting "
                f"salaries exceeding $105,000 leveraged their final semesters to double down on specialized upper-level tracks."
            )

    elif "course" in clean_section_key or "2" in clean_section_key:
        if is_tone_shift:
            return (
                f"You have cleared your upper-level {major} core coursework requirements! If you have not yet completed "
                f"foundational general education courses outside your major department—such as ENGL 100—you should complete these if you have not already, "
                f"to guarantee your degree pacing remains on track for graduation."
            )
        elif is_underclassman:
            return (
                f"You need to prioritize completing your foundational major core sequence before attempting advanced tracks "
                f"in {target_industry}. Benchmark data shows that alumni who mastered Algorithms and Systems early gained "
                f"a decisive edge in technical interviews."
            )
        else:
            return (
                f"Have you completed the core capstone and high-impact electives like Artificial Intelligence or Security that "
                f"our highest-earning alumni took? Taking these specialized electives now will directly substantiate your "
                f"technical portfolio when applying to top-tier organizations in {target_industry}."
            )

    elif "campus" in clean_section_key or "3" in clean_section_key:
        if is_underclassman:
            return (
                f"At this stage in your {class_year} year, getting involved in high-ownership organizations like HackUMBC or "
                f"the ACM Chapter will accelerate both your network and project portfolio. Alumni outcomes demonstrate that "
                f"consistent co-curricular engagement early on correlates with 25% faster time-to-first-offer."
            )
        else:
            return (
                f"Are you taking on leadership roles or competitive team engagements within your student organizations this year? "
                f"Recruiters in {target_industry} look specifically for upperclassmen who have driven impactful team projects "
                f"alongside rigorous academic coursework."
            )

    elif "prof" in clean_section_key or "4" in clean_section_key:
        if is_underclassman:
            return (
                f"Start building tangible technical skills in Python, Cloud tools, and Git now so you can land your first "
                f"internship or research role by next summer. Successful {major} alumni began targeting campus IT and "
                f"undergraduate research positions during their underclassman years to secure industry credentials."
            )
        else:
            return (
                f"How are you translating your hands-on internship experiences and technical skills into demonstrable industry "
                f"outcomes for {target_industry}? Alumni in your track who completed two or more internships commanded average "
                f"starting salaries of $114,000 upon graduation."
            )

    else: # final_report
        if is_underclassman:
            return (
                f"Your 4-year roadmap is clear: protect your GPA in core sequences, immerse yourself in campus technical "
                f"communities, and target your first internship before your junior year. Follow the exact trajectory of "
                f"our top {major} alumni to position yourself for premium offers in {target_industry}."
            )
        else:
            return (
                f"You have built a strong foundation, and your priority now is executing your capstone and converting your "
                f"internship portfolio into full-time offers in {target_industry}. Leverage the proven coursework and skills "
                f"of our alumni matches to maximize your market value and launch your career with confidence."
            )


# ==============================================================================
# ELEVENLABS TEXT-TO-SPEECH (TTS) INTEGRATION
# ==============================================================================

def generate_elevenlabs_tts(
    text: str,
    voice_id: str = DEFAULT_ELEVENLABS_VOICE_ID,
    *,
    raise_errors: bool = False,
) -> str:
    """
    Pass the generated Gemini response string into the ElevenLabs SDK
    to generate the TTS audio stream, and return it as a Base64 encoded audio string.
    """
    if not elevenlabs_client or not text:
        if raise_errors:
            raise RuntimeError("ElevenLabs client is not configured or text is empty.")
        return ""

    try:
        audio_stream = elevenlabs_client.text_to_speech.convert(
            voice_id=voice_id,
            text=text,
            model_id="eleven_turbo_v2_5",
            output_format="mp3_44100_128",
        )
        audio_chunks = []
        for chunk in audio_stream:
            if isinstance(chunk, bytes):
                audio_chunks.append(chunk)

        if audio_chunks:
            audio_bytes = b"".join(audio_chunks)
            return base64.b64encode(audio_bytes).decode("utf-8")
        raise RuntimeError("ElevenLabs returned an empty audio stream.")
    except Exception as exc:
        if raise_errors:
            raise
        print(f"ElevenLabs TTS generation warning: {exc}")

    return ""


def _parse_prerequisites(prereq_str: str) -> list:
    """Extract individual course IDs from a prerequisite_ids string."""
    if not prereq_str or str(prereq_str).strip().lower() in ("not applicable", "none", "n/a"):
        return []
    cleaned = (
        str(prereq_str)
        .replace("|", " ")
        .replace(";", " ")
        .replace(",", " ")
        .replace(" or ", " ")
        .replace(" and ", " ")
    )
    tokens = cleaned.split()
    prereqs = []
    for token in tokens:
        t = token.strip().upper().replace(" ", "")
        if t and len(t) >= 5 and any(char.isdigit() for char in t):
            prereqs.append(t)
    return prereqs


def _resolve_all_prerequisites(taken_course_ids: set, catalog_dict: dict) -> set:
    """
    Given a set of completed course IDs, recursively identify all prerequisites
    and return the full transitive closure of completed + inferred prerequisite course IDs.
    """
    all_completed = set(taken_course_ids)
    queue = list(taken_course_ids)
    visited = set(taken_course_ids)

    norm_catalog = {k.upper().replace(" ", ""): v for k, v in catalog_dict.items()}

    while queue:
        current_cid = queue.pop(0)
        cat_info = norm_catalog.get(current_cid)
        if cat_info:
            raw_prereqs = cat_info.get("prerequisite_ids") or ""
            parsed = _parse_prerequisites(raw_prereqs)
            for p in parsed:
                p_clean = p.upper().replace(" ", "")
                if p_clean not in all_completed:
                    all_completed.add(p_clean)
                    if p_clean not in visited:
                        visited.add(p_clean)
                        queue.append(p_clean)

    return all_completed


@app.route("/api/section1-voice", methods=["POST"])
def generate_section1_voice():
    payload = request.get_json(silent=True) or {}
    text = payload.get("text")
    voice_id = str(payload.get("voice_id") or "").strip() or SECTION_1_ELEVENLABS_VOICE_ID
    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "Text is required."}), 400
    if len(text) > 1000:
        return jsonify({"error": "Text must be 1000 characters or fewer."}), 413

    try:
        audio = generate_elevenlabs_tts(
            text.strip(),
            voice_id=voice_id,
            raise_errors=True,
        )
    except Exception as exc:
        if getattr(exc, "status_code", None) == 402:
            return jsonify({
                "error": "This ElevenLabs voice requires a paid API plan. Upgrade the account or use a voice available on its current plan.",
                "code": "paid_plan_required",
            }), 402
        app.logger.error("Section 1 ElevenLabs TTS failed: %s", type(exc).__name__)
        return jsonify({"error": "Section 1 voice generation failed."}), 502

    return jsonify({"audio": audio}), 200


def analyze_student_coursework(user_data: dict) -> dict:
    """
    Direct comparative breakdown comparing classes the user has already taken
    against required major core and high-yield electives recommended by the dataset.
    Implements:
    1. Prerequisite Inference: If a course has been completed, all its prerequisites are
       assumed to be completed and removed from remaining courses.
    2. Tier Filter: If higher-level courses were shown in the required section, lower-level
       courses in the student's major/minor discipline are omitted from remaining required core.
    3. Gen-Ed Exception: Lower-level courses NOT directly affiliated with the user's major/minor
       (e.g., ENGL 100) are always preserved and shown.
    4. Tone Shift: If no higher-level major courses remain and only non-major lower-level courses
       remain, the tone shifts to 'You should complete these if you have not already'.
    """
    major = (user_data.get("major") or "Computer Science").strip()
    minor = (user_data.get("minor") or "").strip()
    target_ind = (user_data.get("targetCompanyIndustry") or "").strip()
    career_goals = (user_data.get("careerGoals") or "").strip()

    try:
        credits_completed = int(user_data.get("creditsCompleted") or user_data.get("credits_completed") or 0)
    except (ValueError, TypeError):
        credits_completed = 0

    raw_taken_req = [c.upper().replace(" ", "") for c in (user_data.get("takenRequiredCourses") or user_data.get("taken_required_courses") or [])]
    raw_taken_elec = [c.upper().replace(" ", "") for c in (user_data.get("takenElectives") or user_data.get("taken_electives") or [])]
    planned = user_data.get("plannedCourses") or user_data.get("planned_courses") or []
    custom_planned = (user_data.get("customPlannedCourses") or user_data.get("custom_planned_courses") or "").strip()

    catalog_dict = _load_course_catalog()

    # Transitive prerequisite closure: all prerequisites of completed courses are assumed completed
    user_taken_set = set(raw_taken_req + raw_taken_elec)
    inferred_all_completed = _resolve_all_prerequisites(user_taken_set, catalog_dict)

    major_disciplines = {
        "Computer Science": {"CMSC", "CMPE"},
        "Information Systems": {"IS"},
        "Data Science": {"DATA"},
        "Cybersecurity": {"CMSC", "IS"},
        "Computer Engineering": {"CMPE", "ENEE"},
        "Health Informatics": {"IS", "BTEC", "HAPP"},
    }
    minor_disciplines = {
        "Mathematics": {"MATH"},
        "Statistics": {"STAT"},
        "Economics": {"ECON"},
        "Business Administration": {"MGMT", "ACCT", "ECON"},
        "Cybersecurity": {"CMSC", "IS"},
        "Data Science": {"DATA"},
    }

    major_affiliated_subjects = major_disciplines.get(major, {"CMSC"})
    minor_affiliated_subjects = minor_disciplines.get(minor, set()) if minor and minor != "Not Applicable" else set()
    all_affiliated_subjects = major_affiliated_subjects | minor_affiliated_subjects

    all_required_objs = []
    electives_pool_objs = []

    for cid, c in catalog_dict.items():
        req_majors = [m.strip() for m in (c.get("required_for_majors") or "").split("|") if m]
        c_subj = c.get("subject") or cid[:4]
        cat_num_raw = c.get("catalog_number", "0")
        try:
            course_num = int("".join(filter(str.isdigit, str(cat_num_raw))))
        except ValueError:
            course_num = 0

        ctype = c.get("course_type") or "Core"
        is_affiliated = c_subj in all_affiliated_subjects

        info = {
            "course_id": cid,
            "course_title": c.get("course_title") or cid,
            "subject": c_subj,
            "catalog_number": cat_num_raw,
            "course_num": course_num,
            "credits": int(c.get("credits", 3) or 3),
            "course_level": c.get("course_level", "Upper"),
            "course_type": ctype,
            "skill_tags": (c.get("skill_tags") or "").replace("|", ", "),
            "difficulty_index": float(c.get("difficulty_index", 3.0) or 3.0),
            "is_major_affiliated": is_affiliated,
        }

        is_major_req = (major in req_majors) or (ctype in ("Core", "Required", "Foundation") and is_affiliated)
        is_gen_ed_req = (major in req_majors) and not is_affiliated

        if is_major_req or is_gen_ed_req:
            all_required_objs.append(info)
        elif ctype in ("Elective", "Specialized", "Upper"):
            electives_pool_objs.append(info)

    all_required_objs.sort(key=lambda x: (0 if x["course_level"] == "Lower" else 1, x["course_num"], x["course_id"]))

    completed_required = []
    raw_missing_required = []

    for req in all_required_objs:
        cid_clean = req["course_id"].upper().replace(" ", "")
        if cid_clean in inferred_all_completed or any(cid_clean == t or cid_clean in t or t in cid_clean for t in inferred_all_completed):
            completed_required.append(req)
        else:
            raw_missing_required.append(req)

    completed_electives = []
    for cid, c in catalog_dict.items():
        cid_clean = cid.upper().replace(" ", "")
        if cid_clean in inferred_all_completed or any(cid_clean == t or cid_clean in t or t in cid_clean for t in raw_taken_elec):
            if not any(r["course_id"].upper().replace(" ", "") == cid_clean for r in completed_required):
                completed_electives.append({
                    "course_id": cid,
                    "course_title": c.get("course_title") or cid,
                    "credits": int(c.get("credits", 3) or 3),
                    "skill_tags": (c.get("skill_tags") or "").replace("|", ", "),
                })

    # Filter remaining required courses based on credit tier:
    # If the user was shown higher-level courses, do NOT show lower-level courses in major/minor disciplines.
    # EXCEPTION: Courses not directly affiliated with the user's major/minor (e.g. ENGL 100) are ALWAYS shown!
    missing_required = []
    for req in raw_missing_required:
        is_affiliated = req["is_major_affiliated"]
        c_num = req["course_num"]

        if is_affiliated:
            if credits_completed > 80:
                # Shown high-level courses (300+); filter out lower level (<300) major courses
                if c_num >= 300:
                    missing_required.append(req)
            elif credits_completed >= 30:
                # Shown mid/high-level courses (200+); filter out lower level (<200) major courses
                if c_num >= 200:
                    missing_required.append(req)
            else:
                # Shown lower level courses (<30 credits)
                missing_required.append(req)
        else:
            # Non-affiliated foundational/general education course (e.g. ENGL 100, etc.)
            missing_required.append(req)

    # Check for Tone Shift:
    # If there are no higher-level major courses left for the user to take and there are lower-level courses
    # not in the department of that major, the tone shifts to "you should complete these if you have not already"
    remaining_higher_major = [c for c in missing_required if c["is_major_affiliated"] and c["course_num"] >= 300]
    remaining_non_dept_lower = [c for c in missing_required if not c["is_major_affiliated"] and c["course_num"] < 300]

    tone_shift = False
    if len(remaining_higher_major) == 0 and len(remaining_non_dept_lower) > 0:
        tone_shift = True
        missing_required_title = "⚠️ Foundational & General Education Core"
        missing_required_subtitle = "You should complete these if you have not already:"
        missing_required_note = "All upper-level major requirements are complete. Make sure you have completed these foundational/general education requirements if you have not already."
    elif len(missing_required) == 0:
        tone_shift = False
        missing_required_title = "✅ Core Requirements Complete"
        missing_required_subtitle = "All required core and degree courses cleared!"
        missing_required_note = ""
    else:
        tone_shift = False
        missing_required_title = "⚠️ Remaining Required Core"
        missing_required_subtitle = "Major core courses still needed for degree:"
        missing_required_note = ""

    taken_all_cids = set([c["course_id"].upper().replace(" ", "") for c in (completed_required + completed_electives)])

    recommended_electives = []
    combined_keywords = f"{target_ind} {career_goals}".lower()

    for e in electives_pool_objs:
        if e["course_id"].upper().replace(" ", "") in taken_all_cids:
            continue
        boost = 0
        if any(k in combined_keywords for k in ["ai", "data", "ml", "machine"]) and any(k in e["skill_tags"].lower() for k in ["ai", "data", "python", "mining", "learning", "statistics"]):
            boost += 60
        if any(k in combined_keywords for k in ["security", "cyber", "defense", "clearance"]) and any(k in e["skill_tags"].lower() for k in ["security", "crypto", "network", "linux"]):
            boost += 60
        if any(k in combined_keywords for k in ["web", "software", "cloud", "fullstack", "dev"]) and any(k in e["skill_tags"].lower() for k in ["web", "cloud", "software", "testing", "design", "sql"]):
            boost += 60

        e_copy = dict(e)
        e_copy["priority_score"] = boost
        recommended_electives.append(e_copy)

    recommended_electives.sort(key=lambda x: x["priority_score"], reverse=True)

    planned_course_objs = []
    for p in planned:
        cid_clean = str(p).upper().replace(" ", "")
        cat_item = catalog_dict.get(cid_clean) or catalog_dict.get(p)
        if cat_item:
            planned_course_objs.append({
                "course_id": cat_item["course_id"],
                "course_title": cat_item["course_title"],
                "credits": int(cat_item.get("credits", 3) or 3),
                "skill_tags": (cat_item.get("skill_tags") or "").replace("|", ", "),
            })
        else:
            planned_course_objs.append({
                "course_id": p,
                "course_title": p,
                "credits": 3,
                "skill_tags": "Custom Coursework",
            })

    total_req_count = len(all_required_objs) or 1
    comp_count = len(completed_required)
    progress_pct = int((comp_count / total_req_count) * 100)

    return {
        "major": major,
        "completed_required": completed_required,
        "missing_required": missing_required,
        "missing_required_title": missing_required_title,
        "missing_required_subtitle": missing_required_subtitle,
        "missing_required_note": missing_required_note,
        "tone_shift": tone_shift,
        "completed_electives": completed_electives,
        "recommended_electives": recommended_electives[:4],
        "planned_courses": planned_course_objs,
        "custom_planned": custom_planned,
        "total_required_count": total_req_count,
        "completed_required_count": comp_count,
        "progress_pct": f"{progress_pct}%",
        "trajectory_status": "Ahead of Schedule" if comp_count >= 6 else ("On Track" if comp_count >= 3 else "Foundational Stage"),
    }


# ==============================================================================
# UNIFIED REPORT GENERATION ENDPOINT (POST /api/generate-report)
# ==============================================================================

@app.route("/api/generate-report", methods=["POST"])
def generate_report():
    """
    Dynamic 3-step pipeline per section:
    Step A: Query Tiger Data (PostgreSQL) for best alumni matches.
    Step B: Send user inputs + matches to Gemini API for a 2-3 sentence targeted summary.
    Step C: Send Gemini text to ElevenLabs API for TTS audio stream.
    Returns: { "text": "<gemini_response>", "audio": "<base64_audio_data>", "matches": [<tiger_data_objects>], "class_analysis": <analysis_data> }
    """
    payload = request.get_json(silent=True) or {}
    section_name = payload.get("section_name") or payload.get("section") or "basic_info"
    user_data = payload.get("user_data") or payload.get("user") or payload.get("student") or payload

    # Ensure nested student state is flattened if passed as wizard format
    if "demographics" in user_data:
        demo = user_data.get("demographics") or {}
        asp = user_data.get("aspirations") or {}
        inv = user_data.get("involvement") or {}
        prof = user_data.get("experience") or {}
        user_data = {
            "classYear": user_data.get("classYear") or demo.get("classYear"),
            "major": demo.get("major"),
            "majorTrack": demo.get("majorTrack"),
            "minor": demo.get("otherCategories"),
            "gpa": demo.get("gpa"),
            "creditsCompleted": demo.get("creditsCompleted"),
            "targetSalary": asp.get("expectedSalaryUsd"),
            "targetCompanyIndustry": asp.get("targetCompaniesIndustries"),
            "targetLocation": asp.get("targetLocation"),
            "careerGoals": asp.get("careerGoals"),
            "selectedActivities": inv.get("selectedActivities") or user_data.get("selectedActivities") or [],
            "otherOrganizations": inv.get("otherOrganizations") or user_data.get("otherOrganizations") or [],
            "customActivity": inv.get("customActivity") or user_data.get("customActivity") or "",
            "campusImpact": inv.get("campusImpact") or user_data.get("campusImpact") or user_data.get("impactStatement") or "",
            "impactStatement": inv.get("impactStatement") or user_data.get("impactStatement") or user_data.get("campusImpact") or "",
            "skills": prof.get("projectsAndSkills") or user_data.get("skills") or "",
            "internships": prof.get("internshipsAndJobs") or user_data.get("internships") or "",
            "takenRequiredCourses": user_data.get("takenRequiredCourses") or [],
            "takenElectives": user_data.get("takenElectives") or [],
            "plannedCourses": user_data.get("plannedCourses") or [],
            "customPlannedCourses": user_data.get("customPlannedCourses") or "",
        }

    clean_sec = (section_name or "").lower().replace(" ", "_").replace("-", "_")
    class_analysis = None
    involvement_analysis = None
    ultimate_match = None
    timeline_steps = None

    if clean_sec in ("course_advising", "section_2", "2", "courses", "course"):
        class_analysis = analyze_student_coursework(user_data)
    elif clean_sec in ("campus_involvement", "section_3", "3", "involvement", "campus"):
        involvement_analysis = analyze_student_involvement(user_data)
    elif clean_sec in ("final_report", "section_5", "5", "final", "synthesis"):
        class_analysis = analyze_student_coursework(user_data)
        involvement_analysis = analyze_student_involvement(user_data)
        ultimate_match = _get_ultimate_alumni_match(user_data)
        timeline_steps = _get_recommended_timeline_steps(user_data, class_analysis, involvement_analysis)

    # Step A: Query Tiger Data
    matches = query_tiger_data(section_name, user_data)

    # Step B: Gemini API Summary (with class_analysis and involvement_analysis context)
    gemini_text = generate_gemini_advice(
        section_name,
        user_data,
        matches,
        class_analysis=class_analysis,
        involvement_analysis=involvement_analysis,
    )

    # Step C: ElevenLabs TTS Audio (Strictly use frontend voice_id or SECTION_1_ELEVENLABS_VOICE_ID)
    requested_voice_id = str(payload.get("voice_id") or "").strip()
    if requested_voice_id:
        voice_to_use = requested_voice_id
    elif clean_sec in ("basic_info", "section_1", "1", "final_report", "section_5", "5", "final", "synthesis"):
        voice_to_use = SECTION_1_ELEVENLABS_VOICE_ID
    else:
        voice_to_use = SECTION_1_ELEVENLABS_VOICE_ID

    base64_audio = generate_elevenlabs_tts(gemini_text, voice_id=voice_to_use)

    return jsonify({
        "section_name": section_name,
        "text": gemini_text,
        "audio": base64_audio,
        "matches": matches,
        "ultimate_match": ultimate_match,
        "timeline_steps": timeline_steps,
        "class_analysis": class_analysis,
        "involvement_analysis": involvement_analysis,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }), 200


def _get_tiger_data_major_benchmarks(user_data: dict) -> dict:
    """
    Run comprehensive statistical aggregations across the Tiger Data alumni repository
    for the student's specific Major, Track, and Target Industry.
    """
    major = (user_data.get("major") or "Computer Science").strip()
    target_ind_raw = (user_data.get("targetCompanyIndustry") or "").strip()
    career_goals = (user_data.get("careerGoals") or "").strip()
    matched_industry = _infer_industry_label(target_ind_raw, career_goals, major)

    salaries = []
    employers_count = {}
    titles_count = {}
    time_to_degree_list = []
    internships_list = []
    gpa_list = []

    if TIGER_DATA_URL:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT
                            first_job_annual_salary_usd,
                            first_employer,
                            first_job_title,
                            time_to_degree_years,
                            internship_count,
                            final_gpa
                        FROM alumni
                        WHERE major = %s
                          AND first_job_annual_salary_usd <> 'Not Applicable';
                        """,
                        (major,)
                    )
                    for row in cur.fetchall():
                        try:
                            sal = float(row[0])
                            salaries.append(sal)
                        except (ValueError, TypeError):
                            pass
                        emp = (row[1] or "").strip()
                        if emp:
                            employers_count[emp] = employers_count.get(emp, 0) + 1
                        title = (row[2] or "").strip()
                        if title:
                            titles_count[title] = titles_count.get(title, 0) + 1
                        if row[3]:
                            time_to_degree_list.append(float(row[3]))
                        if row[4]:
                            internships_list.append(int(row[4]))
                        if row[5]:
                            gpa_list.append(float(row[5]))
        except Exception as exc:
            print(f"Warning: Failed to fetch alumni benchmarks from database: {exc}")

    # Fallback to local CSV if database returns empty
    if not salaries and ALUMNI_CSV.exists():
        try:
            with ALUMNI_CSV.open("r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if (row.get("major") or "").strip() == major:
                        raw_sal = row.get("first_job_annual_salary_usd", "")
                        if raw_sal and raw_sal != "Not Applicable":
                            try:
                                salaries.append(float(raw_sal))
                            except ValueError:
                                pass
                        emp = (row.get("first_employer") or "").strip()
                        if emp:
                            employers_count[emp] = employers_count.get(emp, 0) + 1
                        title = (row.get("first_job_title") or "").strip()
                        if title:
                            titles_count[title] = titles_count.get(title, 0) + 1
                        try:
                            time_to_degree_list.append(float(row.get("time_to_degree_years", 4.0)))
                        except ValueError:
                            pass
                        try:
                            internships_list.append(int(row.get("internship_count", 2)))
                        except ValueError:
                            pass
                        try:
                            gpa_list.append(float(row.get("final_gpa", 3.7)))
                        except ValueError:
                            pass
        except Exception as exc:
            print(f"Warning: Failed to read alumni CSV: {exc}")

    if not salaries:
        salaries = [85000, 92000, 98000, 105000, 112000, 118000, 125000, 135000]

    salaries.sort()
    n = len(salaries)
    p25 = salaries[int(n * 0.25)] if n > 0 else 92000
    p50 = salaries[int(n * 0.50)] if n > 0 else 105000
    p75 = salaries[int(n * 0.75)] if n > 0 else 118000
    max_sal = max(salaries) if salaries else 145000
    avg_sal = sum(salaries) / n if n > 0 else 105000

    sorted_employers = sorted(employers_count.items(), key=lambda x: x[1], reverse=True)[:6]
    if not sorted_employers:
        sorted_employers = [
            ("Amazon Web Services", 48),
            ("Northrop Grumman", 42),
            ("Booz Allen Hamilton", 36),
            ("Bloomberg LP", 29),
            ("T. Rowe Price", 25),
            ("Lockheed Martin", 22),
        ]

    sorted_titles = sorted(titles_count.items(), key=lambda x: x[1], reverse=True)[:5]
    if not sorted_titles:
        sorted_titles = [
            ("Software Development Engineer", 65),
            ("Systems Software Engineer", 45),
            ("Cybersecurity Analyst", 38),
            ("Data Engineer / Analyst", 32),
            ("Cloud Infrastructure Engineer", 28),
        ]

    avg_time = sum(time_to_degree_list) / len(time_to_degree_list) if time_to_degree_list else 4.0
    avg_internships = sum(internships_list) / len(internships_list) if internships_list else 2.1
    avg_gpa = sum(gpa_list) / len(gpa_list) if gpa_list else 3.72

    return {
        "sample_size": n,
        "salary_25th": f"${int(p25):,}",
        "salary_median": f"${int(p50):,}",
        "salary_75th": f"${int(p75):,}",
        "salary_max": f"${int(max_sal):,}",
        "salary_avg": f"${int(avg_sal):,}",
        "top_employers": [{"name": k, "count": v} for k, v in sorted_employers],
        "top_titles": [{"name": k, "count": v} for k, v in sorted_titles],
        "avg_time_to_degree": f"{avg_time:.1f} Years",
        "avg_internships": f"{avg_internships:.1f} Internships",
        "avg_gpa": f"{avg_gpa:.2f}",
        "employment_rate": "95.4%",
        "matched_industry": matched_industry,
    }


# ==============================================================================
# FORMAL CAREER & ACADEMIC DOSSIER PRINT GENERATOR
# ==============================================================================

@app.route("/api/print-report", methods=["POST", "GET"])
@app.route("/print-report", methods=["POST", "GET"])
def print_report():
    """
    Generate and render a formal, comprehensive Academic & Career Dossier
    from deep Tiger Data queries across coursework, involvement, career path,
    alumni statistics, and timeline roadmap.
    """
    payload = {}
    if request.method == "POST":
        if request.is_json:
            payload = request.get_json(silent=True) or {}
        else:
            state_json = request.form.get("state_json") or request.form.get("user_data")
            if state_json:
                try:
                    payload = json.loads(state_json)
                except Exception:
                    payload = {}
            else:
                payload = request.form.to_dict()

    user_data = payload.get("user_data") or payload.get("user") or payload.get("student") or payload
    if "demographics" in user_data:
        demo = user_data.get("demographics") or {}
        asp = user_data.get("aspirations") or {}
        inv = user_data.get("involvement") or {}
        prof = user_data.get("experience") or {}
        user_data = {
            "classYear": user_data.get("classYear") or demo.get("classYear") or "Freshman",
            "name": demo.get("name") or user_data.get("name") or "Undergraduate Student",
            "major": demo.get("major") or "Computer Science",
            "majorTrack": demo.get("majorTrack") or "General Track",
            "minor": demo.get("otherCategories") or "None",
            "gpa": demo.get("gpa") or "3.60",
            "creditsCompleted": demo.get("creditsCompleted") or "15",
            "targetSalary": asp.get("expectedSalaryUsd") or "$105,000",
            "targetCompanyIndustry": asp.get("targetCompaniesIndustries") or "Software Products",
            "targetLocation": asp.get("targetLocation") or "Mid-Atlantic / Remote",
            "careerGoals": asp.get("careerGoals") or "Software Engineering",
            "selectedActivities": inv.get("selectedActivities") or user_data.get("selectedActivities") or [],
            "otherOrganizations": inv.get("otherOrganizations") or user_data.get("otherOrganizations") or [],
            "customActivity": inv.get("customActivity") or user_data.get("customActivity") or "",
            "campusImpact": inv.get("campusImpact") or user_data.get("campusImpact") or "",
            "skills": prof.get("projectsAndSkills") or user_data.get("skills") or "",
            "internships": prof.get("internshipsAndJobs") or user_data.get("internships") or "",
            "takenRequiredCourses": user_data.get("takenRequiredCourses") or [],
            "takenElectives": user_data.get("takenElectives") or [],
            "plannedCourses": user_data.get("plannedCourses") or [],
            "noRequiredCourses": user_data.get("noRequiredCourses", False),
            "noCurrentActivities": user_data.get("noCurrentActivities", False),
            "noPriorExperience": user_data.get("noPriorExperience", False),
        }

    # Deep Tiger Data Integrations
    class_analysis = analyze_student_coursework(user_data)
    involvement_analysis = analyze_student_involvement(user_data)
    ultimate_match = _get_ultimate_alumni_match(user_data)
    timeline_steps = _get_recommended_timeline_steps(user_data, class_analysis, involvement_analysis)
    tiger_benchmarks = _get_tiger_data_major_benchmarks(user_data)
    top_matches = query_tiger_data("final_report", user_data)

    executive_advice = generate_gemini_advice(
        "final_report",
        user_data,
        top_matches,
        class_analysis=class_analysis,
        involvement_analysis=involvement_analysis,
    )

    dossier_id = f"DOSSIER-UMBC-2026-{uuid.uuid4().hex[:6].upper()}"
    timestamp_str = datetime.now(timezone.utc).strftime("%B %d, %Y")

    return render_template(
        "print_layout.html",
        user=user_data,
        class_analysis=class_analysis,
        involvement_analysis=involvement_analysis,
        ultimate_match=ultimate_match,
        timeline_steps=timeline_steps,
        tiger_benchmarks=tiger_benchmarks,
        executive_advice=executive_advice,
        dossier_id=dossier_id,
        timestamp_str=timestamp_str,
    )


# ==============================================================================
# SUBMISSION & LEGACY ENDPOINTS FOR DATA PERSISTENCE
# ==============================================================================

@app.route("/api/match-classes", methods=["POST"])
def match_classes():
    """Legacy helper: return formatted course and elective match data."""
    data = request.get_json(silent=True) or {}
    res = query_tiger_data("course_advising", data)
    return jsonify({
        "status": "success",
        "matches": res,
    }), 200


@app.route("/api/match-involvement", methods=["POST"])
def match_involvement():
    """Legacy helper: return formatted involvement match data."""
    data = request.get_json(silent=True) or {}
    res = query_tiger_data("campus_involvement", data)
    return jsonify({
        "status": "success",
        "matches": res,
    }), 200


@app.route("/api/submit-quiz", methods=["POST"])
@app.route("/api/submit", methods=["POST"])
def submit_quiz():
    """
    Accept the final questionnaire state (Student or Academic Advisor flow)
    and write it directly into the `users` table in Tiger Data (PostgreSQL).
    """
    payload = request.get_json(silent=True)
    if not payload or not isinstance(payload, dict):
        return jsonify({"error": "Invalid JSON payload provided."}), 400

    role = (payload.get("role") or "").strip().lower() or "student"
    student_data = payload.get("student") or {}
    demographics = student_data.get("demographics") or {}
    aspirations = student_data.get("aspirations") or {}
    coursework = student_data.get("coursework") or {}
    involvement = student_data.get("involvement") or {}
    experience = student_data.get("experience") or {}

    name = demographics.get("name") or payload.get("name") or "Student Assessment"
    college_year = student_data.get("classYear") or payload.get("college_year") or "Freshman"
    major = demographics.get("major") or payload.get("major") or "Computer Science"
    major_track = demographics.get("majorTrack") or payload.get("major_track") or "General"
    gpa = str(demographics.get("gpa") or payload.get("gpa") or "")
    other_school_info = demographics.get("otherCategories") or payload.get("other_school_info") or ""
    target_salary = str(aspirations.get("expectedSalaryUsd") or payload.get("target_salary") or "")
    target_company_industry = (
        aspirations.get("targetCompaniesIndustries") or payload.get("target_company_industry") or ""
    )
    target_location = aspirations.get("targetLocation") or payload.get("target_location") or ""
    career_goals = aspirations.get("careerGoals") or payload.get("career_goals") or ""
    expected_grad_year = str(aspirations.get("expectedGraduationYear") or payload.get("expected_grad_year") or "2028")
    coursework_current = coursework.get("currentClasses") or payload.get("coursework_current") or ""
    coursework_planned = coursework.get("plannedClasses") or payload.get("coursework_planned") or ""
    coursework_past = coursework.get("completedClasses") or payload.get("coursework_past") or ""
    campus_involvement = involvement.get("clubsAndActivities") or payload.get("campus_involvement") or ""
    professional_experience = experience.get("projectsAndSkills") or payload.get("professional_experience") or ""
    advisor_notes = payload.get("advisor_notes") or ""

    db_user_id = None
    created_at_iso = datetime.now(timezone.utc).isoformat()

    if TIGER_DATA_URL:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(USERS_TABLE_DDL)
                    cur.execute(
                        """
                        INSERT INTO users (
                            role, name, college_year, major, major_track, gpa,
                            other_school_info, target_salary, target_company_industry,
                            target_location, career_goals, expected_grad_year,
                            coursework_current, coursework_planned, coursework_past,
                            campus_involvement, professional_experience, advisor_notes
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id, created_at;
                        """,
                        (
                            role, name, college_year, major, major_track, gpa,
                            other_school_info, target_salary, target_company_industry,
                            target_location, career_goals, expected_grad_year,
                            coursework_current, coursework_planned, coursework_past,
                            campus_involvement, professional_experience, advisor_notes,
                        ),
                    )
                    row = cur.fetchone()
                    db_user_id = row[0]
                    created_at_iso = row[1].isoformat() if row[1] else created_at_iso
                conn.commit()
        except Exception as exc:
            print(f"Warning: Writing to users table in Tiger Data failed: {exc}")

    submission_id = f"user-{db_user_id}" if db_user_id is not None else f"sub-{uuid.uuid4().hex[:8]}"
    SUBMISSIONS_STORE[submission_id] = {
        "user_id": db_user_id,
        "submission_id": submission_id,
        "created_at": created_at_iso,
        "role": role,
        "state": payload,
    }

    return jsonify({
        "status": "saved",
        "user_id": db_user_id,
        "submission_id": submission_id,
        "role": role,
        "submitted_at": created_at_iso,
        "message": "Career & academic pathway saved successfully.",
    }), 200


@app.route("/api/cleanup-user", methods=["POST"])
def cleanup_user():
    """
    Clean up session data when user leaves or refreshes the page.
    Executes DELETE FROM users WHERE id = :user_id to remove the abandoned session from Tiger Data.
    """
    payload = request.get_json(silent=True) or {}
    user_id = payload.get("user_id") or payload.get("id")

    # Fallback to parsing raw payload from navigator.sendBeacon
    if not user_id and request.data:
        try:
            data_str = request.data.decode("utf-8")
            parsed = json.loads(data_str)
            if isinstance(parsed, dict):
                user_id = parsed.get("user_id") or parsed.get("id")
        except Exception:
            pass

    if not user_id:
        user_id = request.form.get("user_id") or request.args.get("user_id")

    if not user_id:
        return jsonify({"status": "error", "message": "Missing user_id parameter."}), 400

    # Clean user_id if string with prefix
    if isinstance(user_id, str) and user_id.startswith("user-"):
        user_id = user_id.replace("user-", "")

    deleted_rows = 0
    if TIGER_DATA_URL:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM users WHERE id = %s;", (user_id,))
                    deleted_rows = cur.rowcount
                conn.commit()
        except Exception as exc:
            print(f"Warning: Failed to execute DELETE FROM users WHERE id = {user_id}: {exc}")
            return jsonify({"status": "error", "message": str(exc)}), 500

    # Clean up from local memory submissions store
    for sub_key in [f"user-{user_id}", str(user_id)]:
        if sub_key in SUBMISSIONS_STORE:
            del SUBMISSIONS_STORE[sub_key]

    return jsonify({
        "status": "success",
        "message": f"User session {user_id} deleted successfully from database.",
        "user_id": user_id,
        "deleted_rows": deleted_rows,
    }), 200


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))
    print(f"Starting Legacy Career & Academic Advisory server at http://127.0.0.1:{port}")
    try:
        app.run(host="127.0.0.1", port=port, debug=True)
    except OSError as e:
        if "Address already in use" in str(e) or e.errno == 48:
            fallback_port = 5002
            print(f"Port {port} busy, starting on fallback port http://127.0.0.1:{fallback_port}")
            app.run(host="127.0.0.1", port=fallback_port, debug=True)
        else:
            raise e

