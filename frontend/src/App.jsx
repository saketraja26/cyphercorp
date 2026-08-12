import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

import Dashboard from "./pages/Dashboard";
import Datasets from "./pages/Datasets";
import Analysis from "./pages/Analysis";
import SqlAnalyst from "./pages/SqlAnalyst";
import MlStudio from "./pages/MlStudio";
import Login from "./pages/Login";

import "./styles/global.css";


function ProtectedLayout() {
  const token = localStorage.getItem("access_token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app">
      <Sidebar />

      <div className="main">
        <Header />

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/datasets" element={<Datasets />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/analysis/:datasetId" element={<Analysis />} />
          <Route path="/sql" element={<SqlAnalyst />} />
          <Route path="/sql/:datasetId" element={<SqlAnalyst />} />
          <Route path="/ml" element={<MlStudio />} />
          <Route path="/ml/:datasetId" element={<MlStudio />} />
        </Routes>
      </div>
    </div>
  );
}


function App() {
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