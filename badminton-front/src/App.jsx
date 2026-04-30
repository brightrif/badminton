import React, { useState, useEffect } from "react";
import { Dot, Monitor, RefreshCw } from "lucide-react";
import PlayerCard from "./components/PlayerCard";
import SponsorDisplay from "./components/SponsorDisplay";

const API_BASE = "http://127.0.0.1:8000/api";

export default function App() {
  const [matchData, setMatchData] = useState(null);
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [minutesLeft, setMinutesLeft] = useState(null);

  // DYNAMIC COURTS STATE
  const [availableCourts, setAvailableCourts] = useState([]); // List of all courts from API
  const [selectedCourtId, setSelectedCourtId] = useState(null); // The specific court this screen is showing (by ID)
  const [courtsLoading, setCourtsLoading] = useState(true);

  // 1. Fetch the list of Courts once on mount
  useEffect(() => {
    const fetchCourts = async () => {
      try {
        const res = await fetch(`${API_BASE}/courts/`);
        if (!res.ok) throw new Error("Could not fetch courts list");

        const data = await res.json();
        const courtsArray = data.results || data || [];

        setAvailableCourts(courtsArray);

        // Default to the first court if none selected yet
        if (courtsArray.length > 0 && !selectedCourtId) {
          setSelectedCourtId(courtsArray[0].id);
        }
      } catch (err) {
        console.error("Error fetching courts:", err);
        // Fallback for demo/testing if API fails
        const fallbackCourts = [
          { id: 1, name: "Court 1" },
          { id: 2, name: "Court 2" },
        ];
        setAvailableCourts(fallbackCourts);
        if (!selectedCourtId) setSelectedCourtId(1);
      } finally {
        setCourtsLoading(false);
      }
    };
    fetchCourts();
  }, []);

  // 2. Fetch Matches & Filter by Selected Court NAME
  useEffect(() => {
    if (!selectedCourtId || availableCourts.length === 0) return;

    // Get the name of the selected court using the ID
    const selectedCourt = availableCourts.find((c) => c.id === selectedCourtId);
    const selectedCourtName = selectedCourt ? selectedCourt.name : null;

    if (!selectedCourtName) return;

    const fetchLiveMatch = async () => {
      try {
        setLoading(true);

        // A. Get Live matches
        const matchRes = await fetch(`${API_BASE}/matches/live/`);
        const data = await matchRes.json();
        const liveMatchesArray = data.results || data || [];

        // FILTER: Find the match using the court_name string
        let targetMatch = liveMatchesArray.find(
          (m) => m.court_name === selectedCourtName
        );

        let currentIsLive = true;

        if (targetMatch) {
          console.log(`Found Live match for Court: ${selectedCourtName}`);
        } else {
          // B. No live match for this court? Check upcoming.
          console.log(
            `No live match for Court ${selectedCourtName}, checking upcoming...`
          );
          currentIsLive = false;

          const upcomingRes = await fetch(`${API_BASE}/matches/upcoming`);
          const upcomingData = await upcomingRes.json();
          const upcomingArray = upcomingData.results || upcomingData || [];

          // FILTER: Find upcoming match using the court_name string
          targetMatch = upcomingArray.find(
            (m) => m.court_name === selectedCourtName
          );

          if (targetMatch) {
            setIsLive(false);
          } else {
            // C. No matches at all for this court
            setMatchData(null);
            setLoading(false);
            return;
          }
        }

        setIsLive(currentIsLive);

        // 3. Get sponsors for this match's tournament
        const sponsorsRes = await fetch(
          `${API_BASE}/sponsors/?tournament=${targetMatch.tournament}`
        );
        const sponsorsJson = await sponsorsRes.json();
        const tournamentSponsors = sponsorsJson.results || sponsorsJson;

        // Transform Data (Ensures Doubles logic is correct)
        const transformed = {
          id: targetMatch.id,
          tournament: targetMatch.tournament_name,
          match_type: targetMatch.match_type.replace("_", " ") + " - Final",
          player1: {
            id: targetMatch.player1_team1_detail.id,
            name: targetMatch.player1_team1_detail.name,
            country: targetMatch.player1_team1_detail.country_name || "Unknown",
            country_code: targetMatch.player1_team1_detail.country_code || "",
            photo_url:
              targetMatch.player1_team1_detail.photo_url ||
              "https://placehold.co/120x120/888/fff?text=" +
                targetMatch.player1_team1_detail.name.charAt(0),
          },
          player1_secondary:
            targetMatch.match_type.toLowerCase().includes("double") &&
            targetMatch.player2_team1_detail
              ? {
                  id: targetMatch.player2_team1_detail.id,
                  name: targetMatch.player2_team1_detail.name,
                  country:
                    targetMatch.player2_team1_detail.country_name || "Unknown",
                  country_code:
                    targetMatch.player2_team1_detail.country_code || "",
                  photo_url:
                    targetMatch.player2_team1_detail.photo_url ||
                    "https://placehold.co/120x120/888/fff?text=" +
                      targetMatch.player2_team1_detail.name.charAt(0),
                }
              : null,
          player2: {
            id: targetMatch.player1_team2_detail.id,
            name: targetMatch.player1_team2_detail.name,
            country: targetMatch.player1_team2_detail.country_name || "Unknown",
            country_code: targetMatch.player1_team2_detail.country_code || "",
            photo_url:
              targetMatch.player1_team2_detail.photo_url ||
              "https://placehold.co/120x120/888/fff?text=" +
                targetMatch.player1_team2_detail.name.charAt(0),
          },
          player2_secondary:
            targetMatch.match_type.toLowerCase().includes("double") &&
            targetMatch.player2_team2_detail
              ? {
                  id: targetMatch.player2_team2_detail.id,
                  name: targetMatch.player2_team2_detail.name,
                  country:
                    targetMatch.player2_team2_detail.country_name || "Unknown",
                  country_code:
                    targetMatch.player2_team2_detail.country_code || "",
                  photo_url:
                    targetMatch.player2_team2_detail.photo_url ||
                    "https://placehold.co/120x120/888/fff?text=" +
                      targetMatch.player2_team2_detail.name.charAt(0),
                }
              : null,
          score: {
            game1_player1:
              targetMatch.game_scores.find((g) => g.game_number === 1)
                ?.team1_score || 0,
            game1_player2:
              targetMatch.game_scores.find((g) => g.game_number === 1)
                ?.team2_score || 0,
            game2_player1:
              targetMatch.game_scores.find((g) => g.game_number === 2)
                ?.team1_score || 0,
            game2_player2:
              targetMatch.game_scores.find((g) => g.game_number === 2)
                ?.team2_score || 0,
            game3_player1:
              targetMatch.game_scores.find((g) => g.game_number === 3)
                ?.team1_score || 0,
            game3_player2:
              targetMatch.game_scores.find((g) => g.game_number === 3)
                ?.team2_score || 0,
            current_game: targetMatch.current_game,
            player1_sets: targetMatch.team1_sets,
            player2_sets: targetMatch.team2_sets,
          },
          scheduled_time: targetMatch.scheduled_time,
          status: targetMatch.status,
          server_id:
            targetMatch.server_detail?.id ||
            targetMatch.player1_team1_detail.id,
        };

        setMatchData(transformed);
        setSponsors(
          tournamentSponsors.map((s) => ({
            name: s.name,
            logo_url: s.logo_url,
          }))
        );
      } catch (err) {
        console.error(err);
        setMatchData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchLiveMatch();
    const interval = setInterval(fetchLiveMatch, 8000); // Poll every 8 seconds
    return () => clearInterval(interval);
  }, [selectedCourtId, availableCourts]); // Re-run when court selection changes

  // Countdown Timer
  useEffect(() => {
    let timer;
    if (matchData && !isLive && matchData.scheduled_time) {
      const targetTime = new Date(matchData.scheduled_time).getTime();
      const calculateTimeLeft = () => {
        const now = Date.now();
        const diff = targetTime - now;
        if (diff <= 0) {
          setMinutesLeft({ minutes: 0, seconds: 0 });
          clearInterval(timer);
          return;
        }
        setMinutesLeft({
          minutes: Math.floor(Math.floor(diff / 1000) / 60),
          seconds: Math.floor(diff / 1000) % 60,
        });
      };
      calculateTimeLeft();
      timer = setInterval(calculateTimeLeft, 1000);
    } else {
      setMinutesLeft(null);
    }
    return () => clearInterval(timer);
  }, [matchData, isLive]);

  // -- RENDER HELPERS: Court Selector Component --
  const CourtSelector = () => (
    <div className="absolute top-4 left-4 z-50 bg-black/30 hover:bg-black/50 transition-colors backdrop-blur-md py-1 px-3 rounded-full border border-white/10 flex items-center gap-2 group shadow-xl">
      <Monitor className="w-4 h-4 text-yellow-400 group-hover:animate-pulse" />
      <select
        value={selectedCourtId || ""}
        onChange={(e) => setSelectedCourtId(Number(e.target.value))}
        className="bg-transparent text-sm text-gray-200 font-bold outline-none cursor-pointer appearance-none pr-4 uppercase tracking-wide"
        disabled={courtsLoading || availableCourts.length === 0}
      >
        {courtsLoading ? (
          <option className="text-black">Loading Courts...</option>
        ) : (
          availableCourts.map((court) => (
            <option key={court.id} value={court.id} className="text-black">
              {court.name}
            </option>
          ))
        )}
      </select>
    </div>
  );

  // -- RENDER: Initial Court Selection Screen (if no default is set) --
  if (!selectedCourtId && !courtsLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-blue-900 text-white">
        <h1 className="text-2xl mb-4">Select a Court to Display</h1>
        <div className="bg-white text-black p-4 rounded shadow-2xl">
          {availableCourts.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCourtId(c.id)}
              className="block w-full text-left py-2 px-4 hover:bg-gray-200 border-b last:border-b-0 font-semibold"
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // -- RENDER: No Match/Idle Screen --
  if (!loading && !matchData) {
    const currentCourtName =
      availableCourts.find((c) => c.id === selectedCourtId)?.name ||
      "Selected Court";
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-indigo-900 text-white relative">
        <CourtSelector />
        <div className="text-center p-8 bg-blue-800/50 rounded-2xl border border-white/10 backdrop-blur-sm">
          <RefreshCw className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-spin-slow" />
          <div className="text-3xl font-bold opacity-90">Court Idle</div>
          <p className="text-gray-300 mt-2 text-lg">
            Waiting for matches on{" "}
            <span className="text-yellow-400 font-bold">
              {currentCourtName}
            </span>
            ...
          </p>
        </div>
      </div>
    );
  }

  // -- RENDER: Loading Spinner --
  if (loading && !matchData) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-indigo-900">
        <div className="text-white text-3xl animate-pulse">
          Loading Match...
        </div>
      </div>
    );
  }

  // -- RENDER: Main Scoreboard --

  // Destructure Data
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

  const isPlayer1Serving =
    server_id === player1.id || server_id === player1_secondary?.id;
  const getGameScore = (g, p) =>
    score[`game${g}_player${p}`] !== undefined
      ? score[`game${g}_player${p}`]
      : "-";

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-blue-900 to-indigo-900 text-white font-sans p-4 flex flex-col items-center gap-4 relative">
      {/* Dynamic Court Selector */}
      <CourtSelector />

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
            <div className="bg-blue-800/50 border border-blue-400/30 rounded-xl p-8 shadow-lg text-center w-full max-w-lg backdrop-blur-sm">
              <h3 className="text-2xl sm:text-3xl font-bold text-yellow-400 animate-pulse mb-3">
                Match Starts Shortly
              </h3>
              {minutesLeft &&
              (minutesLeft.minutes > 0 || minutesLeft.seconds > 0) ? (
                <p className="text-blue-200 text-xl mt-4">
                  Match starts in:{" "}
                  <span className="block text-4xl sm:text-5xl font-extrabold text-yellow-300 mt-2 tracking-widest animate-pulse">
                    {String(minutesLeft.minutes).padStart(2, "0")} :{" "}
                    {String(minutesLeft.seconds).padStart(2, "0")}
                  </span>
                </p>
              ) : (
                <p className="text-blue-200 text-lg">
                  Checking for live updates...
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
      </div>

      {/* Sponsors */}
      <div className="w-full max-w-5xl bg-blue-800 rounded-2xl shadow-2xl p-4 flex-shrink-0">
        <h3 className="text-xl font-bold text-yellow-400 text-center mb-4">
          Our Sponsors
        </h3>
        <div className="flex flex-wrap justify-center items-center gap-6">
          {sponsors.length > 0 ? (
            sponsors.map((s, i) => <SponsorDisplay key={i} sponsor={s} />)
          ) : (
            <p className="text-gray-400">Loading sponsors...</p>
          )}
        </div>
      </div>
    </div>
  );
}
