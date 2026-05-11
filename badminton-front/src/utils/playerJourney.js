// src/utils/playerJourney.js
//
// Pure utility functions for building a player's journey across all events
// in a tournament, derived entirely from the MatchListSerializer[] array.
//
// No API calls. No React hooks. Works for both KNOCKOUT and ROUND ROBIN events.
// Used by TournamentDetail (schedule page panel) and can be used by any future
// page that has the match list in memory.
//
// ─────────────────────────────────────────────────────────────────────────────
// Main exports:
//
//   getPlayerMatches(matches, playerName)
//     → MatchListSerializer[]  sorted by scheduled_time
//
//   buildPlayerJourney(matches, playerName)
//     → { matches, stats, eventGroups }
//
//   matchContainsPlayer(match, playerName)
//     → boolean
//
//   getPlayerSide(match, playerName)
//     → 1 | 2 | null   (1 = team1, 2 = team2)
//
//   getMatchResult(match, playerName)
//     → "won" | "lost" | "live" | "upcoming" | null
//
//   getOpponentName(match, playerName)
//     → string  (opponent display name)
//
// ─────────────────────────────────────────────────────────────────────────────

// ── Core helpers ──────────────────────────────────────────────────────────────

/**
 * Returns true if the player's name appears in any of the four player
 * name fields of a match. Case-insensitive substring match so "Ali"
 * matches "Ali Hassan".
 */
export function matchContainsPlayer(match, playerName) {
  if (!playerName || !playerName.trim()) return false;
  const q = playerName.trim().toLowerCase();
  return [
    match.player1_team1_name,
    match.player2_team1_name,
    match.player1_team2_name,
    match.player2_team2_name,
  ]
    .filter(Boolean)
    .some((name) => name.toLowerCase().includes(q));
}

/**
 * Returns which side (team) the player is on.
 *   1 → player is on team 1 (player1_team1 or player2_team1)
 *   2 → player is on team 2 (player1_team2 or player2_team2)
 *   null → not found
 */
export function getPlayerSide(match, playerName) {
  if (!playerName) return null;
  const q = playerName.trim().toLowerCase();

  const onTeam1 = [match.player1_team1_name, match.player2_team1_name]
    .filter(Boolean)
    .some((n) => n.toLowerCase().includes(q));

  if (onTeam1) return 1;

  const onTeam2 = [match.player1_team2_name, match.player2_team2_name]
    .filter(Boolean)
    .some((n) => n.toLowerCase().includes(q));

  if (onTeam2) return 2;
  return null;
}

/**
 * Builds a human-readable display name for a team from the match.
 * Singles  → "Ali Hassan"
 * Doubles  → "Ali Hassan / Raj Kumar"
 */
export function getTeamName(match, side) {
  const names =
    side === 1
      ? [match.player1_team1_name, match.player2_team1_name]
      : [match.player1_team2_name, match.player2_team2_name];
  return names.filter(Boolean).join(" / ") || "TBD";
}

/**
 * Returns the opponent's display name from the player's perspective.
 * E.g. if player is on team 1, returns team 2's name.
 */
export function getOpponentName(match, playerName) {
  const side = getPlayerSide(match, playerName);
  if (!side) return "TBD";
  return getTeamName(match, side === 1 ? 2 : 1);
}

/**
 * Returns the match result from the player's perspective.
 *   "won"      → match is Completed and player's team won
 *   "lost"     → match is Completed and player's team lost
 *   "live"     → match is Live
 *   "upcoming" → match is Upcoming or no status
 */
export function getMatchResult(match, playerName) {
  const side = getPlayerSide(match, playerName);
  if (!side) return null;

  if (match.status === "Live") return "live";
  if (match.status === "Upcoming") return "upcoming";

  if (match.status === "Completed") {
    const myScore = side === 1 ? match.team1_sets : match.team2_sets;
    const oppScore = side === 1 ? match.team2_sets : match.team1_sets;
    if (myScore === null || myScore === undefined) return "upcoming";
    return myScore > oppScore ? "won" : "lost";
  }

  return "upcoming";
}

/**
 * Returns the sets score string from the player's perspective.
 * e.g. "2–1" (my sets – opponent sets)
 * Returns null if match hasn't been played.
 */
export function getSetsScore(match, playerName) {
  if (match.status !== "Completed") return null;
  const side = getPlayerSide(match, playerName);
  if (!side) return null;
  const myScore = side === 1 ? match.team1_sets : match.team2_sets;
  const oppScore = side === 1 ? match.team2_sets : match.team1_sets;
  if (myScore === null || myScore === undefined) return null;
  return `${myScore}–${oppScore}`;
}

/**
 * Formats a scheduled_time string for display.
 * e.g. "Sun 11 May · 10:30 AM"
 */
export function formatMatchTime(scheduledTime) {
  if (!scheduledTime) return null;
  const d = new Date(scheduledTime);
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Main journey builder ──────────────────────────────────────────────────────

/**
 * Filters the full match list to matches involving the player.
 * Returns them sorted by scheduled_time ascending.
 */
export function getPlayerMatches(matches, playerName) {
  if (!playerName || !matches?.length) return [];
  return matches
    .filter((m) => matchContainsPlayer(m, playerName))
    .sort((a, b) => {
      if (!a.scheduled_time) return 1;
      if (!b.scheduled_time) return -1;
      return new Date(a.scheduled_time) - new Date(b.scheduled_time);
    });
}

/**
 * Builds a full journey object for a player across all events.
 *
 * Returns:
 * {
 *   playerName  : string
 *   matches     : enrichedMatch[]     ← each match with derived fields added
 *   stats       : {
 *     total     : number
 *     won       : number
 *     lost      : number
 *     live      : number
 *     upcoming  : number
 *     winRate   : number   (0–100, null if no completed matches)
 *   }
 *   eventGroups : {
 *     [eventName]: enrichedMatch[]    ← grouped by event_name
 *   }
 *   isStillPlaying : boolean
 *   isEliminated   : boolean          (has a loss and no upcoming matches)
 * }
 *
 * enrichedMatch adds:
 *   _side       : 1 | 2
 *   _result     : "won" | "lost" | "live" | "upcoming"
 *   _opponent   : string
 *   _myTeam     : string
 *   _setsScore  : "2–1" | null
 *   _timeLabel  : string | null
 */
export function buildPlayerJourney(matches, playerName) {
  const playerMatches = getPlayerMatches(matches, playerName);

  // Enrich each match with derived fields
  const enriched = playerMatches.map((m) => {
    const side = getPlayerSide(m, playerName);
    const result = getMatchResult(m, playerName);
    return {
      ...m,
      _side: side,
      _result: result,
      _opponent: getOpponentName(m, playerName),
      _myTeam: getTeamName(m, side),
      _setsScore: getSetsScore(m, playerName),
      _timeLabel: formatMatchTime(m.scheduled_time),
    };
  });

  // Stats
  const won = enriched.filter((m) => m._result === "won").length;
  const lost = enriched.filter((m) => m._result === "lost").length;
  const live = enriched.filter((m) => m._result === "live").length;
  const upcoming = enriched.filter((m) => m._result === "upcoming").length;
  const completed = won + lost;
  const winRate = completed > 0 ? Math.round((won / completed) * 100) : null;

  // Group by event_name (preserving chronological order within each group)
  const eventGroups = enriched.reduce((acc, m) => {
    const key = m.event_name || "General";
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  const isStillPlaying = live > 0 || upcoming > 0;
  const isEliminated = lost > 0 && upcoming === 0 && live === 0;

  return {
    playerName,
    matches: enriched,
    stats: { total: enriched.length, won, lost, live, upcoming, winRate },
    eventGroups,
    isStillPlaying,
    isEliminated,
  };
}
