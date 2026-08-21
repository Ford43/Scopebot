import { createBrowserRouter, Navigate } from "react-router";

import ChatInterface from "./components/chat/ChatInterface";
import LoginPage from "./components/auth/LoginPage";
import SignupPage from "./components/auth/SignupPage";
import ForgotPasswordPage from "./components/auth/ForgotPasswordPage";


export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/chat" replace />,
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



  // route เก่า redirect กลับ dashboard
  {
    path: "/analytics",
    element: <Navigate to="/admin" replace />,
  },
  {
    path: "/documents",
    element: <Navigate to="/admin" replace />,
  },
  {
    path: "/integration",
    element: <Navigate to="/admin" replace />,
  },
  {
    path: "/search-history",
    element: <Navigate to="/admin" replace />,
  },
  {
    path: "/unified-chat",
    element: <Navigate to="/admin" replace />,
  },
]);