"use client";

import { Heart } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useFavourites } from "@/lib/favourites";

export function FavouriteButton({ modelId, className = "" }: { modelId: number; className?: string }) {
  const { user } = useAuth();
  const { isFavourite, toggle } = useFavourites();

  // Only customers can save favourites.
  if (!user || user.role !== "customer") return null;

  const active = isFavourite(modelId);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(modelId);
      }}
      aria-label={active ? "Remove from favourites" : "Add to favourites"}
      className={`rounded-full p-2 transition ${active ? "text-danger" : "text-muted hover:text-danger"} ${className}`}
    >
      <Heart className={`h-5 w-5 ${active ? "fill-current" : ""}`} />
    </button>
  );
}
