import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Shield,
  Cpu,
  CheckCircle2,
  XCircle,
  Save,
  LogOut,
  Loader2,
  Zap,
  RefreshCw,
  Sparkles,
  Layers,
  Database,
  Check,
} from "lucide-react";
import {
  getAdminProviders,
  updateAdminSettings,
  adminLogout,
} from "../services/api";
import SEOHead from "../components/SEOHead";

function AdminDashboard() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState([]);
  const [activeProvider, setActiveProvider] = useState("auto");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const fetchProviders = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminProviders();
      setProviders(data.providers || []);
      setActiveProvider(data.active_provider || "auto");
    } catch (err) {
      if (err.response?.status === 401) {
        adminLogout();
        navigate("/login");
        return;
      }
      setError("Failed to load provider settings from server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/login");
      return;
    }
    fetchProviders();
  }, [navigate]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await updateAdminSettings({
        active_provider: activeProvider,
        active_model: "",
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (err) {
      if (err.response?.status === 401) {
        adminLogout();
        navigate("/login");
        return;
      }
      setError(err.response?.data?.detail || "Failed to save AI settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    adminLogout();
    navigate("/login");
  };

  return (
    <div style={styles.page}>
      <SEOHead
        title="Admin Control Panel — CypherCorp AI Studio"
        description="Configure AI provider routing, OpenAI and Gemini selections, and runtime orchestration."
      />

      {/* Top Navbar */}
      <header style={styles.navbar}>
        <div style={styles.navLeft}>
          <Link to="/" style={styles.brandLink}>
            <div style={styles.brandMark}>C</div>
            <span style={styles.brandName}>CYPHERCORP</span>
          </Link>
          <span style={styles.adminBadge}>
            <Shield size={12} />
            ADMIN PANEL
          </span>
        </div>

        <div style={styles.navRight}>
          <button
            type="button"
            onClick={handleLogout}
            style={styles.logoutButton}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        {/* Header Hero Section */}
        <section style={styles.heroSection}>
          <div style={styles.heroContent}>
            <div style={styles.heroEyebrowRow}>
              <span style={styles.eyebrow}>SYSTEM CONFIGURATION</span>
              <span style={styles.liveIndicator}>
                <span style={styles.liveDot} />
                Live Active Routing
              </span>
            </div>
            <h1 style={styles.heroTitle}>AI Provider Settings.</h1>
            <p style={styles.heroDesc}>
              Choose which AI provider should power your Natural Language SQL queries, automated EDA reports,
              and AI narrative synthesis across the entire application.
            </p>
          </div>

          <div style={styles.statusCardsRow}>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>CURRENT ACTIVE PROVIDER</span>
              <strong style={styles.statValue}>
                {activeProvider === "auto"
                  ? "Auto (Intelligent Failover)"
                  : activeProvider === "openai"
                  ? "OpenAI (Direct)"
                  : "Google Gemini (Direct)"}
              </strong>
            </div>

            <div style={styles.statCard}>
              <span style={styles.statLabel}>ENVIRONMENT API KEYS</span>
              <strong style={styles.statValue}>
                {providers.filter((p) => p.configured).length} / {providers.length || 2} Configured
              </strong>
            </div>
          </div>
        </section>

        {loading ? (
          <div style={styles.loadingBox}>
            <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
            <p style={{ marginTop: "12px", color: "var(--muted)", fontWeight: 500 }}>
              Connecting to configuration engine...
            </p>
          </div>
        ) : (
          <div style={styles.configContainer}>
            {/* Select AI Provider Card */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <span style={styles.eyebrow}>DISPATCH STRATEGY</span>
                  <h2 style={styles.cardTitle}>Select Primary AI Provider</h2>
                </div>
                <Cpu size={20} color="var(--muted)" />
              </div>

              <div style={styles.providerGrid}>
                {/* Auto Card */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveProvider("auto");
                    setSaved(false);
                  }}
                  style={{
                    ...styles.providerCard,
                    ...(activeProvider === "auto" ? styles.providerCardActive : {}),
                  }}
                >
                  <div style={styles.providerCardHeader}>
                    <div style={styles.providerIconBox}>
                      <Sparkles size={20} color={activeProvider === "auto" ? "#171717" : "#77766f"} />
                    </div>
                    {activeProvider === "auto" && (
                      <span style={styles.activePill}>
                        <Check size={12} />
                        Active
                      </span>
                    )}
                  </div>
                  <h3 style={styles.providerName}>Auto (Best Available)</h3>
                  <p style={styles.providerDesc}>
                    Intelligently routes requests to the best configured provider (OpenAI → Gemini)
                    with automatic zero-downtime failover.
                  </p>
                </button>

                {/* Individual Provider Cards */}
                {providers.map((prov) => {
                  const isSelected = activeProvider === prov.name;
                  const isConfigured = prov.configured;

                  return (
                    <button
                      key={prov.name}
                      type="button"
                      disabled={!isConfigured}
                      onClick={() => {
                        setActiveProvider(prov.name);
                        setSaved(false);
                      }}
                      style={{
                        ...styles.providerCard,
                        ...(isSelected ? styles.providerCardActive : {}),
                        ...(!isConfigured ? styles.providerCardDisabled : {}),
                      }}
                    >
                      <div style={styles.providerCardHeader}>
                        <div style={styles.providerIconBox}>
                          {prov.name === "openai" ? (
                            <Zap size={20} color={isSelected ? "#10b981" : "#77766f"} />
                          ) : (
                            <Layers size={20} color={isSelected ? "#6366f1" : "#77766f"} />
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {isConfigured ? (
                            <span style={styles.keyPillGreen}>
                              <CheckCircle2 size={11} />
                              Key Active
                            </span>
                          ) : (
                            <span style={styles.keyPillRed}>
                              <XCircle size={11} />
                              Missing Key
                            </span>
                          )}
                          {isSelected && (
                            <span style={styles.activePill}>
                              <Check size={12} />
                              Active
                            </span>
                          )}
                        </div>
                      </div>
                      <h3 style={styles.providerName}>
                        {prov.name === "openai" ? "OpenAI" : "Google Gemini"}
                      </h3>
                      <p style={styles.providerDesc}>
                        {prov.name === "openai"
                          ? "Routes all queries and analysis tasks directly through the configured OpenAI API key."
                          : "Routes all queries and analysis tasks directly through the configured Google Gemini API key."}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div style={styles.errorBanner}>
                <XCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Save & Action Footer Bar */}
            <div style={styles.actionBar}>
              <div style={styles.actionLeft}>
                <button
                  type="button"
                  onClick={fetchProviders}
                  style={styles.refreshBtn}
                  disabled={saving}
                >
                  <RefreshCw size={14} />
                  <span>Refresh Status</span>
                </button>
                {saved && (
                  <span style={styles.savedNotice}>
                    <CheckCircle2 size={15} color="#16a34a" />
                    <span>Active provider saved and updated!</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={styles.saveBtn}
              >
                {saving ? (
                  <>
                    <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save Selection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--bg, #f5f4f0)",
    color: "var(--text, #171717)",
    fontFamily: '"DM Sans", sans-serif',
    display: "flex",
    flexDirection: "column",
  },
  navbar: {
    height: "64px",
    background: "#f1f0eb",
    borderBottom: "1px solid var(--border, #deddd7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 32px",
    position: "sticky",
    top: 0,
    zIndex: 50,
  },
  navLeft: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  brandLink: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    textDecoration: "none",
    color: "var(--text, #171717)",
  },
  brandMark: {
    width: "28px",
    height: "28px",
    display: "grid",
    placeItems: "center",
    background: "var(--text, #171717)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 700,
    borderRadius: "4px",
  },
  brandName: {
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.12em",
  },
  adminBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "3px 8px",
    background: "rgba(0,0,0,0.06)",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.06em",
    color: "var(--muted, #77766f)",
  },
  navRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  navButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 14px",
    background: "var(--surface, #fbfaf7)",
    border: "1px solid var(--border, #deddd7)",
    borderRadius: "6px",
    color: "var(--text, #171717)",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  logoutButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    background: "transparent",
    border: "1px solid var(--border, #deddd7)",
    borderRadius: "6px",
    color: "#dc2626",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  main: {
    flex: 1,
    maxWidth: "1000px",
    width: "100%",
    margin: "0 auto",
    padding: "40px 24px 80px",
  },
  heroSection: {
    marginBottom: "32px",
  },
  heroContent: {
    marginBottom: "24px",
  },
  heroEyebrowRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "8px",
  },
  eyebrow: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--muted, #77766f)",
  },
  liveIndicator: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "2px 8px",
    background: "rgba(16, 185, 129, 0.1)",
    border: "1px solid rgba(16, 185, 129, 0.25)",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: 600,
    color: "#16a34a",
  },
  liveDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#16a34a",
  },
  heroTitle: {
    fontSize: "28px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    margin: "0 0 8px 0",
    color: "var(--text, #171717)",
  },
  heroDesc: {
    fontSize: "14px",
    lineHeight: "1.6",
    color: "var(--muted, #77766f)",
    margin: 0,
    maxWidth: "720px",
  },
  statusCardsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "16px",
  },
  statCard: {
    background: "var(--surface, #fbfaf7)",
    border: "1px solid var(--border, #deddd7)",
    borderRadius: "8px",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  statLabel: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--muted, #77766f)",
  },
  statValue: {
    fontSize: "15px",
    fontWeight: 600,
    color: "var(--text, #171717)",
  },
  configContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  card: {
    background: "var(--surface, #fbfaf7)",
    border: "1px solid var(--border, #deddd7)",
    borderRadius: "8px",
    padding: "24px",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "20px",
  },
  cardTitle: {
    fontSize: "18px",
    fontWeight: 700,
    margin: "4px 0 0 0",
    color: "var(--text, #171717)",
  },
  providerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px",
  },
  providerCard: {
    background: "#fff",
    border: "1.5px solid var(--border, #deddd7)",
    borderRadius: "8px",
    padding: "20px",
    textAlign: "left",
    cursor: "pointer",
    transition: "all 0.15s ease",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  providerCardActive: {
    borderColor: "var(--text, #171717)",
    background: "#fbfaf7",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  providerCardDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
    background: "#f7f6f3",
  },
  providerCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px",
  },
  providerIconBox: {
    width: "36px",
    height: "36px",
    borderRadius: "6px",
    background: "var(--surface-alt, #eeece7)",
    display: "grid",
    placeItems: "center",
  },
  activePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "3px 8px",
    background: "var(--text, #171717)",
    color: "#fff",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 700,
  },
  keyPillGreen: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "3px 8px",
    background: "rgba(16, 185, 129, 0.1)",
    color: "#16a34a",
    border: "1px solid rgba(16, 185, 129, 0.25)",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 600,
  },
  keyPillRed: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "3px 8px",
    background: "rgba(239, 68, 68, 0.1)",
    color: "#dc2626",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 600,
  },
  providerName: {
    fontSize: "16px",
    fontWeight: 700,
    margin: 0,
    color: "var(--text, #171717)",
  },
  providerDesc: {
    fontSize: "13px",
    color: "var(--muted, #77766f)",
    lineHeight: "1.5",
    margin: 0,
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 16px",
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "6px",
    color: "#dc2626",
    fontSize: "13px",
    fontWeight: 600,
  },
  actionBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "18px 24px",
    background: "var(--surface, #fbfaf7)",
    border: "1px solid var(--border, #deddd7)",
    borderRadius: "8px",
    flexWrap: "wrap",
    gap: "14px",
  },
  actionLeft: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  refreshBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    background: "transparent",
    border: "1px solid var(--border, #deddd7)",
    borderRadius: "6px",
    color: "var(--muted, #77766f)",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  savedNotice: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#16a34a",
  },
  saveBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 22px",
    background: "var(--text, #171717)",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    transition: "background 0.15s ease",
  },
  loadingBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 20px",
    background: "var(--surface, #fbfaf7)",
    border: "1px solid var(--border, #deddd7)",
    borderRadius: "8px",
  },
};

export default AdminDashboard;
