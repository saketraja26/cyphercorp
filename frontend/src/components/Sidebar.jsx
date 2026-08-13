import {
  LayoutDashboard,
  Database,
  Sparkles,
  Terminal,
  Brain,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

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
          <div className="brand">
            <div className="brand-mark">C</div>
            <span>CYPHERCORP</span>
          </div>

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
              to="/"
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
                localStorage.removeItem("access_token");
                navigate("/login", { replace: true });
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