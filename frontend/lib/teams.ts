export const TEAM_COLORS: Record<number, string> = {
  1610612737: "#E03A3E", // Atlanta Hawks
  1610612738: "#007A33", // Boston Celtics
  1610612787: "#000000", // Brooklyn Nets
  1610612770: "#1D1160", // Charlotte Hornets
  1610612741: "#CE1141", // Chicago Bulls
  1610612739: "#860038", // Cleveland Cavaliers
  1610612742: "#00538C", // Dallas Mavericks
  1610612743: "#0E2240", // Denver Nuggets
  1610612765: "#C8102E", // Detroit Pistons
  1610612744: "#1d428a", // Golden State Warriors
  1610612745: "#CE1141", // Houston Rockets
  1610612754: "#002D62", // Indiana Pacers
  1610612746: "#C8102E", // LA Clippers
  1610612747: "#552583", // Los Angeles Lakers
  1610612763: "#5D76A9", // Memphis Grizzlies
  1610612748: "#98002E", // Miami Heat
  1610612749: "#00471B", // Milwaukee Bucks
  1610612750: "#0C2340", // Minnesota Timberwolves
  1610612740: "#0C2340", // New Orleans Pelicans
  1610612752: "#006BB6", // New York Knicks
  1610612760: "#007AC1", // Oklahoma City Thunder
  1610612753: "#0077C0", // Orlando Magic
  1610612755: "#006BB6", // Philadelphia 76ers
  1610612767: "#E56020", // Phoenix Suns
  1610612757: "#E03A3E", // Portland Trail Blazers
  1610612758: "#5A2D81", // Sacramento Kings
  1610612759: "#000000", // San Antonio Spurs
  1610612761: "#CE1141", // Toronto Raptors
  1610612762: "#002B5C", // Utah Jazz
  1610612764: "#002B5C", // Washington Wizards
};

export function teamBg(teamId: number): string {
  const color = TEAM_COLORS[teamId];
  if (!color) return "#F5F5F5";
  return `${color}25`; // ~7% opacity for table background
}

export function teamHeaderBg(teamId: number): string {
  const color = TEAM_COLORS[teamId];
  if (!color) return "#F0F0F0";
  return `${color}`;
}

export const TEAM_NAMES: Record<number, string> = {
  1610612737: "Atlanta Hawks",
  1610612738: "Boston Celtics", 
  1610612787: "Brooklyn Nets",
  1610612770: "Charlotte Hornets",
  1610612741: "Chicago Bulls",
  1610612739: "Cleveland Cavaliers",
  1610612742: "Dallas Mavericks",
  1610612743: "Denver Nuggets",
  1610612765: "Detroit Pistons", 
  1610612744: "Golden State Warriors",
  1610612745: "Houston Rockets",
  1610612754: "Indiana Pacers", 
  1610612746: "LA Clippers",
  1610612747: "Los Angeles Lakers",
  1610612763: "Memphis Grizzlies",
  1610612748: "Miami Heat",
  1610612749: "Milwaukee Bucks",
  1610612750: "Minnesota Timberwolves",
  1610612740: "New Orleans Pelicans",
  1610612752: "New York Knicks",
  1610612760: "Oklahoma City Thunder",
  1610612753: "Orlando Magic",
  1610612755: "Philadelphia 76ers",
  1610612767: "Phoenix Suns",
  1610612757: "Portland Trail Blazers",
  1610612758: "Sacramento Kings",
  1610612759: "San Antonio Spurs",
  1610612761: "Toronto Raptors",
  1610612762: "Utah Jazz",
  1610612764: "Washington Wizards", 
}