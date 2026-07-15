import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import type { User } from "../types/auth";
import {
  clearAuthToken,
  getAuthToken,
  setAuthToken,
} from "../lib/api";

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSupport: boolean;
  authReady: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const fetchMe = async (token: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUser({ ...data, name: data.username });
      } else {
        clearAuthToken();
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
    }
  };

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setAuthReady(true);
      return;
    }
    fetchMe(token).finally(() => setAuthReady(true));
  }, []);

  const login = async (
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setAuthToken(data.access_token);
        await fetchMe(data.access_token);
        return { ok: true };
      }

      const detail = data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
      return { ok: false, error: message };
    } catch (error) {
      console.error("Login error:", error);
      return { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" };
    }
  };

  const signup = async (
    email: string,
    password: string,
    name: string
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username: name, password }),
      });
      return res.ok;
    } catch (error) {
      console.error("Signup error:", error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    clearAuthToken();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signup,
        logout,
        isAuthenticated: !!user,
        isAdmin: user?.role === "admin",
        isSupport: user?.role === "support",
        authReady,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export type { User };
