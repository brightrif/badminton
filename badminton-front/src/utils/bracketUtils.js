// src/utils/bracketUtils.js
//
// Pure utility functions for bracket display.
// Extracted from BracketTree.jsx so Fast Refresh works correctly.

/**
 * Groups bracket matches by round number.
 * Returns { [roundNumber]: BracketMatch[] }
 */
export function groupByRound(bms) {
  return bms.reduce((acc, bm) => {
    if (!acc[bm.round_number]) acc[bm.round_number] = [];
    acc[bm.round_number].push(bm);
    return acc;
  }, {});
}

/**
 * Returns a human-readable round name.
 * e.g. roundName(3, 4) → "Semi-Final"
 */
export function roundName(roundNum, totalRounds) {
  const fromEnd = totalRounds - roundNum + 1;
  return (
    {
      1: "Final",
      2: "Semi-Final",
      3: "Quarter-Final",
      4: "Round of 16",
      5: "Round of 32",
    }[fromEnd] || `Round ${roundNum}`
  );
}
