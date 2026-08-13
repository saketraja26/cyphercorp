import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

import Dashboard from "./pages/Dashboard";
import Datasets from "./pages/Datasets";
import Analysis from "./pages/Analysis";
import SqlAnalyst from "./pages/SqlAnalyst";
import MlStudio from "./pages/MlStudio";
import Settings from "./pages/Settings";
import Login from "./pages/Login";

import { useEffect, useState } from "react";
import { warmUpBackend } from "./services/api";

function ProtectedLayout() {
  const token = localStorage.getItem("access_token");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          <Route path="/" element={<Dashboard />} />
          <Route path="/datasets" element={<Datasets />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/analysis/:datasetId" element={<Analysis />} />
          <Route path="/sql" element={<SqlAnalyst />} />
          <Route path="/sql/:datasetId" element={<SqlAnalyst />} />
          <Route path="/ml" element={<MlStudio />} />
          <Route path="/ml/:datasetId" element={<MlStudio />} />
          <Route path="/settings" element={<Settings />} />
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

        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Login />} />

        {/* Protected application */}
        <Route path="/*" element={<ProtectedLayout />} />

      </Routes>
    </BrowserRouter>
  );
}


export default App;