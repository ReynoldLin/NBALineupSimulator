"""
One-time migration script: copies all data from SQLite to PostgreSQL.

Run from backend/ with POSTGRES_URL environment variable set:
    $env:POSTGRES_URL = "postgresql://..."
    python migrate_to_postgres.py
"""

import os
import sqlite3
import psycopg2
from psycopg2.extras import execute_values

SQLITE_PATH = "data/nba.db"
POSTGRES_URL = os.environ.get("POSTGRES_URL")

if not POSTGRES_URL:
    raise ValueError("POSTGRES_URL environment variable not set")

# Tables in order (parent tables first to satisfy foreign keys)
TABLES = [
    "teams",
    "players",
    "player_season_stats",
    "player_team_decade_stats",
    "lineups",
    "lineup_picks",
]


def get_sqlite_data(sqlite_conn, table: str):
    cur = sqlite_conn.cursor()
    cur.execute(f"SELECT * FROM {table}")
    rows = cur.fetchall()
    cols = [desc[0] for desc in cur.description]
    return cols, rows


def create_postgres_tables():
    """Create tables using raw psycopg2 connection."""
    import urllib.parse
    result = urllib.parse.urlparse(POSTGRES_URL)
    conn = psycopg2.connect(
        host=result.hostname,
        port=result.port,
        user=result.username,
        password=result.password,
        dbname=result.path[1:],
        sslmode="require"
    )
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("DROP TABLE IF EXISTS player_team_decade_stats CASCADE;")
    
    # Create tables in order
    cur.execute("""
        CREATE TABLE IF NOT EXISTS teams (
            team_id BIGINT PRIMARY KEY,
            abbreviation VARCHAR(10) UNIQUE,
            full_name VARCHAR(100)
        );
        
        CREATE TABLE IF NOT EXISTS players (
            player_id BIGINT PRIMARY KEY,
            full_name VARCHAR(100),
            slug VARCHAR(20) UNIQUE,
            nba_api_id BIGINT UNIQUE,
            is_active BOOLEAN,
            positions VARCHAR(50),
            headshot_url VARCHAR(200)
        );
        
        CREATE TABLE IF NOT EXISTS player_season_stats (
            id SERIAL PRIMARY KEY,
            player_id BIGINT REFERENCES players(player_id),
            team_id BIGINT REFERENCES teams(team_id),
            season_start_year INTEGER,
            decade INTEGER,
            position VARCHAR(10),
            awards VARCHAR(100),
            games_played INTEGER,
            games_started INTEGER,
            minutes_played INTEGER,
            fg INTEGER, fga INTEGER,
            fg3 INTEGER, fg3a INTEGER,
            ft INTEGER, fta INTEGER,
            trb INTEGER, ast INTEGER,
            stl INTEGER, blk INTEGER,
            tov INTEGER, pts INTEGER,
            dws REAL DEFAULT 0.0,
            UNIQUE(player_id, team_id, season_start_year)
        );
        
        CREATE TABLE IF NOT EXISTS player_team_decade_stats (
            id SERIAL PRIMARY KEY,
            player_id BIGINT REFERENCES players(player_id),
            team_id BIGINT REFERENCES teams(team_id),
            decade INTEGER,
            games_played INTEGER,
            pts_per_game REAL, reb_per_game REAL,
            ast_per_game REAL, stl_per_game REAL,
            blk_per_game REAL, tov_per_game REAL,
            fg_pct REAL, fg3_pct REAL, ft_pct REAL,
            total_fg3a INTEGER, dws_per_season REAL,
            awards TEXT,
            scoring_rating REAL, shooting_rating REAL,
            playmaking_rating REAL, defense_rating REAL,
            rebounding_rating REAL,
            UNIQUE(player_id, team_id, decade)
        );
        
        CREATE TABLE IF NOT EXISTS lineups (
            lineup_id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(100),
            record VARCHAR(10),
            created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS lineup_picks (
            id SERIAL PRIMARY KEY,
            lineup_id VARCHAR(36) REFERENCES lineups(lineup_id),
            slot_number INTEGER,
            position VARCHAR(5),
            is_starter BOOLEAN,
            team_id BIGINT REFERENCES teams(team_id),
            decade INTEGER,
            player_id BIGINT REFERENCES players(player_id)
        );
    """)
    
    cur.close()
    conn.close()
    print("Tables created in PostgreSQL.")


def migrate_table(sqlite_conn, pg_cursor, table: str):
    cols, rows = get_sqlite_data(sqlite_conn, table)
    
    if not rows:
        print(f"  {table}: no rows, skipping")
        return

    # Columns that need boolean casting
    bool_cols = {
        "players": ["is_active"],
        "lineup_picks": ["is_starter"],
    }

    bool_indices = []
    if table in bool_cols:
        bool_indices = [cols.index(col) for col in bool_cols[table] if col in cols]

    # Convert integer booleans to Python bools
    converted_rows = []
    for row in rows:
        row = list(row)
        for idx in bool_indices:
            row[idx] = bool(row[idx])
        converted_rows.append(tuple(row))

    col_str = ", ".join(cols)
    
    execute_values(
        pg_cursor,
        f"INSERT INTO {table} ({col_str}) VALUES %s ON CONFLICT DO NOTHING",
        converted_rows,
        page_size=500,
    )
    print(f"  {table}: {len(converted_rows)} rows migrated")


def main():
    print(f"Using PostgreSQL URL: {POSTGRES_URL[:30]}...")  # only prints first 30 chars for security

    print("Connecting to SQLite...")
    sqlite_conn = sqlite3.connect(SQLITE_PATH)

    print("Creating PostgreSQL tables...")
    create_postgres_tables()

    print("Connecting to PostgreSQL...")
    pg_conn = psycopg2.connect(POSTGRES_URL)
    pg_cursor = pg_conn.cursor()

    print("Migrating tables...")
    for table in TABLES:
        try:
            migrate_table(sqlite_conn, pg_cursor, table)
        except Exception as e:
            print(f"  ERROR on {table}: {e}")
            pg_conn.rollback()
            continue

    pg_conn.commit()
    pg_cursor.close()
    pg_conn.close()
    sqlite_conn.close()
    print("Migration complete.")


if __name__ == "__main__":
    main()