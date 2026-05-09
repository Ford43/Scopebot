import { createContext, useContext, useState, ReactNode, useEffect } from "react";

interface User {
  id: string | number;
  email: string;
  name: string;
  username: string; // เพิ่ม username เพราะหลังบ้านใช้ตัวนี้
  role: "admin" | "support" | "user";
  is_approved?: boolean;
<<<<<<< HEAD
=======
  max_bots?: number;
>>>>>>> master
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // 1. ตรวจสอบ Token เมื่อเปิดเว็บขึ้นมา
  useEffect(() => {
    const token = localStorage.getItem("scopebot_token");
    if (token) {
      fetchMe(token);
    }
  }, []);

  // 2. ฟังก์ชันดึงข้อมูลผู้ใช้จากหลังบ้านด้วย Token
  const fetchMe = async (token: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        // เอาข้อมูลจาก API มาตั้งค่าเป็น User ของหน้าบ้าน
        setUser({ 
          ...data, 
          name: data.username // Map username จากหลังบ้านให้เป็น name ของหน้าบ้าน
        });
      } else {
        // ถ้า Token หมดอายุหรือพัง ให้ลบทิ้ง
        localStorage.removeItem("scopebot_token");
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
    }
  };

  // 3. ฟังก์ชัน Login (ยิง API ไปหา FastAPI)
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (res.ok) {
        const data = await res.json();
        // เก็บ Token ไว้ใน LocalStorage
        localStorage.setItem("scopebot_token", data.access_token);
        // ดึงข้อมูล User ต่อทันที
        await fetchMe(data.access_token);
        return true;
      }
      return false; // ถ้ารหัสผิด จะตกมาตรงนี้
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  // 4. ฟังก์ชัน Signup (ยิง API ไปหา FastAPI)
  const signup = async (email: string, password: string, name: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // หลังบ้านรับ email, username, password
        body: JSON.stringify({ email, username: name, password }) 
      });

      if (res.ok) {
<<<<<<< HEAD
        // สมัครสำเร็จ ให้ Login อัตโนมัติ
        return await login(email, password);
=======
        // สมัครสำเร็จ แต่ต้องรอแอดมินอนุมัติ จึงยังไม่ Login ตอนนี้ ให้คืนค่า true กลับไปเฉยๆ
        return true; 
>>>>>>> master
      }
      return false;
    } catch (error) {
      console.error("Signup error:", error);
      return false;
    }
  };

  // 5. ฟังก์ชัน Logout
  const logout = () => {
    setUser(null);
    localStorage.removeItem("scopebot_token"); // ลบ Token ออก
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