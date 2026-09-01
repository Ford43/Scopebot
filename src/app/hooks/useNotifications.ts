import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
  const seenIdsRef = useRef<Set<number>>(new Set());
  const hydratedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [countRes, listRes] = await Promise.all([
        fetch("/api/notifications/unread-count", { headers: authHeaders() }),
        fetch("/api/notifications/?unread_only=false", {
          headers: authHeaders(),
        }),
      ]);

      if (countRes.ok) {
        const data = await countRes.json();
        setUnreadCount(data.unread_count ?? data.count ?? 0);
      }
      if (listRes.ok) {
        const data = await listRes.json();
        const list: AppNotification[] = Array.isArray(data)
          ? data.slice(0, 30)
          : [];

        if (hydratedRef.current) {
          for (const n of list) {
            if (seenIdsRef.current.has(n.id) || n.is_read) continue;
            const urgent =
              n.type === "warning" ||
              n.type === "danger" ||
              n.title.includes("รอคิว");
            if (urgent) {
              toast.warning(n.title, { description: n.message });
            } else if (n.type === "success") {
              toast.success(n.title, { description: n.message });
            }
          }
        }

        seenIdsRef.current = new Set(list.map((n) => n.id));
        hydratedRef.current = true;
        setNotifications(list);
      }
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      setNotifications([]);
      seenIdsRef.current = new Set();
      hydratedRef.current = false;
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

  const clearAll = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/clear-all", {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.ok) {
        setNotifications([]);
        setUnreadCount(0);
        seenIdsRef.current = new Set();
      }
    } catch (error) {
      console.error("Failed to clear notifications", error);
    }
  }, []);

  return { unreadCount, notifications, refresh, markRead, markAllRead, clearAll };
}

/** Map notification content → app view */
export function resolveNotificationView(
  n: AppNotification
): "unified-chat" | "bots" | "dashboard" {
  const text = `${n.title} ${n.message}`.toLowerCase();
  if (
    text.includes("รอคิว") ||
    text.includes("เจ้าหน้าที่") ||
    text.includes("ลูกค้า") ||
    text.includes("live")
  ) {
    return "unified-chat";
  }
  if (
    text.includes("เอกสาร") ||
    text.includes("บอท") ||
    text.includes("bot") ||
    text.includes("ประมวลผล") ||
    text.includes("ingest") ||
    text.includes("อัปโหลด")
  ) {
    return "bots";
  }
  return "dashboard";
}
