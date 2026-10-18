"""
database.py
Database connection and session handling for ClimateAdapt Pune.
Configures SQLAlchemy with connection pooling, session lifecycle management,
and non-destructive table inspection.
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables from backend/.env or root
backend_dir = Path(__file__).resolve().parent.parent
env_file = backend_dir / ".env"
load_dotenv(dotenv_path=env_file)

# Construct connection URL from individual variables if DATABASE_URL is not provided
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    db_user = os.getenv("DB_USER", "postgres")
    db_pass = os.getenv("DB_PASSWORD", "postgres")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "climateadapt_pune")
    DATABASE_URL = f"postgresql+psycopg2://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

# Initialize engine with robust connection pooling and timeouts for local development
engine = None
SessionLocal = None
DB_ONLINE = False
DB_INIT_ERROR = None

try:
    engine = create_engine(
        DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        pool_timeout=10,
        pool_recycle=1800,
        pool_pre_ping=True,
        echo=False
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    # Quick connectivity check without printing credentials
    with engine.connect() as test_conn:
        test_conn.execute(text("SELECT 1"))
    DB_ONLINE = True
except Exception as e:
    DB_ONLINE = False
    DB_INIT_ERROR = type(e).__name__
    print(f"[!] Warning: Could not initialize PostgreSQL engine: {DB_INIT_ERROR}")

Base = declarative_base()

def get_db():
    """
    FastAPI dependency yielding a SQLAlchemy session with guaranteed cleanup.
    Yields None if the database engine is offline.
    """
    if SessionLocal is None or not DB_ONLINE:
        yield None
        return
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def check_db_connectivity() -> tuple[bool, str, dict]:
    """
    Executes a live ping (SELECT 1) and checks PostGIS availability.
    Returns (is_connected: bool, message: str, details: dict).
    Never exposes passwords or sensitive credentials.
    """
    if engine is None:
        return False, f"Engine not initialized ({DB_INIT_ERROR or 'unknown'})", {}
    
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            # Check PostGIS version if available
            try:
                pgis_ver = conn.execute(text("SELECT PostGIS_Version()")).scalar()
            except Exception:
                pgis_ver = None
            
            # Inspect table row counts
            inspector = inspect(engine)
            existing_tables = inspector.get_table_names()
            
            table_counts = {}
            for target in ["pune_electoral_wards", "pune_nallas", "pune_swd_chambers"]:
                if target in existing_tables:
                    cnt = conn.execute(text(f"SELECT COUNT(*) FROM {target}")).scalar()
                    table_counts[target] = cnt

            return True, "Database online and responsive", {
                "postgis_version": pgis_ver,
                "verified_tables": table_counts
            }
    except Exception as e:
        return False, f"Connection failed: {type(e).__name__}", {}

def init_db():
    """
    Inspects existing database schema and connection health without calling create_all().
    """
    connected, msg, details = check_db_connectivity()
    if connected:
        print(f"[+] Database connection verified. PostGIS: {details.get('postgis_version')}")
        print(f"[+] Verified tables: {details.get('verified_tables')}")
        return True
    else:
        print(f"[!] Database connectivity issue: {msg}")
        return False
