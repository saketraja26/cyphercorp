import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield, Eye, EyeOff, AlertCircle, ArrowRight, Lock, User as UserIcon, ArrowLeft } from "lucide-react";
import { adminLogin } from "../services/api";
import SEOHead from "../components/SEOHead";

function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await adminLogin({ username, password });
      navigate("/admin/dashboard");
    } catch (err) {
      const msg = err.response?.data?.detail || "Invalid admin credentials";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <SEOHead
        title="Admin Login — CypherCorp Control Panel"
        description="Secure administrator access for CypherCorp AI Studio engine and provider configuration."
      />

      <div style={styles.card}>
        <div style={styles.topRow}>
          <Link to="/login" style={styles.backLink}>
            <ArrowLeft size={14} />
            <span>Regular Login</span>
          </Link>
          <div style={styles.brandMark}>C</div>
        </div>

        <div style={styles.header}>
          <span style={styles.eyebrow}>CYPHERCORP CONTROL PANEL</span>
          <h1 style={styles.title}>Admin Access</h1>
          <p style={styles.subtitle}>
            Enter administrator credentials to manage AI model providers and orchestration.
          </p>
        </div>

        {error && (
          <div style={styles.errorBox}>
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>ADMIN USERNAME</label>
            <div style={styles.inputWrap}>
              <UserIcon size={16} color="var(--muted, #77766f)" style={styles.inputIcon} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin"
                style={styles.input}
                required
                autoFocus
                autoComplete="username"
              />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>ADMIN PASSWORD</label>
            <div style={styles.inputWrap}>
              <Lock size={16} color="var(--muted, #77766f)" style={styles.inputIcon} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                style={styles.input}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password}
            style={{
              ...styles.submitBtn,
              opacity: loading || !username || !password ? 0.6 : 1,
            }}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Access Admin Control Panel</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div style={styles.footer}>
          <Shield size={14} color="var(--muted, #77766f)" />
          <span>Restricted to authorized system administrators</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg, #f5f4f0)",
    padding: "24px",
    fontFamily: '"DM Sans", sans-serif',
  },
  card: {
    width: "100%",
    maxWidth: "440px",
    background: "var(--surface, #fbfaf7)",
    border: "1px solid var(--border, #deddd7)",
    borderRadius: "10px",
    padding: "36px 32px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "24px",
  },
  backLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--muted, #77766f)",
    textDecoration: "none",
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
  header: {
    marginBottom: "24px",
  },
  eyebrow: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--muted, #77766f)",
    display: "block",
    marginBottom: "6px",
  },
  title: {
    fontSize: "24px",
    fontWeight: 700,
    margin: "0 0 6px 0",
    color: "var(--text, #171717)",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: "13px",
    color: "var(--muted, #77766f)",
    margin: 0,
    lineHeight: "1.5",
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    borderRadius: "6px",
    color: "#dc2626",
    fontSize: "13px",
    fontWeight: 500,
    marginBottom: "20px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: "var(--muted, #77766f)",
    textTransform: "uppercase",
  },
  inputWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  inputIcon: {
    position: "absolute",
    left: "12px",
    pointerEvents: "none",
  },
  input: {
    width: "100%",
    padding: "11px 12px 11px 38px",
    background: "#fff",
    border: "1px solid var(--border, #deddd7)",
    borderRadius: "6px",
    color: "var(--text, #171717)",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.15s ease",
  },
  eyeBtn: {
    position: "absolute",
    right: "10px",
    background: "transparent",
    border: "none",
    color: "var(--muted, #77766f)",
    cursor: "pointer",
    padding: "4px",
  },
  submitBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "12px",
    background: "var(--text, #171717)",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    marginTop: "6px",
    transition: "background 0.15s ease",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    marginTop: "24px",
    paddingTop: "18px",
    borderTop: "1px solid var(--border, #deddd7)",
    fontSize: "12px",
    color: "var(--muted, #77766f)",
  },
};

export default AdminLogin;
