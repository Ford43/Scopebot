import { createContext, useContext, useState, ReactNode, useEffect } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "support" | "user";
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSupport: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock user database
const mockUsers = [
  { id: "1", email: "admin@scopebot.com",    password: "admin123",    name: "Admin Master",  role: "admin"   as const },
  { id: "2", email: "support@scopebot.com",  password: "support123",  name: "Support Team",  role: "support" as const },
  { id: "3", email: "user@example.com",     password: "user123",     name: "คุณลูกค้า",      role: "user"    as const },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("scopebot_user");
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    await new Promise((r) => setTimeout(r, 500));
    const found = mockUsers.find((u) => u.email === email && u.password === password);
    if (found) {
      const info: User = { id: found.id, email: found.email, name: found.name, role: found.role };
      setUser(info);
      localStorage.setItem("scopebot_user", JSON.stringify(info));
      return true;
    }
    return false;
  };

  const signup = async (email: string, password: string, name: string): Promise<boolean> => {
    await new Promise((r) => setTimeout(r, 500));
    if (mockUsers.find((u) => u.email === email)) return false;
    const newUser = { id: Date.now().toString(), email, password, name, role: "user" as const };
    mockUsers.push(newUser);
    const info: User = { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role };
    setUser(info);
    localStorage.setItem("scopebot_user", JSON.stringify(info));
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("scopebot_user");
  };

  return (
    <AuthContext.Provider value={{
      user, login, signup, logout,
      isAuthenticated: !!user,
      isAdmin:   user?.role === "admin",
      isSupport: user?.role === "support",
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}