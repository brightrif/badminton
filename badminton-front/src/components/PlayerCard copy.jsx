import React from "react";
import { Dot } from "lucide-react";

function PlayerCard({ player, isServing }) {
  return (
    <div className="flex flex-col items-center bg-blue-700 rounded-xl p-4 shadow-lg w-full sm:w-64 relative">
      {isServing && (
        <span className="absolute top-2 right-2 text-green-400 animate-pulse">
          <Dot size={40} />
        </span>
      )}
      <img
        src={player.photo_url}
        alt={player.name}
        className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-yellow-400 object-cover mb-3 shadow-md"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = `https://placehold.co/120x120/ADD8E6/000000?text=${player.name
            .split(" ")
            .map((n) => n[0])
            .join("")}`;
        }}
      />
      <h3 className="text-xl sm:text-2xl font-bold text-white text-center mb-1">
        {player.name}
      </h3>
      <p className="text-md sm:text-lg text-gray-300 text-center">
        {player.country} ({player.country_code})
      </p>
    </div>
  );
}

export default PlayerCard;
