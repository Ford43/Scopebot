import { Navigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, authReady } = useAuth();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
