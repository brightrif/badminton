import React, { useState, useEffect } from "react";
import { Plus, Minus, CheckCircle, Play, Square } from "lucide-react";

export default function ScoringConsole({ matchData, token, onUpdate }) {
  const [localScores, setLocalScores] = useState({
    team1: 0,
    team2: 0,
    game: 1,
  });
  const [loading, setLoading] = useState(false);

  // Sync local state with incoming match data
  useEffect(() => {
    if (matchData && matchData.score) {
      const currentGame = matchData.score.current_game;
      setLocalScores({
        team1: matchData.score[`game${currentGame}_player1`] || 0,
        team2: matchData.score[`game${currentGame}_player2`] || 0,
        game: currentGame,
      });
    }
  }, [matchData]);

  const sendUpdate = async (newT1, newT2, status = null, newSets = null) => {
    setLoading(true);

    // Construct the payload for update_score endpoint
    const payload = {
      game_scores: [
        {
          game_number: localScores.game,
          team1_score: newT1,
          team2_score: newT2,
        },
      ],
    };

    // If we need to update status (e.g. Finish Match)
    if (status) payload.status = status;
    // If we need to update sets (logic should be calculated, simplified here)
    if (newSets) {
      payload.team1_sets = newSets.t1;
      payload.team2_sets = newSets.t2;
    }

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/matches/${matchData.id}/update_score/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (res.ok) {
        const updated = await res.json();
        onUpdate(); // Trigger parent refresh
      }
    } catch (err) {
      console.error("Failed to update score", err);
    } finally {
      setLoading(false);
    }
  };

  const adjustScore = (team, delta) => {
    let t1 = localScores.team1;
    let t2 = localScores.team2;

    if (team === 1) t1 = Math.max(0, t1 + delta);
    if (team === 2) t2 = Math.max(0, t2 + delta);

    // Optimistic update
    setLocalScores((prev) => ({ ...prev, team1: t1, team2: t2 }));

    // Debounce or send immediately? Sending immediately for simplicity
    sendUpdate(t1, t2);
  };

  const handleMatchAction = async (action) => {
    const endpoint = action === "start" ? "start_match" : "finish_match";
    try {
      await fetch(
        `http://127.0.0.1:8000/api/matches/${matchData.id}/${endpoint}/`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white text-gray-900 border-t-4 border-yellow-400 p-4 shadow-[0_-5px_20px_rgba(0,0,0,0.3)] z-40">
      <div className="max-w-4xl mx-auto flex flex-col gap-4">
        {/* Header Controls */}
        <div className="flex justify-between items-center border-b pb-2">
          <span className="font-bold text-lg text-gray-600">
            UMPIRE CONSOLE
          </span>
          <div className="flex gap-2">
            {matchData.status === "Upcoming" && (
              <button
                onClick={() => handleMatchAction("start")}
                className="flex items-center gap-1 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
              >
                <Play size={16} /> Start Match
              </button>
            )}
            {matchData.status === "Live" && (
              <button
                onClick={() => handleMatchAction("finish")}
                className="flex items-center gap-1 bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
              >
                <Square size={16} /> End Match
              </button>
            )}
          </div>
        </div>

        {/* Scoring Controls */}
        <div className="flex justify-between items-center gap-4">
          {/* Player 1 Controls */}
          <div className="flex-1 flex flex-col items-center bg-blue-50 p-2 rounded-lg">
            <h4 className="font-bold text-blue-900 truncate w-full text-center">
              {matchData.player1.name}
            </h4>
            <div className="flex items-center gap-4 mt-2">
              <button
                onClick={() => adjustScore(1, -1)}
                className="p-3 bg-gray-200 rounded-full hover:bg-gray-300"
              >
                <Minus size={20} />
              </button>
              <span className="text-4xl font-bold text-blue-800 w-16 text-center">
                {localScores.team1}
              </span>
              <button
                onClick={() => adjustScore(1, 1)}
                className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 shadow-lg"
              >
                <Plus size={24} />
              </button>
            </div>
          </div>

          {/* Game Info */}
          <div className="flex flex-col items-center px-4">
            <span className="text-sm font-bold text-gray-400">GAME</span>
            <span className="text-2xl font-black">{localScores.game}</span>
          </div>

          {/* Player 2 Controls */}
          <div className="flex-1 flex flex-col items-center bg-red-50 p-2 rounded-lg">
            <h4 className="font-bold text-red-900 truncate w-full text-center">
              {matchData.player2.name}
            </h4>
            <div className="flex items-center gap-4 mt-2">
              <button
                onClick={() => adjustScore(2, -1)}
                className="p-3 bg-gray-200 rounded-full hover:bg-gray-300"
              >
                <Minus size={20} />
              </button>
              <span className="text-4xl font-bold text-red-800 w-16 text-center">
                {localScores.team2}
              </span>
              <button
                onClick={() => adjustScore(2, 1)}
                className="p-3 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg"
              >
                <Plus size={24} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
