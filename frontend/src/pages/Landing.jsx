import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  BarChart3,
  Terminal,
  Brain,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  Database,
  Layers,
  Activity,
  ChevronDown,
  TrendingUp,
  Cpu,
  Lock,
  Search,
  ExternalLink,
  Code2,
  LayoutDashboard,
  Menu,
  X,
} from "lucide-react";
import SEOHead from "../components/SEOHead";

export default function Landing() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("eda");
  const [openFaq, setOpenFaq] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggedIn] = useState(() => !!localStorage.getItem("access_token"));

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "What is CypherCorp AI Data Studio?",
      a: "CypherCorp is a next-generation AI Data Intelligence platform that unifies automated exploratory data analysis (EDA), natural language to SQL translation, and multi-model AutoML benchmarking into a single, tenant-isolated workspace.",
    },
    {
      q: "How does the Automated EDA Engine calculate Data Health Scores?",
      a: "The Automated EDA engine scans your dataset for completeness, statistical distributions, missing values, skewness, and interquartile range (IQR) anomalies to generate a composite Data Health Score from 0 to 100 with actionable data cleansing suggestions.",
    },
    {
      q: "Can I query datasets in plain English without knowing SQL?",
      a: "Yes! The Natural Language SQL Analyst converts conversational English questions into deterministic, read-only SQL queries with step-by-step logic explainers to ensure 100% transparent and reliable data analytics without hallucinations.",
    },
    {
      q: "Which Machine Learning algorithms does AutoML Studio support?",
      a: "CypherCorp benchmarks industry-standard algorithms including Random Forest, Gradient Boosting, Linear/Ridge Regression, and Decision Trees. It handles automated feature preprocessing, hyperparameter optimization, and delivers an interactive leaderboard with instant live inference.",
    },
    {
      q: "How is my dataset kept secure and isolated?",
      a: "CypherCorp enforces strict per-user tenant isolation with JWT authentication, isolated file paths (`uploads/{user_id}/`), sandboxed query execution, and zero cross-tenant data sharing.",
    },
    {
      q: "What file formats can I upload and analyze?",
      a: "You can upload CSV datasets of any dimension. The platform automatically detects column data types, parses headers, normalizes missing values, and prepares data for both statistical profiling and ML training.",
    },
  ];

  return (
    <div className="landing-page">
      <SEOHead
        title="Next-Gen AI Data Intelligence & AutoML Studio"
        description="Instant automated EDA, natural language SQL querying, and multi-model machine learning benchmarks in a secure, tenant-isolated workspace."
        keywords="AI data analysis, automated EDA, natural language SQL, AutoML studio, exploratory data analysis, machine learning benchmarking, data health score, correlation matrix, scikit-learn models, SQL query generator, CSV statistical profiler"
        canonicalUrl="https://cyphercorp.com/"
      />

      {/* 1. SEMANTIC PUBLIC HEADER / NAVIGATION */}
      <header className="landing-nav" role="banner">
        <div className="landing-nav-container">
          <Link to="/" className="landing-brand" aria-label="CypherCorp Home">
            <img
              src="/CYPHERCORP Logo_light_bg.png"
              alt="CypherCorp"
              className="landing-full-brand-logo"
            />
            <span className="landing-badge">AI STUDIO</span>
          </Link>

          <nav className="landing-nav-links desktop-nav" aria-label="Primary Navigation">
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#showcase" className="landing-nav-link">Capabilities</a>
            <a href="#leaderboard" className="landing-nav-link">AutoML</a>
            <a href="#faq" className="landing-nav-link">FAQ</a>
          </nav>

          <div className="landing-nav-actions desktop-actions">
            {isLoggedIn ? (
              <Link to="/dashboard" className="landing-btn-primary">
                <LayoutDashboard size={15} />
                <span>Launch Workspace</span>
                <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link to="/login" className="landing-btn-secondary">
                  Sign In
                </Link>
                <Link to="/register" className="landing-btn-primary">
                  <span>Get Started</span>
                  <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Right Controls: Quick CTA + Hamburger Toggle */}
          <div className="landing-mobile-nav-right">
            {isLoggedIn ? (
              <Link to="/dashboard" className="landing-btn-primary landing-btn-mobile-quick">
                <span>Launch</span>
                <ArrowRight size={13} />
              </Link>
            ) : (
              <Link to="/register" className="landing-btn-primary landing-btn-mobile-quick">
                <span>Start Free</span>
                <ArrowRight size={13} />
              </Link>
            )}
            <button
              className="landing-mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="landing-mobile-dropdown">
            <nav className="landing-mobile-nav-links" aria-label="Mobile Navigation">
              <a
                href="#features"
                className="landing-mobile-nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </a>
              <a
                href="#showcase"
                className="landing-mobile-nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                Capabilities
              </a>
              <a
                href="#leaderboard"
                className="landing-mobile-nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                AutoML Benchmarks
              </a>
              <a
                href="#faq"
                className="landing-mobile-nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                FAQ
              </a>
            </nav>

            <div className="landing-mobile-menu-actions">
              {isLoggedIn ? (
                <Link
                  to="/dashboard"
                  className="landing-btn-primary mobile-full-btn"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <LayoutDashboard size={16} />
                  <span>Launch Workspace</span>
                  <ArrowRight size={14} />
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="landing-btn-secondary mobile-full-btn"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="landing-btn-primary mobile-full-btn"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>Get Started Free</span>
                    <ArrowRight size={14} />
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* 2. HERO SECTION */}
      <main>
        <section className="landing-hero" aria-labelledby="hero-heading">
          <div className="landing-hero-container">
            <div className="landing-pill">
              <Sparkles size={14} />
              <span>Automated EDA · Natural Language SQL · AutoML Benchmarking</span>
            </div>

            <h1 id="hero-heading" className="landing-hero-title">
              Next-Gen AI Data Intelligence &amp; AutoML Studio
            </h1>

            <p className="landing-hero-sub">
              Empower your data team with instant statistical profiling, natural language SQL querying, 
              and multi-model machine learning benchmarks—all in an enterprise-grade, tenant-isolated environment.
            </p>

            <div className="landing-hero-ctas">
              {isLoggedIn ? (
                <Link to="/dashboard" className="landing-cta-btn-primary">
                  <LayoutDashboard size={16} />
                  <span>Enter Workspace Dashboard</span>
                  <ArrowRight size={16} />
                </Link>
              ) : (
                <Link to="/register" className="landing-cta-btn-primary">
                  <span>Start Free Analysis</span>
                  <ArrowRight size={16} />
                </Link>
              )}
              <a href="#showcase" className="landing-cta-btn-secondary">
                <Activity size={16} />
                <span>Explore Interactive Demo</span>
              </a>
            </div>

            {/* Quick Metrics Bar */}
            <div className="landing-hero-stats">
              <div className="landing-stat-item">
                <div className="landing-stat-val">100%</div>
                <div className="landing-stat-lbl">Tenant Isolated</div>
              </div>
              <div className="landing-stat-divider" />
              <div className="landing-stat-item">
                <div className="landing-stat-val">Instant</div>
                <div className="landing-stat-lbl">EDA Profiling</div>
              </div>
              <div className="landing-stat-divider" />
              <div className="landing-stat-item">
                <div className="landing-stat-val">4+</div>
                <div className="landing-stat-lbl">AutoML Benchmark Models</div>
              </div>
              <div className="landing-stat-divider" />
              <div className="landing-stat-item">
                <div className="landing-stat-val">Zero</div>
                <div className="landing-stat-lbl">SQL Hallucination</div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. CORE VALUE PILLARS SECTION */}
        <section id="features" className="landing-pillars-section" aria-labelledby="pillars-heading">
          <div className="landing-section-container">
            <div className="landing-section-header">
              <span className="landing-tag">CORE CAPABILITIES</span>
              <h2 id="pillars-heading" className="landing-section-title">
                Everything you need to turn raw data into deployed intelligence
              </h2>
              <p className="landing-section-sub">
                Designed for data scientists, product teams, and business analysts who need accurate answers fast.
              </p>
            </div>

            <div className="landing-pillars-grid">
              {/* Pillar 1 */}
              <article className="landing-pillar-card">
                <div className="landing-pillar-icon-wrap" style={{ background: "#e8f5e9", color: "#2e7d32" }}>
                  <BarChart3 size={24} />
                </div>
                <h3 className="landing-pillar-title">Automated EDA Engine</h3>
                <p className="landing-pillar-desc">
                  Instant statistical summaries, missingness detection, Pearson correlation heatmaps, 
                  IQR outlier identification, and composite data health scoring with zero setup.
                </p>
                <ul className="landing-pillar-list">
                  <li><CheckCircle2 size={14} color="#2e7d32" /> Data Health Score (0-100)</li>
                  <li><CheckCircle2 size={14} color="#2e7d32" /> High Correlation Warnings</li>
                  <li><CheckCircle2 size={14} color="#2e7d32" /> IQR Anomaly Outlier Detection</li>
                </ul>
              </article>

              {/* Pillar 2 */}
              <article className="landing-pillar-card">
                <div className="landing-pillar-icon-wrap" style={{ background: "#e0f2fe", color: "#0284c7" }}>
                  <Terminal size={24} />
                </div>
                <h3 className="landing-pillar-title">Natural Language SQL Analyst</h3>
                <p className="landing-pillar-desc">
                  Ask questions in plain conversational English. Get optimized, deterministic SQL queries with 
                  step-by-step logic explainers and live result grids.
                </p>
                <ul className="landing-pillar-list">
                  <li><CheckCircle2 size={14} color="#0284c7" /> Safe Read-Only Execution</li>
                  <li><CheckCircle2 size={14} color="#0284c7" /> Zero-Hallucination Explanations</li>
                  <li><CheckCircle2 size={14} color="#0284c7" /> Instant CSV Data Export</li>
                </ul>
              </article>

              {/* Pillar 3 */}
              <article className="landing-pillar-card">
                <div className="landing-pillar-icon-wrap" style={{ background: "#f3e8ff", color: "#9333ea" }}>
                  <Brain size={24} />
                </div>
                <h3 className="landing-pillar-title">Multi-Model AutoML Studio</h3>
                <p className="landing-pillar-desc">
                  Automated feature encoding, training, and benchmarking across Random Forest, Gradient Boosting, 
                  Ridge, and Decision Trees with a real-time live inference sandbox.
                </p>
                <ul className="landing-pillar-list">
                  <li><CheckCircle2 size={14} color="#9333ea" /> Leaderboard Ranking (R² &amp; MSE)</li>
                  <li><CheckCircle2 size={14} color="#9333ea" /> Auto Missing Value Imputation</li>
                  <li><CheckCircle2 size={14} color="#9333ea" /> Live Single-Click Model Predictor</li>
                </ul>
              </article>

              {/* Pillar 4 */}
              <article className="landing-pillar-card">
                <div className="landing-pillar-icon-wrap" style={{ background: "#fef3c7", color: "#d97706" }}>
                  <ShieldCheck size={24} />
                </div>
                <h3 className="landing-pillar-title">Enterprise Security &amp; Tenant Isolation</h3>
                <p className="landing-pillar-desc">
                  Strict JWT authentication, per-user isolated dataset directory storage, 
                  sandboxed execution pipelines, and zero cross-tenant data contamination.
                </p>
                <ul className="landing-pillar-list">
                  <li><CheckCircle2 size={14} color="#d97706" /> Per-Tenant File Storage</li>
                  <li><CheckCircle2 size={14} color="#d97706" /> Secure JWT Session Tokens</li>
                  <li><CheckCircle2 size={14} color="#d97706" /> Complete Data Privacy</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        {/* 4. INTERACTIVE CAPABILITY SHOWCASE SECTION */}
        <section id="showcase" className="landing-showcase-section" aria-labelledby="showcase-heading">
          <div className="landing-section-container">
            <div className="landing-section-header">
              <span className="landing-tag">LIVE PLATFORM PREVIEW</span>
              <h2 id="showcase-heading" className="landing-section-title">
                Experience the CypherCorp Workflow
              </h2>
              <p className="landing-section-sub">
                Switch between capabilities to see how CypherCorp accelerates your data science and analytics lifecycle.
              </p>
            </div>

            {/* Showcase Tabs */}
            <div className="landing-tabs-nav" role="tablist">
              <button
                role="tab"
                aria-selected={activeTab === "eda"}
                className={`landing-tab-btn ${activeTab === "eda" ? "active" : ""}`}
                onClick={() => setActiveTab("eda")}
              >
                <BarChart3 size={16} />
                <span>Automated EDA &amp; Health</span>
              </button>
              <button
                role="tab"
                aria-selected={activeTab === "sql"}
                className={`landing-tab-btn ${activeTab === "sql" ? "active" : ""}`}
                onClick={() => setActiveTab("sql")}
              >
                <Terminal size={16} />
                <span>Natural Language SQL</span>
              </button>
              <button
                role="tab"
                aria-selected={activeTab === "ml"}
                className={`landing-tab-btn ${activeTab === "ml" ? "active" : ""}`}
                onClick={() => setActiveTab("ml")}
              >
                <Brain size={16} />
                <span>AutoML Benchmarks</span>
              </button>
            </div>

            {/* Tab Content 1: EDA */}
            {activeTab === "eda" && (
              <div className="landing-tab-panel" role="tabpanel">
                <div className="landing-preview-grid">
                  <div className="landing-preview-card">
                    <div className="landing-preview-card-header">
                      <div className="landing-preview-dot-group">
                        <span className="dot dot-red" />
                        <span className="dot dot-yellow" />
                        <span className="dot dot-green" />
                      </div>
                      <span className="landing-preview-title">Dataset Health &amp; Profiling Report</span>
                    </div>
                    <div className="landing-preview-body">
                      <div className="landing-health-score-banner">
                        <div className="health-score-badge">94 / 100</div>
                        <div className="health-score-text">
                          <strong>Dataset Health: Excellent</strong>
                          <p className="text-muted text-sm">2,450 rows · 12 features · 0 missing target values</p>
                        </div>
                      </div>

                      <div className="landing-preview-table-container">
                        <div className="landing-preview-mini-table">
                          <div className="mini-table-row header eda-header">
                            <span>Feature</span>
                            <span>Type</span>
                            <span>Missing</span>
                            <span>IQR Anomalies</span>
                            <span>Mean / Mode</span>
                          </div>
                          <div className="mini-table-row">
                            <span className="mono feature-name">annual_revenue</span>
                            <span className="badge-type">float64</span>
                            <span className="text-success">0.0%</span>
                            <span className="text-warning">14 outliers</span>
                            <span className="mono">$142,500</span>
                          </div>
                          <div className="mini-table-row">
                            <span className="mono feature-name">churn_risk</span>
                            <span className="badge-type">object</span>
                            <span className="text-success">0.0%</span>
                            <span className="text-muted">None</span>
                            <span className="mono">Low (68%)</span>
                          </div>
                          <div className="mini-table-row">
                            <span className="mono feature-name">customer_age</span>
                            <span className="badge-type">int64</span>
                            <span className="text-success">0.4%</span>
                            <span className="text-muted">2 outliers</span>
                            <span className="mono">36.4 yrs</span>
                          </div>
                        </div>
                      </div>
                      <div className="landing-table-scroll-hint mobile-only">
                        <span>⇄ Swipe table to inspect all columns</span>
                      </div>
                    </div>
                  </div>

                  <div className="landing-preview-info">
                    <span className="landing-subtag">FEATURE 01</span>
                    <h3>Instant Statistical Intelligence</h3>
                    <p>
                      Stop writing repetitive pandas code. Upload any CSV dataset and immediately get 
                      correlation matrices, skewness alerts, missingness distributions, and automated IQR anomaly detection.
                    </p>
                    <div className="landing-highlight-pills">
                      <span className="highlight-pill">⚡ Instant CSV Parsing</span>
                      <span className="highlight-pill">🔍 Correlation Heatmaps</span>
                      <span className="highlight-pill">🛡️ IQR Anomaly Detection</span>
                    </div>
                    <Link to={isLoggedIn ? "/analysis" : "/register"} className="landing-inline-cta">
                      <span>{isLoggedIn ? "Open in Analysis Studio" : "Analyze your dataset now"}</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Content 2: SQL */}
            {activeTab === "sql" && (
              <div className="landing-tab-panel" role="tabpanel">
                <div className="landing-preview-grid">
                  <div className="landing-preview-card">
                    <div className="landing-preview-card-header">
                      <div className="landing-preview-dot-group">
                        <span className="dot dot-red" />
                        <span className="dot dot-yellow" />
                        <span className="dot dot-green" />
                      </div>
                      <span className="landing-preview-title">English-to-SQL Translation Console</span>
                    </div>
                    <div className="landing-preview-body">
                      <div className="landing-nl-prompt">
                        <span className="prompt-label">USER QUERY:</span>
                        <p className="prompt-text">"Show top 5 enterprise accounts with revenue &gt; $100k sorted by lifetime value"</p>
                      </div>

                      <div className="landing-sql-code-block">
                        <div className="sql-code-header">
                          <Code2 size={14} />
                          <span>GENERATED SQL (Deterministic &amp; Read-Only)</span>
                        </div>
                        <pre className="mono">
{`SELECT company_name, annual_revenue, lifetime_value, industry
FROM dataset_table
WHERE annual_revenue > 100000 AND tier = 'Enterprise'
ORDER BY lifetime_value DESC
LIMIT 5;`}
                        </pre>
                      </div>

                      <div className="landing-sql-explainer">
                        <Zap size={14} color="#d8ff3e" className="flex-shrink-0" />
                        <span><strong>Logic Explainer:</strong> Filters enterprise tier with revenue threshold and orders by LTV descending with 5 record limit.</span>
                      </div>
                    </div>
                  </div>

                  <div className="landing-preview-info">
                    <span className="landing-subtag">FEATURE 02</span>
                    <h3>Ask in English, Query with Confidence</h3>
                    <p>
                      Bridge the gap between business questions and SQL databases. The AI SQL Analyst 
                      generates executable SQL queries paired with step-by-step logic explainers so you always understand why a query was constructed.
                    </p>
                    <div className="landing-highlight-pills">
                      <span className="highlight-pill">💬 Plain English Interface</span>
                      <span className="highlight-pill">🔒 Safe Read-Only Sandbox</span>
                      <span className="highlight-pill">⚡ Live Table Visualizer</span>
                    </div>
                    <Link to={isLoggedIn ? "/sql" : "/register"} className="landing-inline-cta">
                      <span>{isLoggedIn ? "Open SQL Console" : "Try SQL Analyst free"}</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Content 3: ML Studio */}
            {activeTab === "ml" && (
              <div className="landing-tab-panel" role="tabpanel">
                <div className="landing-preview-grid">
                  <div className="landing-preview-card">
                    <div className="landing-preview-card-header">
                      <div className="landing-preview-dot-group">
                        <span className="dot dot-red" />
                        <span className="dot dot-yellow" />
                        <span className="dot dot-green" />
                      </div>
                      <span className="landing-preview-title">AutoML Benchmark Leaderboard</span>
                    </div>
                    <div className="landing-preview-body">
                      <div className="landing-preview-table-container">
                        <div className="landing-preview-mini-table">
                          <div className="mini-table-row header ml-header">
                            <span>Rank / Model</span>
                            <span>R² Score</span>
                            <span>MSE</span>
                            <span>Training Time</span>
                            <span>Action</span>
                          </div>
                          <div className="mini-table-row winner">
                            <span className="model-name">🏆 Random Forest</span>
                            <span className="score-val text-success">0.942</span>
                            <span className="mono">0.038</span>
                            <span className="mono">1.24s</span>
                            <span className="badge-best">Champion</span>
                          </div>
                          <div className="mini-table-row">
                            <span className="model-name">⚡ Gradient Boosting</span>
                            <span className="score-val text-success">0.928</span>
                            <span className="mono">0.045</span>
                            <span className="mono">1.82s</span>
                            <span className="badge-runner">Rank 2</span>
                          </div>
                          <div className="mini-table-row">
                            <span className="model-name">🌲 Decision Tree</span>
                            <span className="score-val">0.865</span>
                            <span className="mono">0.079</span>
                            <span className="mono">0.42s</span>
                            <span className="badge-runner">Rank 3</span>
                          </div>
                          <div className="mini-table-row">
                            <span className="model-name">📈 Ridge Regression</span>
                            <span className="score-val">0.812</span>
                            <span className="mono">0.114</span>
                            <span className="mono">0.18s</span>
                            <span className="badge-runner">Rank 4</span>
                          </div>
                        </div>
                      </div>
                      <div className="landing-table-scroll-hint mobile-only">
                        <span>⇄ Swipe table to inspect all columns</span>
                      </div>
                    </div>
                  </div>

                  <div className="landing-preview-info">
                    <span className="landing-subtag">FEATURE 03</span>
                    <h3>Automated Multi-Model Benchmarking</h3>
                    <p>
                      Select your target variable and let CypherCorp automatically preprocess features, 
                      train multiple scikit-learn models, rank them on a standardized leaderboard, and deploy a live prediction sandbox.
                    </p>
                    <div className="landing-highlight-pills">
                      <span className="highlight-pill">🤖 4+ Candidate Models</span>
                      <span className="highlight-pill">📊 R² &amp; MSE Leaderboard</span>
                      <span className="highlight-pill">🎯 Interactive Prediction Sandbox</span>
                    </div>
                    <Link to={isLoggedIn ? "/ml" : "/register"} className="landing-inline-cta">
                      <span>{isLoggedIn ? "Open AutoML Studio" : "Benchmark your models"}</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 5. FREQUENTLY ASKED QUESTIONS (SCHEMA.ORG ALIGNED) */}
        <section id="faq" className="landing-faq-section" aria-labelledby="faq-heading">
          <div className="landing-section-container">
            <div className="landing-section-header">
              <span className="landing-tag">FREQUENTLY ASKED QUESTIONS</span>
              <h2 id="faq-heading" className="landing-section-title">
                Everything You Need to Know About CypherCorp
              </h2>
              <p className="landing-section-sub">
                Clear answers regarding security, automated EDA, SQL querying, and machine learning models.
              </p>
            </div>

            <div className="landing-faq-list">
              {faqs.map((faq, idx) => (
                <article key={idx} className={`landing-faq-item ${openFaq === idx ? "open" : ""}`}>
                  <button
                    className="landing-faq-question"
                    onClick={() => toggleFaq(idx)}
                    aria-expanded={openFaq === idx}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      size={18}
                      className={`faq-chevron ${openFaq === idx ? "rotate" : ""}`}
                    />
                  </button>
                  {openFaq === idx && (
                    <div className="landing-faq-answer">
                      <p>{faq.a}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 6. CALL TO ACTION SECTION */}
        <section className="landing-cta-banner" aria-labelledby="cta-heading">
          <div className="landing-cta-box">
            <h2 id="cta-heading" className="landing-cta-title">
              Ready to Accelerate Your Data Intelligence?
            </h2>
            <p className="landing-cta-sub">
              Upload your first dataset in seconds and unlock instant automated EDA, natural language SQL queries, and AutoML benchmarks.
            </p>
            <div className="landing-cta-buttons">
              {isLoggedIn ? (
                <Link to="/dashboard" className="landing-btn-hero-primary">
                  <LayoutDashboard size={16} />
                  <span>Go to Workspace Dashboard</span>
                  <ArrowRight size={16} />
                </Link>
              ) : (
                <>
                  <Link to="/register" className="landing-btn-hero-primary">
                    <span>Create Free Account</span>
                    <ArrowRight size={16} />
                  </Link>
                  <Link to="/login" className="landing-btn-hero-secondary">
                    <span>Sign In to Workspace</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* 7. SEMANTIC SEO FOOTER */}
      <footer className="landing-footer" role="contentinfo">
        <div className="landing-footer-container">
          <div className="landing-footer-brand-col">
            <div className="landing-brand">
              <img
                src="/CYPHERCORP Logo_dark_bg.png"
                alt="CypherCorp"
                className="landing-full-brand-logo-dark"
              />
            </div>
            <p className="landing-footer-desc">
              Enterprise-grade AI Data Intelligence &amp; AutoML Studio platform with Automated EDA, 
              Natural Language SQL, and multi-model benchmarking.
            </p>
            <div className="landing-footer-badges">
              <span className="footer-pill">FastAPI</span>
              <span className="footer-pill">React 19</span>
              <span className="footer-pill">Scikit-Learn</span>
              <span className="footer-pill">Tenant Isolated</span>
            </div>
          </div>

          <div className="landing-footer-nav-col">
            <h4>Capabilities</h4>
            <ul>
              <li><a href="#features">Automated EDA Engine</a></li>
              <li><a href="#showcase">Natural Language SQL</a></li>
              <li><a href="#showcase">AutoML Studio</a></li>
              <li><a href="#features">Tenant Isolation</a></li>
            </ul>
          </div>

          <div className="landing-footer-nav-col">
            <h4>Platform</h4>
            <ul>
              {isLoggedIn ? (
                <>
                  <li><Link to="/dashboard">Workspace Dashboard</Link></li>
                  <li><Link to="/datasets">Datasets Library</Link></li>
                  <li><Link to="/analysis">AI Analysis</Link></li>
                </>
              ) : (
                <>
                  <li><Link to="/login">Sign In</Link></li>
                  <li><Link to="/register">Create Account</Link></li>
                </>
              )}
              <li><a href="#faq">FAQ</a></li>
              <li><a href="/sitemap.xml">XML Sitemap</a></li>
            </ul>
          </div>

          <div className="landing-footer-nav-col">
            <h4>Target Solutions</h4>
            <ul>
              <li><span>Data Scientists</span></li>
              <li><span>SQL Analysts</span></li>
              <li><span>Machine Learning Engineers</span></li>
              <li><span>Enterprise Analytics</span></li>
            </ul>
          </div>
        </div>

        <div className="landing-footer-bottom">
          <p>© {new Date().getFullYear()} CypherCorp AI Studio. All rights reserved.</p>
          <div className="landing-footer-bottom-links">
            <a href="/robots.txt">Robots.txt</a>
            <a href="/sitemap.xml">Sitemap.xml</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
