"""
Shared helpers used across pipeline scripts.
"""

import re

# Complete mapping of basketball-reference team abbreviations to full team names.
# Covers all NBA/ABA franchises from the 1960s onward (the scope of this project).
# Source: https://www.basketball-reference.com/teams/
# Note: basketball-reference uses the abbreviation for the team identity at the
# time of the season -- e.g. a player's 2005 row will show NJN (New Jersey Nets),
# while a 2015 row shows BRK (Brooklyn Nets). Both need to be in this mapping.
BBR_TEAM_ABBREV: dict[str, str] = {
    # Current franchises (current identity)
    "ATL": "Atlanta Hawks",
    "BOS": "Boston Celtics",
    "BRK": "Brooklyn Nets",
    "CHO": "Charlotte Hornets",
    "CHI": "Chicago Bulls",
    "CLE": "Cleveland Cavaliers",
    "DAL": "Dallas Mavericks",
    "DEN": "Denver Nuggets",
    "DET": "Detroit Pistons",
    "GSW": "Golden State Warriors",
    "HOU": "Houston Rockets",
    "IND": "Indiana Pacers",
    "LAC": "Los Angeles Clippers",
    "LAL": "Los Angeles Lakers",
    "MEM": "Memphis Grizzlies",
    "MIA": "Miami Heat",
    "MIL": "Milwaukee Bucks",
    "MIN": "Minnesota Timberwolves",
    "NOP": "New Orleans Pelicans",
    "NYK": "New York Knicks",
    "OKC": "Oklahoma City Thunder",
    "ORL": "Orlando Magic",
    "PHI": "Philadelphia 76ers",
    "PHO": "Phoenix Suns",
    "POR": "Portland Trail Blazers",
    "SAC": "Sacramento Kings",
    "SAS": "San Antonio Spurs",
    "TOR": "Toronto Raptors",
    "UTA": "Utah Jazz",
    "WAS": "Washington Wizards",
 
    # Historical / relocated identities
    "SEA": "Seattle SuperSonics",
    "NJN": "New Jersey Nets",
    "NYN": "New York Nets",
    "NOH": "New Orleans Hornets",
    "NOK": "NO/Ok. City Hornets",
    "CHA": "Charlotte Hornets",
    "CHH": "Charlotte Hornets",
    "CHN": "Charlotte Bobcats",
    "VAN": "Vancouver Grizzlies",
    "SDC": "San Diego Clippers",
    "SDR": "San Diego Rockets",
    "SFW": "San Francisco Warriors",
    "PHW": "Philadelphia Warriors",
    "FTW": "Fort Wayne Pistons",
    "MNL": "Minneapolis Lakers",
    "STL": "St. Louis Hawks",
    "MIH": "Milwaukee Hawks",
    "TRI": "Tri-Cities Blackhawks",
    "CIN": "Cincinnati Royals",
    "ROC": "Rochester Royals",
    "KCK": "Kansas City Kings",
    "KCO": "Kansas City-Omaha Kings",
    "CAP": "Capital Bullets",
    "BAL": "Baltimore Bullets",
    "CHZ": "Chicago Zephyrs",
    "CHP": "Chicago Packers",
    "SYR": "Syracuse Nationals",
    "NOJ": "New Orleans Jazz",
    "WSB": "Washington Bullets",
    "BUF": "Buffalo Braves",
 
    # ABA franchises
    "AND": "Anderson Packers",
    "INO": "Indianapolis Olympians",
    "KEN": "Kentucky Colonels",
    "VIR": "Virginia Squires",
    "DNS": "Denver Rockets",
    "UTS": "Utah Stars",
    "FLO": "The Floridians",
    "PTP": "Pittsburgh Pipers",
    "MMP": "Memphis Pros",
    "SSL": "Spirits of St. Louis",
    "WSA": "Washington Capitols",
    "DNA": "Denver Nuggets",
    "MMT": "Memphis Tams",
    "MMS": "Memphis Sounds",
    "NOB": "New Orleans Buccaneers",
    "ANA": "Anaheim Amigos",
    "LAS": "Los Angeles Stars",
}

# Suffixes that basketball-reference strips out before building a slug.
_SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}


def _clean_name_part(name_part: str) -> str:
    """Lowercase and strip everything except a-z (drops apostrophes, periods,
    hyphens, spaces, accents-as-typed, etc.)."""
    return re.sub(r"[^a-z]", "", name_part.lower())


def _strip_suffix(last_name: str) -> str:
    """Remove a trailing suffix token like 'Jr.' / 'III' from a last name
    before slugging, e.g. 'Robinson III' -> 'Robinson'."""
    tokens = last_name.split()
    if len(tokens) > 1 and _clean_name_part(tokens[-1]) in _SUFFIXES:
        return " ".join(tokens[:-1])
    return last_name


def generate_slug(first_name: str, last_name: str, occurrence: int = 1) -> str:
    """Build a basketball-reference-style player slug.

    Formula: first 5 letters of last name + first 2 letters of first name +
    two-digit occurrence number. Punctuation and suffixes are stripped first.

    This is a *best guess* generated locally — it is not guaranteed to match
    basketball-reference's actual occurrence numbering for players who share
    a base slug (e.g. two different "Robinson, G..." players). The scraper
    verifies the name on the fetched page against the expected player and
    falls back to looking up the correct slug from basketball-reference's
    player index when it doesn't match.
    """
    last_clean = _clean_name_part(_strip_suffix(last_name))
    first_clean = _clean_name_part(first_name)

    base = last_clean[:5] + first_clean[:2]
    return f"{base}{occurrence:02d}"


def season_to_decade(season_start_year: int) -> int:
    """Map a season's start year to its decade bucket.

    Convention: a season is assigned to the decade containing its *second*
    year. e.g. the 2009-10 season (season_start_year=2009) ends in 2010,
    so it counts as the 2010s. The 1999-00 season (season_start_year=1999)
    ends in 2000, so it counts as the 2000s.
    """
    season_end_year = season_start_year + 1
    return (season_end_year // 10) * 10