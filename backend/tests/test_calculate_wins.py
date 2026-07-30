from app.calculate_wins import PlayerRatings, score_pair, score_sf, score_team_coverage, score_bench_coverage, calculate_wins

def make_player(pos: str, is_starter: bool, rating: float = 25.0) -> PlayerRatings:
    """Helper to create a player with uniform ratings."""
    return PlayerRatings(
        player_id=1,
        full_name="Test Player",
        position=pos,
        is_starter=is_starter,
        scoring=rating,
        shooting=rating,
        playmaking=rating,
        defense=rating,
        rebounding=rating,
    )

def make_player_custom(pos: str, is_starter: bool, scoring=25.0, shooting=25.0, 
                        playmaking=25.0, defense=25.0, rebounding=25.0) -> PlayerRatings:
    return PlayerRatings(
        player_id=1, full_name="Test", position=pos, is_starter=is_starter,
        scoring=scoring, shooting=shooting, playmaking=playmaking,
        defense=defense, rebounding=rebounding,
    )

# Test worst possible lineup
worst_lineup = [
    make_player("PG", True, 25.0),
    make_player("SG", True, 25.0),
    make_player("SF", True, 25.0),
    make_player("PF", True, 25.0),
    make_player("C",  True, 25.0),
    make_player("PG", False, 25.0),
    make_player("SG", False, 25.0),
    make_player("SF", False, 25.0),
    make_player("PF", False, 25.0),
    make_player("C",  False, 25.0),
]

# Test best possible lineup
best_lineup = [
    make_player("PG", True, 99.0),
    make_player("SG", True, 99.0),
    make_player("SF", True, 99.0),
    make_player("PF", True, 99.0),
    make_player("C",  True, 99.0),
    make_player("PG", False, 99.0),
    make_player("SG", False, 99.0),
    make_player("SF", False, 99.0),
    make_player("PF", False, 99.0),
    make_player("C",  False, 99.0),
]

if __name__ == "__main__":
    print("--- Worst lineup ---")
    result = calculate_wins(worst_lineup)
    print(f"Record: {result.record}")
    print(f"Backcourt: {result.backcourt_score}")
    print(f"Frontcourt: {result.frontcourt_score}")
    print(f"Coverage: {result.coverage_score}")
    print(f"Bench: {result.bench_coverage_score}")

    print("\n--- Best lineup ---")
    result = calculate_wins(best_lineup)
    print(f"Record: {result.record}")
    print(f"Backcourt: {result.backcourt_score}")
    print(f"Frontcourt: {result.frontcourt_score}")
    print(f"Coverage: {result.coverage_score}")
    print(f"Bench: {result.bench_coverage_score}")