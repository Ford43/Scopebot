import { useCallback, useEffect, useState } from "react";
import { authHeaders } from "../lib/api";

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export function useNotifications(isAuthenticated: boolean) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [countRes, listRes] = await Promise.all([
        fetch("/api/notifications/unread-count", { headers: authHeaders() }),
        fetch("/api/notifications/?unread_only=false", { headers: authHeaders() }),
      ]);

      if (countRes.ok) {
        const data = await countRes.json();
        setUnreadCount(data.unread_count ?? data.count ?? 0);
      }
      if (listRes.ok) {
        const data = await listRes.json();
        setNotifications(Array.isArray(data) ? data.slice(0, 30) : []);
      }
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      setNotifications([]);
      return;
    }

    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated, refresh]);

  const markRead = useCallback(
    async (id: number) => {
      try {
        await fetch(`/api/notifications/${id}/read`, {
          method: "PATCH",
          headers: authHeaders(),
        });
        await refresh();
      } catch (error) {
        console.error("Failed to mark notification read", error);
      }
    },
    [refresh]
  );

  const markAllRead = useCallback(async () => {
    try {
      await fetch("/api/notifications/read-all", {
        method: "PATCH",
        headers: authHeaders(),
      });
      await refresh();
    } catch (error) {
      console.error("Failed to mark all notifications read", error);
    }
  }, [refresh]);

  return { unreadCount, notifications, refresh, markRead, markAllRead };
}
