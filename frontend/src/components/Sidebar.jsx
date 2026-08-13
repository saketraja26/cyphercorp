import {
  LayoutDashboard,
  Database,
  Sparkles,
  Terminal,
  Brain,
  Settings,
  LogOut,
  X,
  Home,
} from "lucide-react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { logoutUser } from "../services/api";

function Sidebar({ isOpen = false, onClose }) {
  const navigate = useNavigate();

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Drawer Backdrop Overlay */}
      <div
        className={`sidebar-backdrop ${isOpen ? "open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-header-row">
          <Link to="/" className="brand" title="View Home Page" onClick={handleNavClick}>
            <img
              src="/CYPHERCORP Logo_light_bg.png"
              alt="CypherCorp"
              className="sidebar-full-brand-logo"
            />
          </Link>

          {/* Close Button for Mobile Drawer */}
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="navigation">
          <div className="nav-section">
            <span className="nav-label">WORKSPACE</span>

            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
              onClick={handleNavClick}
            >
              <LayoutDashboard size={17} />
              <span>Overview</span>
            </NavLink>

            <NavLink
              to="/datasets"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
              onClick={handleNavClick}
            >
              <Database size={17} />
              <span>Datasets</span>
            </NavLink>

            <NavLink
              to="/analysis"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
              onClick={handleNavClick}
            >
              <Sparkles size={17} />
              <span>AI Analysis</span>
            </NavLink>

            <NavLink
              to="/sql"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
              onClick={handleNavClick}
            >
              <Terminal size={17} />
              <span>SQL Analyst</span>
            </NavLink>

            <NavLink
              to="/ml"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
              onClick={handleNavClick}
            >
              <Brain size={17} />
              <span>ML Studio</span>
            </NavLink>
          </div>

          <div className="nav-section bottom">
            <span className="nav-label">SYSTEM</span>

            <NavLink
              to="/"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
              onClick={handleNavClick}
            >
              <Home size={17} />
              <span>Home</span>
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
              onClick={handleNavClick}
            >
              <Settings size={17} />
              <span>Settings</span>
            </NavLink>

            <button
              className="nav-item"
              onClick={() => {
                if (onClose) onClose();
                logoutUser();
              }}
            >
              <LogOut size={17} />
              <span>Sign out</span>
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" />
          <span>Systems operational</span>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;