import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg

load_dotenv()

DATA_DIR = Path(__file__).resolve().parent / "hackumbc-2026-main" / "data"

SCHEMA_SQL = """
DROP TABLE IF EXISTS student_experience CASCADE;
DROP TABLE IF EXISTS employment_history CASCADE;
DROP TABLE IF EXISTS transcripts CASCADE;
DROP TABLE IF EXISTS students_current CASCADE;
DROP TABLE IF EXISTS alumni CASCADE;
DROP TABLE IF EXISTS course_catalog CASCADE;

CREATE TABLE course_catalog (
    course_id TEXT PRIMARY KEY,
    subject TEXT,
    catalog_number TEXT,
    course_title TEXT,
    credits INTEGER,
    course_level TEXT,
    course_type TEXT,
    required_for_majors TEXT,
    prerequisite_ids TEXT,
    skill_tags TEXT,
    difficulty_index NUMERIC(4,2),
    typical_terms_offered TEXT
);

CREATE TABLE alumni (
    campus_id TEXT PRIMARY KEY,
    major TEXT,
    degree_level TEXT,
    track TEXT,
    graduation_term TEXT,
    graduation_year INTEGER,
    entry_type TEXT,
    time_to_degree_years NUMERIC(4,2),
    total_credits_earned INTEGER,
    final_gpa NUMERIC(4,2),
    major_gpa NUMERIC(4,2),
    residency TEXT,
    holds_prior_umbc_bachelors BOOLEAN,
    work_hours_per_week_while_enrolled INTEGER,
    internship_count INTEGER,
    credential_count INTEGER,
    engagement_activity_count INTEGER,
    net_cost_usd INTEGER,
    total_loans_usd INTEGER,
    first_destination TEXT,
    months_to_first_job TEXT,
    first_job_title TEXT,
    first_job_family TEXT,
    first_employer TEXT,
    first_employer_industry TEXT,
    first_job_region TEXT,
    first_job_annual_salary_usd TEXT,
    first_job_is_remote TEXT,
    first_job_found_via TEXT
);

CREATE TABLE students_current (
    campus_id TEXT PRIMARY KEY,
    entry_term TEXT,
    entry_type TEXT,
    major TEXT,
    track TEXT,
    second_major TEXT,
    minor TEXT,
    class_level TEXT,
    residency TEXT,
    enrollment_intensity TEXT,
    is_first_generation BOOLEAN,
    work_hours_per_week INTEGER,
    credits_earned INTEGER,
    credits_required INTEGER,
    cumulative_gpa TEXT,
    major_gpa TEXT,
    academic_standing TEXT,
    expected_graduation_term TEXT,
    internship_count INTEGER,
    credential_count INTEGER,
    engagement_activity_count INTEGER,
    tuition_paid_to_date_usd INTEGER
);

CREATE TABLE transcripts (
    campus_id TEXT,
    term TEXT,
    course_id TEXT REFERENCES course_catalog(course_id),
    course_title TEXT,
    subject TEXT,
    credits_attempted INTEGER,
    credits_earned INTEGER,
    grade TEXT,
    grade_points TEXT,
    is_repeat BOOLEAN,
    requirement_category TEXT
);

CREATE TABLE employment_history (
    job_id TEXT PRIMARY KEY,
    campus_id TEXT REFERENCES alumni(campus_id),
    employer TEXT,
    employer_industry TEXT,
    employer_size TEXT,
    job_title TEXT,
    job_family TEXT,
    seniority_level TEXT,
    region TEXT,
    cost_of_living_index NUMERIC(5,2),
    is_remote BOOLEAN,
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN,
    tenure_months INTEGER,
    annual_salary_usd INTEGER,
    change_type TEXT,
    requires_clearance BOOLEAN,
    role_skill_tags TEXT
);

CREATE TABLE student_experience (
    record_id TEXT PRIMARY KEY,
    campus_id TEXT,
    experience_type TEXT,
    experience_name TEXT,
    organization TEXT,
    industry TEXT,
    term TEXT,
    duration_terms INTEGER,
    hours_per_week TEXT,
    is_paid TEXT,
    role_level TEXT,
    outcome TEXT
);

CREATE INDEX idx_transcripts_campus_id ON transcripts(campus_id);
CREATE INDEX idx_transcripts_course_id ON transcripts(course_id);
CREATE INDEX idx_employment_history_campus_id ON employment_history(campus_id);
CREATE INDEX idx_student_experience_campus_id ON student_experience(campus_id);
"""

TABLES_AND_FILES = [
    ("course_catalog", "course_catalog.csv"),
    ("alumni", "alumni.csv"),
    ("students_current", "students_current.csv"),
    ("transcripts", "transcripts.csv"),
    ("employment_history", "employment_history.csv"),
    ("student_experience", "student_experience.csv"),
]


def import_all(conn_url: str) -> None:
    print("Connecting to Tiger Data (PostgreSQL)...", flush=True)
    with psycopg.connect(conn_url, autocommit=False) as conn:
        with conn.cursor() as cur:
            print("Creating schema and tables...", flush=True)
            cur.execute(SCHEMA_SQL)

            for table_name, filename in TABLES_AND_FILES:
                csv_path = DATA_DIR / filename
                if not csv_path.exists():
                    raise FileNotFoundError(f"Missing CSV file: {csv_path}")

                print(f"Importing {filename} -> {table_name}...", flush=True)
                copy_sql = f"COPY {table_name} FROM STDIN WITH (FORMAT csv, HEADER true, NULL '')"
                with csv_path.open("r", encoding="utf-8") as f:
                    with cur.copy(copy_sql) as copy:
                        while chunk := f.read(65536):
                            copy.write(chunk)

                cur.execute(f"SELECT COUNT(*) FROM {table_name}")
                count = cur.fetchone()[0]
                print(f"  ✓ {table_name}: {count:,} rows imported", flush=True)

        conn.commit()
    print("\nAll HackUMBC 2026 tables successfully imported into Tiger Data!", flush=True)


if __name__ == "__main__":
    url = (
        sys.argv[1]
        if len(sys.argv) > 1
        else os.getenv("TIGER_DATA_URL") or os.getenv("DATABASE_URL") or os.getenv("TIMESCALE_SERVICE_URL")
    )
    if not url:
        print(
            "Error: No Tiger Data connection URL found.\n"
            "Please set TIGER_DATA_URL (or DATABASE_URL) in .env or pass it as an argument:\n"
            "  .venv/bin/python import_to_tiger_data.py 'postgres://tsdbadmin:...'"
        )
        sys.exit(1)

    import_all(url)
