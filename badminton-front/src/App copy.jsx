import React, { useState, useEffect } from "react";
import { Dot } from "lucide-react"; // For server indicator
import PlayerCard from "./components/PlayerCard";
import SponsorDisplay from "./components/SponsorDisplay";

// Main App component
export default function App() {
  const [matchData, setMatchData] = useState(null);
  const [sponsors, setSponsors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMatchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch live match data from Django API
      const matchResponse = await fetch(
        "http://127.0.0.1:8000/api/matches/live/",
        {
          headers: {
            Accept: "application/json",
          },
        }
      );
      if (!matchResponse.ok) {
        throw new Error(
          `Failed to fetch matches: HTTP ${matchResponse.status} ${matchResponse.statusText}`
        );
      }
      const matchData = await matchResponse.json();

      // Check if any live matches are available
      if (!matchData || matchData.length === 0) {
        setError("No live matches available.");
        setIsLoading(false);
        return;
      }

      // Use the first live match
      const match = matchData[0];
      if (!match.player1_team1_detail || !match.player1_team2_detail) {
        throw new Error("Match data incomplete: Missing player details.");
      }

      setMatchData({
        id: match.id,
        tournament: match.tournament_name,
        match_type: match.match_type,
        player1: {
          id: match.player1_team1_detail.id,
          name: match.player1_team1_detail.name,
          country: match.player1_team1_detail.country_name,
          country_code: match.player1_team1_detail.country_code,
          photo_url:
            match.player1_team1_detail.photo_url ||
            `https://placehold.co/120x120/ADD8E6/000000?text=${match.player1_team1_detail.name
              .split(" ")
              .map((n) => n[0])
              .join("")}`,
        },
        player2: {
          id: match.player1_team2_detail.id,
          name: match.player1_team2_detail.name,
          country: match.player1_team2_detail.country_name,
          country_code: match.player1_team2_detail.country_code,
          photo_url:
            match.player1_team2_detail.photo_url ||
            `https://placehold.co/120x120/ADD8E6/000000?text=${match.player1_team2_detail.name
              .split(" ")
              .map((n) => n[0])
              .join("")}`,
        },
        score: {
          game1_player1:
            match.game_scores.find((gs) => gs.game_number === 1)?.team1_score ||
            0,
          game1_player2:
            match.game_scores.find((gs) => gs.game_number === 1)?.team2_score ||
            0,
          game2_player1:
            match.game_scores.find((gs) => gs.game_number === 2)?.team1_score ||
            0,
          game2_player2:
            match.game_scores.find((gs) => gs.game_number === 2)?.team2_score ||
            0,
          game3_player1:
            match.game_scores.find((gs) => gs.game_number === 3)?.team1_score ||
            0,
          game3_player2:
            match.game_scores.find((gs) => gs.game_number === 3)?.team2_score ||
            0,
          current_game: match.current_game,
          player1_sets: match.team1_sets,
          player2_sets: match.team2_sets,
        },
        status: match.status,
        server_id: match.server_detail?.id || null,
      });

      // Fetch sponsors from Django API
      const sponsorResponse = await fetch(
        "http://127.0.0.1:8000/api/sponsors/",
        {
          headers: {
            Accept: "application/json",
          },
        }
      );
      if (!sponsorResponse.ok) {
        throw new Error(
          `Failed to fetch sponsors: HTTP ${sponsorResponse.status} ${sponsorResponse.statusText}`
        );
      }
      const sponsorData = await sponsorResponse.json();
      console.log("Sponsor data:", sponsorData); // Debug log

      // Ensure sponsorData is an array
      const sponsorsArray = Array.isArray(sponsorData.results)
        ? sponsorData.results
        : Array.isArray(sponsorData)
        ? sponsorData
        : [];
      setSponsors(
        sponsorsArray.map((sponsor) => ({
          name: sponsor.name || "Unknown Sponsor",
          logo_url:
            sponsor.logo_url ||
            "https://placehold.co/150x50/F0F8FF/000000?text=Sponsor",
        }))
      );
    } catch (error) {
      console.error("Error fetching data:", error.message);
      setError(`Error fetching match data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const updateScore = async (player) => {
    if (!matchData || matchData.status === "Completed") {
      displayMessage(
        matchData?.status === "Completed"
          ? "Match is already completed!"
          : "No match data available!"
      );
      return;
    }
    try {
      const updatedMatchData = JSON.parse(JSON.stringify(matchData));
      const gameKey = `game${updatedMatchData.score.current_game}`;
      const player1ScoreKey = `${gameKey}_player1`;
      const player2ScoreKey = `${gameKey}_player2`;

      const player1Score = updatedMatchData.score[player1ScoreKey];
      const player2Score = updatedMatchData.score[player2ScoreKey];

      // Check for game end (21 points with 2-point lead, or 30 points cap)
      if (
        (player1Score >= 21 && player1Score - player2Score >= 2) ||
        (player2Score >= 21 && player2Score - player1Score >= 2) ||
        player1Score === 30 ||
        player2Score === 30
      ) {
        // Update sets
        if (player1Score > player2Score) {
          updatedMatchData.score.player1_sets += 1;
        } else {
          updatedMatchData.score.player2_sets += 1;
        }

        // Check for match end (best of 3 games)
        if (
          updatedMatchData.score.player1_sets === 2 ||
          updatedMatchData.score.player2_sets === 2
        ) {
          updatedMatchData.status = "Completed";
          displayMessage(
            `Match Ended! Winner: ${
              updatedMatchData.score.player1_sets >
              updatedMatchData.score.player2_sets
                ? updatedMatchData.player1.name
                : updatedMatchData.player2.name
            }`
          );
        } else {
          // Move to next game
          updatedMatchData.score.current_game += 1;
          updatedMatchData.score[
            `game${updatedMatchData.score.current_game}_player1`
          ] = 0;
          updatedMatchData.score[
            `game${updatedMatchData.score.current_game}_player2`
          ] = 0;
        }
      }
      // Update backend with new scores
      const gameScores = [
        {
          game_number: 1,
          team1_score: updatedMatchData.score.game1_player1,
          team2_score: updatedMatchData.score.game1_player2,
        },
        {
          game_number: 2,
          team1_score: updatedMatchData.score.game2_player1,
          team2_score: updatedMatchData.score.game2_player2,
        },
        {
          game_number: 3,
          team1_score: updatedMatchData.score.game3_player1,
          team2_score: updatedMatchData.score.game3_player2,
        },
      ].filter((gs) => gs.team1_score > 0 || gs.team2_score > 0);

      const response = await fetch(
        `http://127.0.0.1:8000/api/matches/${updatedMatchData.id}/update_score/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            game_scores: gameScores,
            status: updatedMatchData.status,
            team1_sets: updatedMatchData.score.player1_sets,
            team2_sets: updatedMatchData.score.player2_sets,
            current_game: updatedMatchData.score.current_game,
          }),
        }
      );

      console.log(
        "Sending update request with body:",
        JSON.stringify({
          game_scores: gameScores,
          status: updatedMatchData.status,
          team1_sets: updatedMatchData.score.player1_sets,
          team2_sets: updatedMatchData.score.player2_sets,
          current_game: updatedMatchData.score.current_game,
        })
      );

      if (!response.ok) {
        throw new Error(
          `Failed to update score: HTTP ${response.status} ${response.statusText}`
        );
      }

      setMatchData(updatedMatchData);
    } catch (error) {
      console.error("Error updating score:", error.message);
      displayMessage(`Error updating score: ${error.message}`);
    }
  };

  const displayMessage = (message) => {
    const messageBox = document.createElement("div");
    messageBox.className =
      "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50";
    messageBox.textContent = message;
    document.body.appendChild(messageBox);
    setTimeout(() => {
      document.body.removeChild(messageBox);
    }, 3000);
  };

  useEffect(() => {
    fetchMatchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900 text-white">
        <div className="text-xl font-inter">Loading match data...</div>
      </div>
    );
  }

  if (error || !matchData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900 text-white">
        <div className="text-xl font-inter">
          {error || "No match data available."}
        </div>
      </div>
    );
  }

  const { player1, player2, score, tournament, match_type, status, server_id } =
    matchData;
  const isPlayer1Serving = server_id === player1.id;
  const isPlayer2Serving = server_id === player2.id;

  const getGameScore = (gameNum, playerNum) => {
    const scoreKey = `game${gameNum}_player${playerNum}`;
    return score[scoreKey] !== undefined ? score[scoreKey] : "-";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900 text-white font-inter p-4 sm:p-6 md:p-8 flex flex-col items-center">
      {/* Tournament Header */}
      <div className="w-full max-w-4xl text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-yellow-400 mb-2 rounded-lg py-2 px-4 bg-blue-800 shadow-lg">
          {tournament}
        </h1>
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-200 mb-4 rounded-lg py-1 px-3 bg-blue-700 shadow-md">
          {match_type}
        </h2>
      </div>

      {/* Match Score Display Area */}
      <div className="w-full max-w-4xl bg-blue-800 rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 flex flex-col items-center relative overflow-hidden">
        <div className="absolute top-4 right-4 bg-red-600 text-white text-sm font-bold px-3 py-1 rounded-full shadow-md">
          {status}
        </div>

        <div className="flex flex-col sm:flex-row justify-around items-center w-full mb-6 gap-6">
          <PlayerCard player={player1} isServing={isPlayer1Serving} />
          <div className="flex flex-col items-center justify-center text-5xl font-extrabold text-yellow-400 mx-4">
            <span className="text-2xl font-bold text-gray-300">VS</span>
            <div className="flex items-center mt-2">
              <span className="text-6xl font-bold">
                {score[`game${score.current_game}_player1`]}
              </span>
              <span className="text-6xl font-bold mx-2">-</span>
              <span className="text-6xl font-bold">
                {score[`game${score.current_game}_player2`]}
              </span>
            </div>
            <span className="text-xl text-gray-300 mt-1">
              Game {score.current_game}
            </span>
          </div>
          <PlayerCard player={player2} isServing={isPlayer2Serving} />
        </div>

        <div className="w-full flex justify-center mb-6">
          <div className="bg-blue-700 rounded-xl p-4 shadow-inner w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-200 text-center mb-3">
              Set Scores
            </h3>
            <div className="grid grid-cols-5 gap-2 text-center text-gray-300 font-medium">
              <div className="col-span-2">Player</div>
              <div>G1</div>
              <div>G2</div>
              <div>G3</div>
              <div className="font-bold text-yellow-300">Sets</div>
              <div className="col-span-2 text-white font-semibold">
                {player1.name}
              </div>
              <div>{getGameScore(1, 1)}</div>
              <div>{getGameScore(2, 1)}</div>
              <div>{getGameScore(3, 1)}</div>
              <div className="font-bold text-yellow-300">
                {score.player1_sets}
              </div>
              <div className="col-span-2 text-white font-semibold">
                {player2.name}
              </div>
              <div>{getGameScore(1, 2)}</div>
              <div>{getGameScore(2, 2)}</div>
              <div>{getGameScore(3, 2)}</div>
              <div className="font-bold text-yellow-300">
                {score.player2_sets}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => updateScore(1)}
            disabled={status === "Completed"}
            className={`bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transform transition duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-300 ${
              status === "Completed" ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            +1 for {player1.name}
          </button>
          <button
            onClick={() => updateScore(2)}
            disabled={status === "Completed"}
            className={`bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transform transition duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-300 ${
              status === "Completed" ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            +1 for {player2.name}
          </button>
        </div>
      </div>

      <div className="w-full max-w-4xl bg-blue-800 rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 mt-8">
        <h3 className="text-2xl font-bold text-yellow-400 text-center mb-6">
          Our Sponsors
        </h3>
        <div className="flex flex-wrap justify-center items-center gap-6">
          {sponsors.map((sponsor, index) => (
            <SponsorDisplay key={index} sponsor={sponsor} />
          ))}
        </div>
      </div>
    </div>
  );
}
