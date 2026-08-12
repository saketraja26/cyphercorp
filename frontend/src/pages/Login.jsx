import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Zap,
  BarChart3,
} from "lucide-react";
import { loginUser, registerUser } from "../services/api";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  // Mode: "login" or "register"
  const [isRegister, setIsRegister] = useState(
    location.pathname === "/register"
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    setIsRegister(location.pathname === "/register");
    setError("");
    setSuccessMsg("");
  }, [location.pathname]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (isRegister && !name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    try {
      setLoading(true);

      if (isRegister) {
        // 1. Register user
        await registerUser({ name, email, password });
        setSuccessMsg("Account created successfully! Logging you in...");

        // 2. Automatically log in
        await loginUser({ email, password });
        setTimeout(() => {
          navigate("/", { replace: true });
        }, 600);
      } else {
        // 1. Log in
        await loginUser({ email, password });
        navigate("/", { replace: true });
      }
    } catch (err) {
      console.error("Auth error:", err);
      const detail = err.response?.data?.detail;
      setError(
        detail ||
          (isRegister
            ? "Failed to create account. Please try again."
            : "Invalid email or password.")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Left Brand Showcase Panel */}
      <div className="auth-brand-panel">
        <div className="auth-brand-header">
          <div className="brand-mark">C</div>
          <span>CYPHERCORP</span>
        </div>

        <div className="auth-hero-content">
          <p className="eyebrow">ENTERPRISE DATA PLATFORM</p>
          <h1>Next-Gen Data & AutoML Studio.</h1>
          <p className="hero-desc">
            Automated Exploratory Data Analysis, Natural Language SQL querying,
            model benchmarking, and real-time inference in one unified workspace.
          </p>

          <div className="auth-feature-list">
            <div className="feature-item">
              <Sparkles size={18} />
              <div>
                <strong>Automated EDA Engine</strong>
                <span>Instant distributions, correlations, outliers & data quality scoring.</span>
              </div>
            </div>
            <div className="feature-item">
              <Zap size={18} />
              <div>
                <strong>AI SQL Analyst</strong>
                <span>Translate plain English questions into secure relational queries.</span>
              </div>
            </div>
            <div className="feature-item">
              <BarChart3 size={18} />
              <div>
                <strong>Multi-Model AutoML</strong>
                <span>Automated candidate benchmarking, leaderboards & live prediction sandbox.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-panel-footer">
          <ShieldCheck size={16} />
          <span>Tenant data isolation & secure JWT session authentication</span>
        </div>
      </div>

      {/* Right Form Card */}
      <div className="auth-form-panel">
        <div className="auth-form-card">
          <div className="auth-card-header">
            <p className="eyebrow">
              {isRegister ? "START YOUR JOURNEY" : "WORKSPACE ACCESS"}
            </p>
            <h2>{isRegister ? "Create CypherCorp Account" : "Sign in to CypherCorp"}</h2>
            <p className="subtitle">
              {isRegister
                ? "Sign up to upload your private datasets and run automated AI analytics."
                : "Enter your credentials to access your private datasets and models."}
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${!isRegister ? "active" : ""}`}
              onClick={() => {
                setIsRegister(false);
                setError("");
                setSuccessMsg("");
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab ${isRegister ? "active" : ""}`}
              onClick={() => {
                setIsRegister(true);
                setError("");
                setSuccessMsg("");
              }}
            >
              Create Account
            </button>
          </div>

          {/* Notices */}
          {error && (
            <div className="auth-notice error">
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="auth-notice success">
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister && (
              <div className="form-group">
                <label className="eyebrow">FULL NAME</label>
                <div className="input-with-icon">
                  <UserIcon size={16} />
                  <input
                    type="text"
                    placeholder="e.g. Saket Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="eyebrow">EMAIL ADDRESS</label>
              <div className="input-with-icon">
                <Mail size={16} />
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="eyebrow">PASSWORD</label>
              <div className="input-with-icon">
                <Lock size={16} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={isRegister ? "Min 6 characters" : "Enter password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="primary-button auth-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <span>Processing...</span>
              ) : (
                <>
                  <span>{isRegister ? "Create Free Account" : "Sign In to Workspace"}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Toggle Link */}
          <div className="auth-card-footer">
            <span>
              {isRegister
                ? "Already have an account?"
                : "Don't have an account yet?"}
            </span>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
                setSuccessMsg("");
              }}
            >
              {isRegister ? "Sign In instead" : "Create one now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;