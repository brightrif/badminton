import React from "react";
import { Award } from "lucide-react";

export default function PlayerCard({ player, secondaryPlayer, isServing }) {
  // Common function to render country flag/code
  const CountryBadge = ({ countryCode, countryName }) => (
    <div className="flex items-center gap-2 mt-1 bg-black/30 rounded px-2 py-0.5 text-xs text-gray-300">
      {countryCode && (
        <img
          //src={`https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`}
          src={`https://flagcdn.com/w40/bh.png`}
          alt={countryName}
          className="w-5 h-auto rounded-sm"
        />
      )}
      <span>{countryName}</span>
    </div>
  );

  return (
    <div className="flex flex-col items-center relative">
      {/* Serving Indicator */}
      {isServing && (
        <div className="absolute -top-8 animate-bounce text-yellow-400 flex flex-col items-center z-10">
          <div className="bg-yellow-500/20 p-1 rounded-full">
            <div className="w-3 h-3 bg-yellow-400 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.8)]" />
          </div>
          <span className="text-xs font-bold tracking-wider mt-1 text-yellow-200/80">
            SERVING
          </span>
        </div>
      )}

      {/* -- DOUBLES LAYOUT -- */}
      {secondaryPlayer ? (
        <div className="flex gap-4">
          {/* Player 1 */}
          <div className="flex flex-col items-center">
            <div
              className={`relative p-1 rounded-full ${
                isServing
                  ? "bg-gradient-to-b from-yellow-400 to-transparent"
                  : "bg-transparent"
              }`}
            >
              <img
                src={player.photo_url}
                alt={player.name}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-blue-500 shadow-xl"
              />
            </div>
            <h2 className="text-lg font-bold text-white mt-3 text-center leading-tight max-w-[120px]">
              {player.name}
            </h2>
            <CountryBadge
              //countryCode={player.country_code}
              countryName={player.country}
            />
          </div>

          {/* Player 2 (Partner) */}
          <div className="flex flex-col items-center">
            <div
              className={`relative p-1 rounded-full ${
                isServing
                  ? "bg-gradient-to-b from-yellow-400 to-transparent"
                  : "bg-transparent"
              }`}
            >
              <img
                src={secondaryPlayer.photo_url}
                alt={secondaryPlayer.name}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-blue-500 shadow-xl"
              />
            </div>
            <h2 className="text-lg font-bold text-white mt-3 text-center leading-tight max-w-[120px]">
              {secondaryPlayer.name}
            </h2>
            <CountryBadge
              countryCode={secondaryPlayer.country_code}
              countryName={secondaryPlayer.country}
            />
          </div>
        </div>
      ) : (
        /* -- SINGLES LAYOUT (Original) -- */
        <div className="flex flex-col items-center">
          <div
            className={`relative p-1.5 rounded-full ${
              isServing
                ? "bg-gradient-to-b from-yellow-400 to-transparent"
                : "bg-transparent"
            }`}
          >
            <img
              src={player.photo_url}
              alt={player.name}
              className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-4 border-blue-500 shadow-2xl"
            />
            {/* Optional Winner Badge if needed later */}
            {/* <Award className="w-8 h-8 text-yellow-400 absolute bottom-0 right-0 drop-shadow-lg" /> */}
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-white mt-4 text-center tracking-wide">
            {player.name}
          </h2>

          <div className="flex items-center gap-2 mt-2 bg-blue-900/40 px-3 py-1 rounded-full border border-blue-500/30">
            {player.country_code && (
              <img
                src={`https://flagcdn.com/w40/bh.png`}
                alt={player.country}
                className="w-6 h-auto rounded-sm shadow-sm"
              />
            )}
            <p className="text-blue-200 font-medium text-sm tracking-wider uppercase">
              {player.country}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
