import { useCallback, useEffect, useState } from "react";
import { authHeaders } from "../lib/api";

/** Poll active live sessions waiting for / with staff (for sidebar badge). */
export function useWaitingQueueCount(
  enabled: boolean,
  pollMs = 10000,
  scope: "all" | "mine" = "mine"
): number {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCount(0);
      return;
    }
    try {
      const res = await fetch(`/api/live/sessions?scope=${encodeURIComponent(scope)}`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;
      const waiting = data.filter(
        (s: { mode?: string; is_active?: boolean }) =>
          s.is_active !== false &&
          (s.mode === "waiting" || s.mode === "human")
      );
      setCount(waiting.length);
    } catch (error) {
      console.error("Failed to fetch waiting queue count", error);
    }
  }, [enabled, scope]);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    refresh();
    const interval = setInterval(refresh, pollMs);
    return () => clearInterval(interval);
  }, [enabled, pollMs, refresh]);

  return count;
}
