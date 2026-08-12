import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, Bell, LogOut, Shield } from "lucide-react";
import { getCurrentUser, logoutUser } from "../services/api";

function Header() {
  const location = useLocation();
  const navigate = useNavigate();

  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user_info");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const u = await getCurrentUser();
        setUser(u);
      } catch (err) {
        console.error("Could not fetch user profile:", err);
      }
    };
    if (!user && localStorage.getItem("access_token")) {
      fetchUser();
    }
  }, [user]);

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path.startsWith("/datasets")) return "WORKSPACE / DATASETS";
    if (path.startsWith("/analysis")) return "AI ANALYSIS / PROFILER";
    if (path.startsWith("/sql")) return "SQL ANALYST / CONSOLE";
    if (path.startsWith("/ml")) return "ML STUDIO / AUTOML";
    return "WORKSPACE / OVERVIEW";
  };

  const initial = user?.name
    ? user.name.charAt(0).toUpperCase()
    : user?.email
    ? user.email.charAt(0).toUpperCase()
    : "U";

  return (
    <header className="header">
      <div className="breadcrumb">{getBreadcrumb()}</div>

      <div className="header-actions">
        <div className="search">
          <Search size={16} />
          <input
            placeholder="Search datasets, queries..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target.value.trim()) {
                navigate("/datasets");
              }
            }}
          />
          <kbd>⌘ K</kbd>
        </div>

        {/* User Profile Dropdown */}
        <div className="user-profile-wrapper">
          <button
            className="avatar-btn"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            title={user?.email || "User Profile"}
          >
            <div className="avatar">{initial}</div>
          </button>

          {showProfileMenu && (
            <div className="profile-dropdown-menu">
              <div className="profile-info-header">
                <strong>{user?.name || "CypherCorp User"}</strong>
                <span>{user?.email || "user@cyphercorp.internal"}</span>
              </div>

              <div className="profile-menu-divider" />

              <div className="profile-meta-row">
                <Shield size={14} />
                <span>Tenant Isolated Workspace</span>
              </div>

              <div className="profile-menu-divider" />

              <button
                className="profile-logout-btn"
                onClick={() => logoutUser()}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;