import { createBrowserRouter } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import EditorPage from "./pages/EditorPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";

const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/s/:sessionId", element: <EditorPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/dashboard", element: <DashboardPage /> },
]);

export default router;