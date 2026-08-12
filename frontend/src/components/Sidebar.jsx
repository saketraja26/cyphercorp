import {
  LayoutDashboard,
  Database,
  Sparkles,
  Terminal,
  Brain,
  Settings,
  LogOut,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

function Sidebar() {
  const navigate = useNavigate();
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">C</div>
        <span>CYPHERCORP</span>
      </div>

      <nav className="navigation">
        <div className="nav-section">
          <span className="nav-label">WORKSPACE</span>

          <NavLink
            to="/"
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""}`
            }
          >
            <LayoutDashboard size={17} />
            <span>Overview</span>
          </NavLink>

          <NavLink
            to="/datasets"
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""}`
            }
          >
            <Database size={17} />
            <span>Datasets</span>
          </NavLink>

          <NavLink
            to="/analysis"
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""}`
            }
          >
            <Sparkles size={17} />
            <span>AI Analysis</span>
          </NavLink>

          <NavLink
            to="/sql"
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""}`
            }
          >
            <Terminal size={17} />
            <span>SQL Analyst</span>
          </NavLink>

          <NavLink
            to="/ml"
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""}`
            }
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
          >
            <Settings size={17} />
            <span>Settings</span>
          </NavLink>

          <button
            className="nav-item"
            onClick={() => {
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
  );
}

export default Sidebar;