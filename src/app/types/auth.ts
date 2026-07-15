export interface User {
  id: string | number;
  email: string;
  name: string;
  username: string;
  role: "admin" | "support" | "user";
  is_approved?: boolean;
  max_bots?: number;
}
