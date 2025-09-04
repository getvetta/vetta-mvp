// components/RiskScoreBadge.tsx
import React from "react";

export default function RiskScoreBadge({ score }: { score: "Low" | "Medium" | "High" }) {
  const map = {
    Low: "bg-green-100 text-green-800 border-green-300",
    Medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
    High: "bg-red-100 text-red-800 border-red-300",
  } as const;
  const cls = map[score] || "bg-gray-100 text-gray-800 border-gray-300";

  return (
    <span className={`inline-block px-2 md:px-3 py-1 text-xs md:text-sm font-medium rounded-full border ${cls}`}>
      {score} Risk
    </span>
  );
}
