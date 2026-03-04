"use client";

import { clsx } from "clsx";

type StarRatingProps = {
  value: number;
  onChange: (next: number) => void;
  size?: "xs" | "sm" | "md";
};

export function StarRating({ value, onChange, size = "md" }: StarRatingProps) {
  const buttonClass =
    size === "xs"
      ? "h-6 w-6 text-[10px]"
      : size === "sm"
        ? "h-7 w-7 text-[11px]"
        : "h-8 w-8 text-xs";
  const gapClass = size === "xs" ? "gap-0.5" : "gap-1";

  return (
    <div className={`flex items-center ${gapClass}`}>
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          type="button"
          key={score}
          onClick={() => onChange(score)}
          className={clsx(
            buttonClass,
            "rounded-full border font-semibold",
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
