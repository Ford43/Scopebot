import { createBrowserRouter, Navigate } from "react-router";
import ChatInterface from "./components/chat/ChatInterface";
import LoginPage from "./components/auth/LoginPage";
import SignupPage from "./components/auth/SignupPage";
import ForgotPasswordPage from "./components/auth/ForgotPasswordPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },
  {
    path: "/chat",
    Component: ChatInterface,
  },
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/signup",
    Component: SignupPage,
  },
  {
    path: "/forgot-password",
    Component: ForgotPasswordPage,
  },
  // Legacy admin redirects → chat
  {
    path: "/admin",
    element: <Navigate to="/chat" replace />,
  },
  {
    path: "/admin/*",
    element: <Navigate to="/chat" replace />,
  },
  {
    path: "/analytics",
    element: <Navigate to="/chat" replace />,
  },
  {
    path: "/documents",
    element: <Navigate to="/chat" replace />,
  },
  {
    path: "/integration",
    element: <Navigate to="/chat" replace />,
  },
  {
    path: "/search-history",
    element: <Navigate to="/chat" replace />,
  },
  {
    path: "/unified-chat",
    element: <Navigate to="/chat" replace />,
  },
]);
