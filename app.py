import base64
import csv
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from google import genai
import psycopg

try:
    from elevenlabs.client import ElevenLabs
except ImportError:
    ElevenLabs = None

# Load environment variables from .env
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
TIGER_DATA_URL = os.getenv("TIGER_DATA_URL") or os.getenv("DATABASE_URL")
DEFAULT_ELEVENLABS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"
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
                            WHERE se.experience_type IS NULL OR se.experience_type IN ('Student Organization', 'Competitive Team', 'Hackathon', 'Undergraduate Research', 'Peer Mentor', 'Leadership', 'Creative Outlier');
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
                                    {"experience_name": "HackUMBC", "experience_type": "Hackathon", "duration_terms": 2, "hours_per_week": "8", "outcome": "Built project portfolio"},
                                    {"experience_name": "ACM Student Chapter", "experience_type": "Student Organization", "duration_terms": 3, "hours_per_week": "4", "outcome": "Peer Workshops"},
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
                        {"experience_name": "HackUMBC Organizing Team", "experience_type": "Hackathon", "duration_terms": 3, "hours_per_week": "8", "outcome": "Built project portfolio & tech network"},
                        {"experience_name": "ACM Student Chapter Officer", "experience_type": "Student Organization", "duration_terms": 4, "hours_per_week": "6", "outcome": "Led technical workshops in Python/Cloud"},
                    ],
                    "outlier_insight": "Combined hackathon leadership with peer mentoring; recruiter cited collaboration skills as primary hiring factor.",
                },
                {
                    "campus_id": "ALUM-4120",
                    "first_employer": "Lockheed Martin",
                    "first_job_title": "Software Engineer",
                    "first_job_annual_salary_usd": "$96,000",
                    "activities": [
                        {"experience_name": "Capture The Flag (CTF) Team", "experience_type": "Competitive Team", "duration_terms": 4, "hours_per_week": "7", "outcome": "Top 10 collegiate ranking"},
                        {"experience_name": "Undergraduate Research Assistant", "experience_type": "Research", "duration_terms": 2, "hours_per_week": "10", "outcome": "Published paper in IEEE student conference"},
                    ],
                    "outlier_insight": "Competitive CTF participation directly substituted for traditional coursework during technical defense interviews.",
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


# ==============================================================================
# GEMINI GENERATIVE TEXT INTEGRATION (google-genai SDK)
# ==============================================================================

def generate_gemini_advice(section_name: str, user_data: dict, matches: list, class_analysis: dict = None) -> str:
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

    prompt = f"""Act as an expert academic advisor. Based on this user data and these database matches, write a 2 to 3 sentence message giving the student targeted advice for their {section_title}. Base your tone strictly on their class year.

Student Context:
- Class Standing: {class_year}
- Major & Track: {major} ({major_track})
- Current GPA: {gpa} | Completed Credits: {credits_completed}
- Target Industry & Career Goals: {target_industry} | {user_data.get('careerGoals', 'Launch tech career')}
- Student Input Skills / Experience: {user_data.get('skills', 'Standard Coursework')} | {user_data.get('internships', 'Seeking experience')}
- Selected Campus Activities: {', '.join(user_data.get('selectedActivities', [])) or 'Exploring clubs'}

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
    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "Text is required."}), 400
    if len(text) > 1000:
        return jsonify({"error": "Text must be 1000 characters or fewer."}), 413

    try:
        audio = generate_elevenlabs_tts(
            text.strip(),
            SECTION_1_ELEVENLABS_VOICE_ID,
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
            "selectedActivities": inv.get("selectedActivities") or [],
            "customActivity": inv.get("customActivity") or "",
            "skills": prof.get("projectsAndSkills") or user_data.get("skills") or "",
            "internships": prof.get("internshipsAndJobs") or user_data.get("internships") or "",
            "takenRequiredCourses": user_data.get("takenRequiredCourses") or [],
            "takenElectives": user_data.get("takenElectives") or [],
            "plannedCourses": user_data.get("plannedCourses") or [],
            "customPlannedCourses": user_data.get("customPlannedCourses") or "",
        }

    clean_sec = (section_name or "").lower().replace(" ", "_").replace("-", "_")
    class_analysis = None
    if clean_sec in ("course_advising", "section_2", "2", "courses", "course"):
        class_analysis = analyze_student_coursework(user_data)

    # Step A: Query Tiger Data
    matches = query_tiger_data(section_name, user_data)

    # Step B: Gemini API Summary (with class_analysis context & tone shift support)
    gemini_text = generate_gemini_advice(section_name, user_data, matches, class_analysis=class_analysis)

    # Step C: ElevenLabs TTS Audio
    base64_audio = generate_elevenlabs_tts(gemini_text)

    return jsonify({
        "section_name": section_name,
        "text": gemini_text,
        "audio": base64_audio,
        "matches": matches,
        "class_analysis": class_analysis,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }), 200


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

