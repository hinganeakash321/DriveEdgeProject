"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

interface FavItem {
  id: number;
  vehicle_model_id: number;
  model_name: string;
  manufacturer_name?: string | null;
  body_type: string;
  image_url?: string | null;
  min_price?: number | null;
}

interface FavState {
  ids: Set<number>;
  items: FavItem[];
  isFavourite: (modelId: number) => boolean;
  toggle: (modelId: number) => Promise<void>;
  loading: boolean;
}

const FavContext = createContext<FavState | undefined>(undefined);

export function FavouritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<FavItem[]>([]);
  const [ids, setIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user || user.role !== "customer") {
      setItems([]);
      setIds(new Set());
      return;
    }
    setLoading(true);
    try {
      const favs = await api.get<FavItem[]>("/api/favourites");
      setItems(favs);
      setIds(new Set(favs.map((f) => f.vehicle_model_id)));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = useCallback(
    async (modelId: number) => {
      if (!user || user.role !== "customer") return;
      if (ids.has(modelId)) {
        await api.del(`/api/favourites/${modelId}`);
      } else {
        await api.post("/api/favourites", { vehicle_model_id: modelId });
      }
      await load();
    },
    [ids, user, load]
  );

  const isFavourite = useCallback((modelId: number) => ids.has(modelId), [ids]);

  return (
    <FavContext.Provider value={{ ids, items, isFavourite, toggle, loading }}>
      {children}
    </FavContext.Provider>
  );
}

const NOOP_FAVS: FavState = {
  ids: new Set(),
  items: [],
  isFavourite: () => false,
  toggle: async () => {},
  loading: false,
};

export function useFavourites() {
  // Degrade gracefully when rendered outside a provider (e.g. isolated tests).
  return useContext(FavContext) ?? NOOP_FAVS;
}
