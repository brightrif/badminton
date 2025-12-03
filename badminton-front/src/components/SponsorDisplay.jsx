import React from "react";

function SponsorDisplay({ sponsor }) {
  return (
    <div className="bg-white rounded-lg p-3 shadow-md flex items-center justify-center h-15 w-36 sm:w-48">
      <img
        src={sponsor.logo_url}
        alt={sponsor.name}
        className="max-h-full max-w-full object-contain"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = `https://placehold.co/150x50/F0F8FF/000000?text=${sponsor.name}`;
        }}
      />
    </div>
  );
}

export default SponsorDisplay;
