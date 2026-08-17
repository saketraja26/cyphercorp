import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

import Dashboard from "./pages/Dashboard";
import Datasets from "./pages/Datasets";
import Analysis from "./pages/Analysis";
import SqlAnalyst from "./pages/SqlAnalyst";
import MlStudio from "./pages/MlStudio";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";

import { warmUpBackend } from "./services/api";

function ProtectedLayout() {
  const token = localStorage.getItem("access_token");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // If unauthenticated trying to access protected workspace routes, redirect to login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app">
      <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <div className="main">
        <Header
          isMobileMenuOpen={mobileMenuOpen}
          onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
        />

        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/datasets" element={<Datasets />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/analysis/:datasetId" element={<Analysis />} />
          <Route path="/sql" element={<SqlAnalyst />} />
          <Route path="/sql/:datasetId" element={<SqlAnalyst />} />
          <Route path="/ml" element={<MlStudio />} />
          <Route path="/ml/:datasetId" element={<MlStudio />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  useEffect(() => {
    warmUpBackend();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Homepage & Showcase (Always visible on root /) */}
        <Route path="/" element={<Landing />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/features" element={<Landing />} />
        <Route path="/faq" element={<Landing />} />

        {/* Authentication */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Login />} />

        {/* Admin Panel (separate auth, no sidebar) */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />

        {/* Protected Application Workspace */}
        <Route path="/*" element={<ProtectedLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;