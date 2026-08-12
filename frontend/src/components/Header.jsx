import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  Bell,
  LogOut,
  Shield,
  FileSpreadsheet,
  Database,
  Terminal,
  Brain,
  LayoutDashboard,
  ArrowUpRight,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { getCurrentUser, getDatasets, logoutUser } from "../services/api";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);
  const profileMenuRef = useRef(null);

  // 1. Fetch User Info
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

  // 2. Fetch Datasets for Search
  useEffect(() => {
    const loadDatasets = async () => {
      try {
        const res = await getDatasets();
        setDatasets(res.data || []);
      } catch (err) {
        console.error("Could not load datasets for search:", err);
      }
    };
    if (localStorage.getItem("access_token")) {
      loadDatasets();
    }
  }, [location.pathname]);

  // 3. Global Keyboard Shortcut (⌘K or Ctrl+K) & Click Outside
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      } else if (e.key === "Escape") {
        setIsSearchOpen(false);
        setShowProfileMenu(false);
        searchInputRef.current?.blur();
      }
    };

    const handleClickOutside = (e) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target)
      ) {
        setIsSearchOpen(false);
      }
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target)
      ) {
        setShowProfileMenu(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  // Filter items based on searchQuery
  const query = searchQuery.trim().toLowerCase();

  const matchedDatasets = datasets.filter((d) =>
    d.name?.toLowerCase().includes(query)
  );

  const navigationItems = [
    { title: "Overview Dashboard", path: "/", icon: <LayoutDashboard size={15} />, group: "NAVIGATE" },
    { title: "Datasets Library", path: "/datasets", icon: <FileSpreadsheet size={15} />, group: "NAVIGATE" },
    { title: "AI Analysis & Profiler", path: "/analysis", icon: <Sparkles size={15} />, group: "NAVIGATE" },
    { title: "SQL Analyst Console", path: "/sql", icon: <Terminal size={15} />, group: "NAVIGATE" },
    { title: "AutoML Studio", path: "/ml", icon: <Brain size={15} />, group: "NAVIGATE" },
  ];

  const matchedNav = navigationItems.filter((nav) =>
    !query || nav.title.toLowerCase().includes(query) || nav.path.toLowerCase().includes(query)
  );

  const handleSelect = (path) => {
    setIsSearchOpen(false);
    setSearchQuery("");
    navigate(path);
  };

  return (
    <header className="header">
      <div className="breadcrumb">{getBreadcrumb()}</div>

      <div className="header-actions">
        {/* Search & Command Palette Wrapper */}
        <div className="search-container" ref={searchContainerRef}>
          <div className={`search ${isSearchOpen ? "focused" : ""}`}>
            <Search size={16} />
            <input
              ref={searchInputRef}
              placeholder="Search datasets, tools, actions..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (matchedDatasets.length > 0) {
                    handleSelect(`/analysis/${matchedDatasets[0].id}`);
                  } else if (matchedNav.length > 0) {
                    handleSelect(matchedNav[0].path);
                  }
                }
              }}
            />
            {searchQuery ? (
              <button
                className="search-clear-btn"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
              >
                <X size={13} />
              </button>
            ) : (
              <kbd>⌘ K</kbd>
            )}
          </div>

          {/* Live Search Results Popover */}
          {isSearchOpen && (
            <div className="search-results-dropdown">
              {/* 1. Datasets Section */}
              {matchedDatasets.length > 0 && (
                <div className="search-group">
                  <div className="search-group-header">
                    <span>DATASETS ({matchedDatasets.length})</span>
                  </div>
                  {matchedDatasets.slice(0, 5).map((d) => (
                    <div
                      className="search-result-item"
                      key={d.id}
                      onClick={() => handleSelect(`/analysis/${d.id}`)}
                    >
                      <div className="search-item-left">
                        <Database size={15} className="search-item-icon" />
                        <div>
                          <strong className="search-item-title">{d.name}</strong>
                          <span className="search-item-meta">
                            {d.row_count?.toLocaleString()} rows · {d.column_count} cols
                          </span>
                        </div>
                      </div>

                      <div className="search-quick-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          title="Open SQL"
                          onClick={() => handleSelect(`/sql/${d.id}`)}
                        >
                          SQL
                        </button>
                        <button
                          title="Open ML Studio"
                          onClick={() => handleSelect(`/ml/${d.id}`)}
                        >
                          ML
                        </button>
                        <button
                          title="Open Analysis"
                          onClick={() => handleSelect(`/analysis/${d.id}`)}
                        >
                          <ArrowUpRight size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 2. Platform Navigation */}
              {matchedNav.length > 0 && (
                <div className="search-group">
                  <div className="search-group-header">
                    <span>NAVIGATION & TOOLS</span>
                  </div>
                  {matchedNav.map((nav, i) => (
                    <div
                      className="search-result-item"
                      key={i}
                      onClick={() => handleSelect(nav.path)}
                    >
                      <div className="search-item-left">
                        <div className="search-nav-icon">{nav.icon}</div>
                        <strong className="search-item-title">{nav.title}</strong>
                      </div>
                      <span className="search-item-shortcut">{nav.path}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* No results */}
              {matchedDatasets.length === 0 && matchedNav.length === 0 && (
                <div className="search-empty-state">
                  <p>No results found for "{searchQuery}"</p>
                  <span>Try searching for dataset names, "sql", "analysis", or "ml".</span>
                </div>
              )}

              <div className="search-popover-footer">
                <span>Navigate with <kbd>↑</kbd> <kbd>↓</kbd> <kbd>↵</kbd></span>
                <span>Press <kbd>ESC</kbd> to close</span>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="user-profile-wrapper" ref={profileMenuRef}>
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