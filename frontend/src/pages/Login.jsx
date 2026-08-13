import { useState, useEffect, useRef } from "react";
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
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { loginUser, registerUser, loginWithGoogle } from "../services/api";

const GoogleIcon = () => (
  <svg className="google-icon-svg" viewBox="0 0 24 24" width="18" height="18">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

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
  const [googleLoading, setGoogleLoading] = useState(false);

  const googleBtnContainerRef = useRef(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

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

  // Initialize Google Identity Services (GIS)
  useEffect(() => {
    const handleCredentialResponse = async (response) => {
      if (!response.credential) return;
      try {
        setGoogleLoading(true);
        setError("");
        await loginWithGoogle(response.credential);
        navigate("/", { replace: true });
      } catch (err) {
        console.error("Google login failed:", err);
        setError(
          err.response?.data?.detail || "Google authentication failed. Please try again."
        );
      } finally {
        setGoogleLoading(false);
      }
    };

    if (window.google?.accounts?.id && googleClientId) {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      if (googleBtnContainerRef.current) {
        window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
          theme: "outline",
          size: "large",
          width: "100%",
          text: isRegister ? "signup_with" : "signin_with",
          shape: "rectangular",
        });
      }
    }
  }, [googleClientId, isRegister, navigate]);

  const handleCustomGoogleClick = () => {
    if (!googleClientId) {
      setError(
        "Google Sign-In is ready! To connect your Google OAuth client, please add your Google Client ID to VITE_GOOGLE_CLIENT_ID in your frontend .env file."
      );
      return;
    }

    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      setError("Google Sign-In service is loading. Please try again in a moment.");
    }
  };

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
        // Fast single-pass registration with immediate token return
        await registerUser({
          name: name.trim(),
          email: email.trim(),
          password,
        });
        navigate("/", { replace: true });
      } else {
        // Fast non-blocking login
        await loginUser({
          email: email.trim(),
          password,
        });
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
              <AlertCircle size={15} style={{ marginRight: "8px", flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="auth-notice success">
              <CheckCircle2 size={15} style={{ marginRight: "8px", flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. Google One-Click Sign In */}
          <div className="auth-google-section">
            {googleClientId ? (
              <div ref={googleBtnContainerRef} style={{ width: "100%", minHeight: "44px" }}>
                <button
                  type="button"
                  className="google-auth-btn"
                  onClick={handleCustomGoogleClick}
                  disabled={googleLoading || loading}
                >
                  <GoogleIcon />
                  <span>{googleLoading ? "Connecting to Google..." : isRegister ? "Sign up with Google" : "Sign in with Google"}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="google-auth-btn"
                onClick={handleCustomGoogleClick}
                disabled={googleLoading || loading}
              >
                <GoogleIcon />
                <span>{googleLoading ? "Connecting..." : isRegister ? "Sign up with Google" : "Continue with Google"}</span>
              </button>
            )}

            <div className="auth-divider">
              <span>or with email</span>
            </div>
          </div>

          {/* 2. Fast Email/Password Form */}
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
              disabled={loading || googleLoading}
            >
              {loading ? (
                <span>Authenticating...</span>
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