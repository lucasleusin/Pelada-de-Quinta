"use client";

import { clsx } from "clsx";

type StarRatingProps = {
  value: number;
  onChange: (next: number) => void;
};

export function StarRating({ value, onChange }: StarRatingProps) {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3, 4, 5].map((score) => (
        <button
          type="button"
          key={score}
          onClick={() => onChange(score)}
          className={clsx(
            "h-8 w-8 rounded-full border text-xs font-semibold",
            value === score
              ? "border-orange-500 bg-orange-500 text-white"
              : "border-emerald-200 bg-white text-emerald-700 hover:border-orange-400",
          )}
          aria-label={`Dar nota ${score}`}
        >
          {score}
        </button>
      ))}
    </div>
  );
}
