import React, { useState, useEffect } from "react";
import { Dot } from "lucide-react";
import PlayerCard from "./components/PlayerCard";
import SponsorDisplay from "./components/SponsorDisplay";

const API_BASE = "http://127.0.0.1:8000/api"; // Change if deployed

export default function App() {
  const [matchData, setMatchData] = useState(null);
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLive, setIsLive] = useState(true); // ← ONLY NEW STATE
  const [minutesLeft, setMinutesLeft] = useState(null);

  // Fetch a LIVE match + sponsors
  useEffect(() => {
    const fetchLiveMatch = async () => {
      try {
        // 1. Get any Live match
        const matchRes = await fetch(`${API_BASE}/matches/live/`, {
          headers: {
            Accept: "application/json",
          },
        });
        // 2. Parse the data immediately
        const data = await matchRes.json();
        const liveMatchesArray = data.results || data || [];

        let liveMatch;
        let currentIsLive = true;
        if (!matchRes.ok || liveMatchesArray.length === 0) {
          // No live match → get the next upcoming one
          currentIsLive = false;
          const upcomingRes = await fetch(`${API_BASE}/matches/upcoming`);
          const upcomingData = await upcomingRes.json();
          const upcomingArray = upcomingData.results || upcomingData || [];

          if (upcomingArray.length === 0) {
            setMatchData(null);
            setLoading(false);
            return;
          }

          liveMatch = upcomingArray[0];
          setIsLive(false); // ← NEW flag
        } else {
          //liveMatch = await matchRes.json();
          liveMatch = liveMatchesArray[0];
        }
        setIsLive(currentIsLive); // ← NEW flag
        //const matchRes = await fetch(`${API_BASE}/matches/live`);
        //if (!matchRes.ok) throw new Error("Network error");

        //const data = await matchRes.json();

        // DRF can return: {results: [...]}, or direct array if pagination is off
        //const matchesArray = data.results || data || [];

        //if (matchesArray.length === 0)
        // throw new Error("No live match right now");
        //const liveMatch = matchesArray[0]; // ← this will always work now

        // 2. Get sponsors for this tournament
        const sponsorsRes = await fetch(
          `${API_BASE}/sponsors/?tournament=${liveMatch.tournament}`
        );
        const sponsorsJson = await sponsorsRes.json();
        const tournamentSponsors = sponsorsJson.results || sponsorsJson;
        // Transform API data → your frontend format
        const transformed = {
          id: liveMatch.id,
          tournament: liveMatch.tournament_name,
          match_type: liveMatch.match_type.replace("_", " ") + " - Final", // or remove "Final"
          player1: {
            id: liveMatch.player1_team1_detail.id,
            name: liveMatch.player1_team1_detail.name,
            country: liveMatch.player1_team1_detail.country_name || "Unknown",
            country_code: liveMatch.player1_team1_detail.country_code || "",
            photo_url:
              liveMatch.player1_team1_detail.photo_url ||
              "https://placehold.co/120x120/888/fff?text=" +
                liveMatch.player1_team1_detail.name.charAt(0),
          },
          // NEW: Secondary Player for Team 1 (only if match_type is DOUBLES)
          player1_secondary:
            liveMatch.match_type.toLowerCase().includes("double") &&
            liveMatch.player2_team1_detail
              ? {
                  id: liveMatch.player2_team1_detail.id,
                  name: liveMatch.player2_team1_detail.name,
                  country:
                    liveMatch.player2_team1_detail.country_name || "Unknown",
                  country_code:
                    liveMatch.player2_team1_detail.country_code || "",
                  photo_url:
                    liveMatch.player2_team1_detail.photo_url ||
                    "https://placehold.co/120x120/888/fff?text=" +
                      liveMatch.player2_team1_detail.name.charAt(0),
                }
              : null,
          player2: {
            id: liveMatch.player1_team2_detail.id,
            name: liveMatch.player1_team2_detail.name,
            country: liveMatch.player1_team2_detail.country_name || "Unknown",
            country_code: liveMatch.player1_team2_detail.country_code || "",
            photo_url:
              liveMatch.player1_team2_detail.photo_url ||
              "https://placehold.co/120x120/888/fff?text=" +
                liveMatch.player1_team2_detail.name.charAt(0),
          },
          // NEW: Secondary Player for Team 2 (only if match_type is DOUBLES)
          player2_secondary:
            liveMatch.match_type.toLowerCase().includes("double") &&
            liveMatch.player2_team2_detail
              ? {
                  id: liveMatch.player2_team2_detail.id,
                  name: liveMatch.player2_team2_detail.name,
                  country:
                    liveMatch.player2_team2_detail.country_name || "Unknown",
                  country_code:
                    liveMatch.player2_team2_detail.country_code || "",
                  photo_url:
                    liveMatch.player2_team2_detail.photo_url ||
                    "https://placehold.co/120x120/888/fff?text=" +
                      liveMatch.player2_team2_detail.name.charAt(0),
                }
              : null,
          score: {
            game1_player1:
              liveMatch.game_scores.find((g) => g.game_number === 1)
                ?.team1_score || 0,
            game1_player2:
              liveMatch.game_scores.find((g) => g.game_number === 1)
                ?.team2_score || 0,
            game2_player1:
              liveMatch.game_scores.find((g) => g.game_number === 2)
                ?.team1_score || 0,
            game2_player2:
              liveMatch.game_scores.find((g) => g.game_number === 2)
                ?.team2_score || 0,
            game3_player1:
              liveMatch.game_scores.find((g) => g.game_number === 3)
                ?.team1_score || 0,
            game3_player2:
              liveMatch.game_scores.find((g) => g.game_number === 3)
                ?.team2_score || 0,
            current_game: liveMatch.current_game,
            player1_sets: liveMatch.team1_sets,
            player2_sets: liveMatch.team2_sets,
          },
          scheduled_time: liveMatch.scheduled_time,
          status: liveMatch.status,
          server_id:
            liveMatch.server_detail?.id || liveMatch.player1_team1_detail.id,
        };

        setMatchData(transformed);
        setSponsors(
          tournamentSponsors.map((s) => ({
            name: s.name,
            logo_url: s.logo_url,
          }))
        );

        // Calculate minutes left if upcoming

        // End of minutes left calc
      } catch (err) {
        console.error(err);
        setError(err.message);
        // Keep dummy data as fallback so UI doesn't break
        setMatchData({
          id: 101,
          tournament: "No Live Match Found",
          match_type: "Waiting for match...",
          player1: {
            id: 1,
            name: "Player 1",
            country: "TBD",
            country_code: "??",
            photo_url: "https://placehold.co/120x120/666/fff?text=?",
          },
          player2: {
            id: 2,
            name: "Player 2",
            country: "TBD",
            country_code: "??",
            photo_url: "https://placehold.co/120x120/666/fff?text=?",
          },
          score: {
            game1_player1: 0,
            game1_player2: 0,
            game2_player1: 0,
            game2_player2: 0,
            game3_player1: 0,
            game3_player2: 0,
            current_game: 1,
            player1_sets: 0,
            player2_sets: 0,
          },
          status: "Upcoming",
          server_id: 1,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchLiveMatch();
    const interval = setInterval(fetchLiveMatch, 8000); // Auto-refresh every 8 seconds
    return () => clearInterval(interval);
  }, []);

  // Dedicated useEffect for real-time countdown
  useEffect(() => {
    let timer;

    // Only run if we have data and it's an upcoming match
    if (matchData && !isLive && matchData.scheduled_time) {
      const targetTime = new Date(matchData.scheduled_time).getTime();

      const calculateTimeLeft = () => {
        const now = Date.now();
        const diff = targetTime - now; // Time difference in ms

        if (diff <= 0) {
          setMinutesLeft({ minutes: 0, seconds: 0 }); // Set to 00:00
          clearInterval(timer); // Stop the timer
          // The main 8-second poll will check if the match status changed to 'Live'
          return;
        }

        // Convert ms to minutes and seconds
        const totalSeconds = Math.floor(diff / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        setMinutesLeft({ minutes, seconds });
      };

      calculateTimeLeft(); // Initial calculation
      timer = setInterval(calculateTimeLeft, 1000); // Update every second
    } else {
      // Clear the countdown if match is live or scheduled_time is missing
      setMinutesLeft(null);
    }

    // Cleanup function: clears the interval when component unmounts or dependencies change
    return () => clearInterval(timer);
  }, [matchData, isLive]); // Runs when match data or live status changes
  // Dedicated useEffect for real-time countdown ends here

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-indigo-900">
        <div className="text-white text-3xl">Loading Live Match...</div>
      </div>
    );
  }

  if (!matchData) return null;

  const {
    player1,
    player2,
    score,
    tournament,
    match_type,
    status,
    server_id,
    player1_secondary,
    player2_secondary,
  } = matchData;

  // Check if Player 1 or their partner is serving (safer check for doubles)
  //const isPlayer1Serving = server_id === player1.id;
  const isPlayer1Serving =
    server_id === player1.id || server_id === player1_secondary?.id;
  // New flag to simplify doubles checks in JSX
  //const isDoubles = match_type.toLowerCase().includes("double");

  const getGameScore = (gameNum, playerNum) => {
    const key = `game${gameNum}_player${playerNum}`;
    return score[key] !== undefined ? score[key] : "-";
  };

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-blue-900 to-indigo-900 text-white font-sans p-4 flex flex-col items-center gap-4">
      {/* Tournament Header */}
      <div className="w-full max-w-5xl text-center flex-shrink-0">
        <h1 className="text-3xl sm:text-4xl font-bold text-yellow-400 mb-2 rounded-lg py-2 px-4 bg-blue-800 shadow-lg">
          {tournament}
        </h1>
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-200 rounded-lg py-1 px-3 bg-blue-700 shadow-md">
          {match_type}
        </h2>
      </div>

      {/* Main Scoreboard */}
      <div className="w-full max-w-5xl bg-blue-800 rounded-2xl shadow-2xl p-4 flex flex-col items-center justify-around relative overflow-hidden flex-grow">
        <div className="absolute top-4 right-4 bg-red-600 text-white text-sm font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-2">
          <Dot className="w-8 h-8 animate-pulse" />
          {status}
        </div>

        <div className="flex flex-col sm:flex-row justify-around items-center w-full gap-6">
          <PlayerCard
            player={player1}
            secondaryPlayer={player1_secondary}
            isServing={isPlayer1Serving}
          />
          <div className="flex flex-col items-center justify-center text-5xl font-extrabold text-yellow-400 mx-4">
            <span className="text-2xl font-bold text-gray-300">VS</span>
            <div className="flex items-center mt-2">
              <span className="text-6xl font-bold">
                {score[`game${score.current_game}_player1`]}
              </span>
              <span className="text-6xl font-bold mx-2">–</span>
              <span className="text-6xl font-bold">
                {score[`game${score.current_game}_player2`]}
              </span>
            </div>
            <span className="text-xl text-gray-300 mt-1">
              Game {score.current_game}
            </span>
          </div>
          <PlayerCard
            player={player2}
            secondaryPlayer={player2_secondary}
            isServing={!isPlayer1Serving}
          />
        </div>

        {/* Set Scores Table */}
        <div className="w-full flex justify-center mt-6">
          {isLive ? (
            /* 1. SHOW THIS IF LIVE */
            <div className="bg-blue-700 rounded-xl p-3 shadow-inner w-full max-w-lg">
              <h3 className="text-lg font-semibold text-gray-200 text-center mb-2">
                Set Scores
              </h3>
              <div className="grid grid-cols-6 gap-2 text-center text-gray-300 font-medium items-center">
                <div className="col-span-2 text-left pl-2">Player</div>
                <div>G1</div>
                <div>G2</div>
                <div>G3</div>
                <div className="font-bold text-yellow-300">Sets</div>

                <div className="col-span-2 text-white font-semibold text-left pl-2 truncate text-sm sm:text-base">
                  {player1.name}{" "}
                  {player1_secondary && `& ${player1_secondary.name}`}
                </div>
                <div className="bg-blue-900/50 rounded py-1">
                  {getGameScore(1, 1)}
                </div>
                <div className="bg-blue-900/50 rounded py-1">
                  {getGameScore(2, 1)}
                </div>
                <div className="bg-blue-900/50 rounded py-1">
                  {getGameScore(3, 1)}
                </div>
                <div className="font-bold text-yellow-300 text-lg">
                  {score.player1_sets}
                </div>

                <div className="col-span-2 text-white font-semibold text-left pl-2 truncate text-sm sm:text-base">
                  {player2.name}{" "}
                  {player2_secondary && `& ${player2_secondary.name}`}
                </div>
                <div className="bg-blue-900/50 rounded py-1">
                  {getGameScore(1, 2)}
                </div>
                <div className="bg-blue-900/50 rounded py-1">
                  {getGameScore(2, 2)}
                </div>
                <div className="bg-blue-900/50 rounded py-1">
                  {getGameScore(3, 2)}
                </div>
                <div className="font-bold text-yellow-300 text-lg">
                  {score.player2_sets}
                </div>
              </div>
            </div>
          ) : (
            /* 2. SHOW THIS IF UPCOMING */
            <div className="bg-blue-800/50 border border-blue-400/30 rounded-xl p-8 shadow-lg text-center w-full max-w-lg backdrop-blur-sm">
              <h3 className="text-2xl sm:text-3xl font-bold text-yellow-400 animate-pulse mb-3">
                Match Starts Shortly
              </h3>
              {/* Countdown message */}

              {/* Conditional Countdown Display */}
              {minutesLeft &&
              (minutesLeft.minutes > 0 || minutesLeft.seconds > 0) ? (
                <p className="text-blue-200 text-xl mt-4">
                  The Match will start in:
                  <span className="block text-4xl sm:text-5xl font-extrabold text-yellow-300 mt-2 tracking-widest animate-pulse">
                    {String(minutesLeft.minutes).padStart(2, "0")} :{" "}
                    {String(minutesLeft.seconds).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-semibold text-gray-400 block mt-1">
                    Minutes : Seconds
                  </span>
                </p>
              ) : (
                <p className="text-blue-200 text-lg">
                  The match is due to start now. Checking for live updates...
                </p>
              )}
              <div className="mt-4 text-sm text-gray-400 bg-blue-900/40 py-2 px-4 rounded-full inline-block">
                Scheduled:{" "}
                {new Date(
                  matchData.scheduled_time || Date.now()
                ).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          )}
        </div>
        {/*end of Main Scoreboard */}
      </div>

      {/* Sponsors */}
      <div className="w-full max-w-5xl bg-blue-800 rounded-2xl shadow-2xl p-4 flex-shrink-0">
        <h3 className="text-xl font-bold text-yellow-400 text-center mb-4">
          Our Sponsors
        </h3>
        <div className="flex flex-wrap justify-center items-center gap-6">
          {sponsors.length > 0 ? (
            sponsors.map((sponsor, i) => (
              <SponsorDisplay key={i} sponsor={sponsor} />
            ))
          ) : (
            <p className="text-gray-400">Loading sponsors...</p>
          )}
        </div>
      </div>
    </div>
  );
}
