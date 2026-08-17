import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  ArrowLeft,
  Rows3,
  Columns3,
  CircleCheck,
  Sparkles,
  BarChart3,
  Activity,
  AlertTriangle,
  GitCommit,
  TrendingUp,
  TrendingDown,
  Database,
  Upload,
  RotateCcw,
  Zap,
} from "lucide-react";

import {
  getDatasetAnalysis,
  regenerateDatasetAiAnalysis,
  getCachedDatasets,
  getDatasets,
  uploadDataset,
} from "../services/api";
import CorrelationHeatmap from "../components/CorrelationHeatmap";
import SEOHead from "../components/SEOHead";

// Client-side in-memory cache to guarantee 0ms instant dataset switching
const datasetAnalysisCache = new Map();

function formatStatValue(val, colName = "", metricType = "") {
  if (val === null || val === undefined) return "—";
  const colLower = String(colName).toLowerCase();
  const isYear = colLower.includes("year") || colLower.includes("yr");
  const isAge = colLower.includes("age");

  if (typeof val === "number") {
    if (isYear) {
      if (metricType === "mean") {
        return val % 1 === 0 ? String(Math.round(val)) : val.toFixed(1);
      }
      return String(Math.round(val));
    }

    if (isAge) {
      if (metricType === "mean") {
        return val % 1 === 0 ? String(Math.round(val)) : val.toFixed(1);
      }
      return String(Math.round(val));
    }

    if (Number.isInteger(val)) {
      return val.toLocaleString();
    }

    // For other floats (e.g. median/min/max if whole)
    if ((metricType === "min" || metricType === "max" || metricType === "median") && val % 1 === 0) {
      return Math.round(val).toLocaleString();
    }

    // General floats: up to 2 decimal places
    return Number(val.toFixed(2)).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  return String(val);
}

function formatInlineTokens(str) {
  if (!str) return null;
  const cleanStr = String(str);
  // Split by inline backticks `code` or **bold**
  const parts = cleanStr.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={idx} className="mono ai-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className="ai-item-title">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part.replace(/\*{1,2}/g, "");
  });
}

function renderFormattedAiText(text) {
  if (!text) return null;
  let clean = String(text).trim();

  // Strip leading bullet markers like "•", "-", "*", "1.", "1.1."
  clean = clean.replace(/^[•\-*\u2022\u25E6\u2043\u2219]+\s*/, "");
  clean = clean.replace(/^\d+[.)]\s*/, "");

  // Match patterns like "Attrition Target (`LeaveOrNot`):** Approx..." or "**Title:** Desc" or "Title: Desc"
  const titleRegex = /^(\*{0,2})([A-Za-z0-9\s_()`/.,'"-]+?)(:?\*{1,2}:?|:)\s*(.*)$/s;
  const match = clean.match(titleRegex);

  if (match) {
    let rawTitle = match[2].replace(/\*+/g, "").trim();
    let body = match[4].replace(/^\*+/, "").replace(/\*+$/, "").trim();

    // Ensure title doesn't end with redundant colon
    rawTitle = rawTitle.replace(/:$/, "").trim();

    return (
      <>
        <strong className="ai-item-title">
          {formatInlineTokens(rawTitle)}:
        </strong>{" "}
        <span className="ai-item-body">{formatInlineTokens(body)}</span>
      </>
    );
  }

  return formatInlineTokens(clean);
}

function formatList(item) {
  if (!item) return [];
  let rawList = [];
  if (Array.isArray(item)) {
    rawList = item.flatMap((sub) =>
      typeof sub === "string" ? sub.split("\n") : [String(sub)]
    );
  } else if (typeof item === "string") {
    rawList = item.split("\n");
  }

  return rawList
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 0 &&
        !s.match(
          /^(KEY FINDINGS|RECOMMENDATIONS|SUMMARY|DATA QUALITY|KEY OBSERVATIONS|RECOMMENDED ACTIONS):?$/i
        )
    );
}

function Analysis() {
  const { datasetId: routeDatasetId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const activeParamId = routeDatasetId || searchParams.get("datasetId");

  const [datasets, setDatasets] = useState(() => getCachedDatasets());
  const [selectedDatasetId, setSelectedDatasetId] = useState(activeParamId || "");
  const [analysis, setAnalysis] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [regeneratingAi, setRegeneratingAi] = useState(false);
  const [vizFilterTab, setVizFilterTab] = useState("all");
  const [corrViewMode, setCorrViewMode] = useState("both"); // "both", "heatmap", "cards"

  // 1. Fetch available datasets
  useEffect(() => {
    let isMounted = true;

    const loadDatasets = async () => {
      try {
        const res = await getDatasets();
        const list = res.data || [];
        if (!isMounted) return;

        setDatasets(list);

        if (list.length === 0) {
          setInitialLoading(false);
          setLoading(false);
          return;
        }

        if (!activeParamId) {
          const defaultId = String(list[0].id);
          setSelectedDatasetId(defaultId);
          navigate(`/analysis/${defaultId}`, { replace: true });
        } else {
          setSelectedDatasetId(String(activeParamId));
        }
      } catch (err) {
        console.error("Failed to load datasets:", err);
        if (isMounted) {
          setError("Failed to fetch datasets list.");
        }
      } finally {
        if (isMounted) {
          setInitialLoading(false);
        }
      }
    };

    loadDatasets();
    return () => {
      isMounted = false;
    };
  }, [activeParamId, navigate]);

  // 2. Fetch analysis for selected dataset (with instant cache support)
  useEffect(() => {
    const targetId = activeParamId || selectedDatasetId;
    if (!targetId) {
      // Waiting for dataset resolution, do not clear loading
      return;
    }

    let isMounted = true;

    const loadAnalysis = async () => {
      // Instant cache hit: render immediately without spinner
      if (datasetAnalysisCache.has(String(targetId))) {
        setAnalysis(datasetAnalysisCache.get(String(targetId)));
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        setAnalysis(null);

        const data = await getDatasetAnalysis(targetId);
        if (!isMounted) return;
        datasetAnalysisCache.set(String(targetId), data);
        setAnalysis(data);
      } catch (err) {
        console.error("Failed to load dataset analysis:", err);
        if (isMounted) {
          setError(
            err.response?.data?.detail || "Unable to load dataset analysis."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadAnalysis();
    return () => {
      isMounted = false;
    };
  }, [activeParamId, selectedDatasetId]);

  const handleRegenerateAi = async () => {
    const targetId = activeParamId || selectedDatasetId;
    if (!targetId || regeneratingAi) return;

    try {
      setRegeneratingAi(true);
      const res = await regenerateDatasetAiAnalysis(targetId);
      if (res?.analysis) {
        setAnalysis((prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            ai_analysis: res.analysis,
          };
          datasetAnalysisCache.set(String(targetId), updated);
          return updated;
        });
      }
    } catch (err) {
      console.error("Failed to regenerate AI analysis:", err);
    } finally {
      setRegeneratingAi(false);
    }
  };

  const handleDatasetChange = (newId) => {
    if (!newId) return;
    setSelectedDatasetId(String(newId));
    navigate(`/analysis/${newId}`);
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError("");
      const res = await uploadDataset(file);
      const newDataset = res.dataset || res;
      if (newDataset?.id) {
        navigate(`/analysis/${newDataset.id}`);
      }
    } catch (err) {
      console.error("Upload failed:", err);
      setError(err.response?.data?.detail || "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /* =========================
     NO DATASETS EMPTY STATE
  ========================= */
  if (!initialLoading && !loading && datasets.length === 0) {
    return (
      <main className="dashboard">
        <input
          type="file"
          ref={fileInputRef}
          accept=".csv"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <section className="analysis-error" style={{ textAlign: "center", padding: "60px 40px" }}>
          <p className="eyebrow">AUTOMATED INTELLIGENCE</p>
          <h1>No datasets uploaded yet.</h1>
          <p className="intro" style={{ margin: "16px auto 32px", maxWidth: "520px" }}>
            Upload a CSV file to inspect statistical distributions, data quality anomalies,
            correlations, and AI executive summaries.
          </p>
          <button className="primary-button" onClick={handleUploadClick} disabled={uploading}>
            <Upload size={17} />
            {uploading ? "Uploading..." : "Upload CSV Dataset"}
          </button>
        </section>
      </main>
    );
  }

  /* =========================
     LOADING
  ========================= */
  if (loading) {
    return (
      <main className="dashboard">
        <section className="analysis-loading">
          <p className="eyebrow">DATASET ANALYSIS</p>
          <h1>Generating intelligence...</h1>
          <p className="intro">Computing automated distributions, statistics, and quality audit.</p>
        </section>
      </main>
    );
  }

  /* =========================
     ERROR
  ========================= */
  if (error) {
    return (
      <main className="dashboard">
        <section className="analysis-error">
          <p className="eyebrow">DATASET ANALYSIS</p>
          <h1>Something went wrong.</h1>
          <p>{error}</p>
          <button
            className="secondary-button"
            onClick={() => navigate("/datasets")}
          >
            <ArrowLeft size={16} />
            Back to datasets
          </button>
        </section>
      </main>
    );
  }

  if (!analysis) {
    return null;
  }

  /* =========================
     NORMALIZE BACKEND DATA
  ========================= */
  const profile = analysis.profile || analysis.data_profile || null;
  const statistics = analysis.statistics || analysis.statistical_analysis || null;
  const quality = analysis.quality || analysis.data_quality || null;
  const visualizations = analysis.visualizations || analysis.visualization_data || null;
  const correlations = analysis.correlations || visualizations?.correlations || null;
  const insights = analysis.insights || analysis.key_findings || [];
  const aiAnalysis = analysis.ai_analysis || analysis.ai_interpretation || analysis.analysis || null;

  /* =========================
     SUMMARY VALUES
  ========================= */
  const rowCount =
    profile?.row_count ??
    statistics?.row_count ??
    quality?.row_count ??
    analysis.dataset?.row_count ??
    0;

  const columnCount =
    profile?.column_count ??
    statistics?.column_count ??
    quality?.column_count ??
    analysis.dataset?.column_count ??
    0;

  const healthScore = quality?.health_score ?? 100;
  const healthStatus = quality?.health_status ?? "Good";
  const healthClass = String(healthStatus).toLowerCase();

  const missingPercentage = quality?.missing_percentage ?? 0;
  const duplicateRows = quality?.duplicate_rows ?? 0;
  const outliersList = Array.isArray(quality?.outliers) ? quality.outliers : [];
  const topCorrelations = Array.isArray(correlations?.top_correlations) ? correlations.top_correlations : [];

  const findingsList = formatList(aiAnalysis?.key_findings || aiAnalysis?.findings);
  const recommendationsList = formatList(aiAnalysis?.recommendations);

  const datasetName =
    analysis.dataset_name ||
    analysis.dataset?.name ||
    analysis.name ||
    datasets.find((d) => String(d.id) === String(selectedDatasetId))?.name ||
    "";

  return (
    <main className="dashboard analysis-page">
      <SEOHead
        title={datasetName ? `Automated EDA: ${datasetName}` : "Automated EDA & Statistical Profiling"}
        description="Instant statistical profiling, Pearson correlation heatmaps, IQR anomaly detection, and automated data quality scoring."
        canonicalUrl="https://www.cyphercorp.in/analysis"
      />
      {/* =========================
          HEADER
      ========================= */}
      <section className="analysis-header">
        <div className="analysis-header-top">
          <button
            className="analysis-back-btn"
            onClick={() => navigate("/datasets")}
          >
            <ArrowLeft size={15} />
            <span>Back to datasets</span>
          </button>

          {/* Dataset Selector Dropdown */}
          {datasets.length > 0 && (
            <div className="dataset-selector-wrapper">
              <label className="eyebrow">ACTIVE DATASET</label>
              <div className="dataset-select-box">
                <Database size={15} />
                <select
                  value={selectedDatasetId ? String(selectedDatasetId) : ""}
                  onChange={(e) => handleDatasetChange(e.target.value)}
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.name} ({Number(d.row_count || 0).toLocaleString()} rows)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="analysis-header-main">
          <p className="eyebrow">AUTOMATED EDA ENGINE</p>
          <h1 className="analysis-title">
            {analysis.dataset_name ||
              analysis.dataset?.name ||
              analysis.name ||
              "Dataset"}
          </h1>
          <p className="intro">
            Complete statistical profiling, automated quality audit, distributions,
            correlations, and AI-powered data intelligence.
          </p>
        </div>
      </section>

      {/* =========================
          SUMMARY CARDS
      ========================= */}
      <section className="analysis-summary">
        <div className="summary-card">
          <div className="summary-icon">
            <Rows3 size={18} />
          </div>
          <div className="summary-content">
            <p className="eyebrow">ROWS</p>
            <strong>{rowCount.toLocaleString()}</strong>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <Columns3 size={18} />
          </div>
          <div className="summary-content">
            <p className="eyebrow">COLUMNS</p>
            <strong>{columnCount}</strong>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <CircleCheck size={18} />
          </div>
          <div className="summary-content">
            <p className="eyebrow">HEALTH SCORE</p>
            <div className="summary-value-row">
              <strong>{healthScore}/100</strong>
              <span className={`health-badge ${healthClass}`}>
                {healthStatus}
              </span>
            </div>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <AlertTriangle size={18} />
          </div>
          <div className="summary-content">
            <p className="eyebrow">MISSING CELLS</p>
            <strong>{missingPercentage}%</strong>
          </div>
        </div>
      </section>

      {/* =========================
          AI INSIGHTS
      ========================= */}
      {insights.length > 0 && (
        <section className="analysis-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">KEY FINDINGS</p>
              <h2>Automated insights</h2>
            </div>
            <Sparkles size={22} />
          </div>

          <div className="insights-grid">
            {insights.map((insight, index) => (
              <div
                className={`insight-card severity-${insight.severity || "info"}`}
                key={index}
              >
                <div className="insight-card-header">
                  <span className={`severity-tag ${insight.severity || "info"}`}>
                    {(insight.severity || "INFO").toUpperCase()}
                  </span>
                  <strong>{insight.title}</strong>
                </div>
                <p>{insight.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =========================
          AI DATA SCIENTIST INTERPRETATION
      ========================= */}
      {aiAnalysis && (
        <section className="analysis-section">
          <div className="section-heading">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                <p className="eyebrow" style={{ margin: 0 }}>AI DATA SCIENTIST</p>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: "rgba(16, 185, 129, 0.12)",
                    color: "#10b981",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <Zap size={11} />
                  {aiAnalysis?.cached !== false ? "Cached Report" : "Live Generated"}
                </span>
              </div>
              <h2>LLM Interpretation</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                className="secondary-button"
                style={{
                  fontSize: "12px",
                  padding: "6px 14px",
                  height: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
                onClick={handleRegenerateAi}
                disabled={regeneratingAi}
                title="Re-run AI model interpretation on this dataset"
              >
                <RotateCcw size={13} className={regeneratingAi ? "spin" : ""} />
                {regeneratingAi ? "Analyzing..." : "Regenerate Analysis"}
              </button>
              <Sparkles size={22} />
            </div>
          </div>

          <div className="ai-interpretation-card">
            <div className="ai-content">
              {typeof aiAnalysis === "string" ? (
                <p>{renderFormattedAiText(aiAnalysis)}</p>
              ) : (
                <>
                  {aiAnalysis.summary && (
                    <div className="ai-block">
                      <h4>EXECUTIVE SUMMARY</h4>
                      <p>{renderFormattedAiText(aiAnalysis.summary)}</p>
                    </div>
                  )}
                  {aiAnalysis.data_quality && (
                    <div className="ai-block">
                      <h4>DATA QUALITY AUDIT</h4>
                      <p>{renderFormattedAiText(aiAnalysis.data_quality)}</p>
                    </div>
                  )}
                  {findingsList.length > 0 && (
                    <div className="ai-block">
                      <h4>KEY OBSERVATIONS</h4>
                      <ul>
                        {findingsList.map((f, i) => (
                          <li key={i}>{renderFormattedAiText(f)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {recommendationsList.length > 0 && (
                    <div className="ai-block">
                      <h4>RECOMMENDED ACTIONS</h4>
                      <ul>
                        {recommendationsList.map((r, i) => (
                          <li key={i}>{renderFormattedAiText(r)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* =========================
          DATA PROFILE TABLE
      ========================= */}
      {profile && (
        <section className="analysis-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DATA PROFILE</p>
              <h2>Column breakdown</h2>
            </div>
          </div>

          <div className="profile-table">
            <div className="profile-row header">
              <span>Column</span>
              <span>Type</span>
              <span>Unique</span>
              <span>Missing</span>
            </div>

            {(profile.columns || []).map((column) => (
              <div className="profile-row" key={column.name}>
                <span>{column.name}</span>
                <span>
                  <code>{column.data_type ?? column.dtype ?? "unknown"}</code>
                </span>
                <span>
                  {column.unique_values ?? column.unique_count ?? 0}
                </span>
                <span>
                  {column.missing_values ?? column.missing_count ?? 0}
                  {column.missing_percentage > 0 && (
                    <small style={{ color: "var(--muted)", marginLeft: "6px" }}>
                      ({column.missing_percentage}%)
                    </small>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =========================
          STATISTICS
      ========================= */}
      {statistics && (
        <section className="analysis-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">STATISTICS</p>
              <h2>Statistical profile</h2>
            </div>
            <Activity size={22} />
          </div>

          <div className="statistics-grid">
            {(statistics.columns || []).map((column) => {
              const stats = column.statistics;
              const catStats = column.categorical_statistics;

              return (
                <div className="stat-card" key={column.name}>
                  <div className="stat-card-header">
                    <code>
                      {column.dtype ?? column.data_type ?? "unknown"}
                    </code>
                    <h3>{column.name}</h3>
                    <p>
                      {column.unique_count ?? column.unique_values ?? 0} unique
                      values · {column.missing_count ?? 0} missing
                    </p>
                  </div>

                  {stats && (
                    <div className="numeric-stats-2x2">
                      <div className="stat-cell" title={`Min: ${stats.min}`}>
                        <span>MIN</span>
                        <strong>{formatStatValue(stats.min, column.name, "min")}</strong>
                      </div>
                      <div className="stat-cell" title={`Max: ${stats.max}`}>
                        <span>MAX</span>
                        <strong>{formatStatValue(stats.max, column.name, "max")}</strong>
                      </div>
                      <div className="stat-cell" title={`Mean: ${stats.mean}`}>
                        <span>MEAN</span>
                        <strong>{formatStatValue(stats.mean, column.name, "mean")}</strong>
                      </div>
                      <div className="stat-cell" title={`Median: ${stats.median}`}>
                        <span>MEDIAN</span>
                        <strong>{formatStatValue(stats.median, column.name, "median")}</strong>
                      </div>
                    </div>
                  )}

                  {catStats && (
                    <div className="categorical-stats-box">
                      <div className="cat-stat-row" title={`Top Value: ${catStats.top_value}`}>
                        <span>TOP VALUE</span>
                        <strong>{catStats.top_value ?? "—"}</strong>
                      </div>
                      <div className="cat-stat-row" title={`Frequency: ${catStats.top_frequency} (${catStats.top_percentage}%)`}>
                        <span>FREQUENCY</span>
                        <strong>
                          {Number(catStats.top_frequency).toLocaleString()} ({catStats.top_percentage}%)
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* =========================
          DATA QUALITY & ANOMALIES
      ========================= */}
      {quality && (
        <section className="analysis-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DATA QUALITY AUDIT</p>
              <h2>Quality assessment & anomalies</h2>
            </div>
            <AlertTriangle size={22} />
          </div>

          <div className="quality-overview">
            <div className="quality-status">
              <span>OVERALL HEALTH</span>
              <h3>
                {healthScore}/100 — {healthStatus}
              </h3>
              <p>
                {missingPercentage}% missing cells · {duplicateRows} duplicate
                rows · {outliersList.length} columns with outliers
              </p>
            </div>

            <div className="quality-metrics">
              <div>
                <span>MISSING CELLS</span>
                <strong>{quality.missing_cells ?? 0}</strong>
              </div>

              <div>
                <span>DUPLICATE ROWS</span>
                <strong>{duplicateRows}</strong>
              </div>

              <div>
                <span>EMPTY COLUMNS</span>
                <strong>{quality.empty_columns?.length ?? 0}</strong>
              </div>

              <div>
                <span>CONSTANT COLUMNS</span>
                <strong>{quality.constant_columns?.length ?? 0}</strong>
              </div>
            </div>
          </div>

          {/* Outliers */}
          {outliersList.length > 0 && (
            <div className="outliers-section">
              <p className="eyebrow">STATISTICAL OUTLIERS (IQR)</p>
              <div className="outliers-grid">
                {outliersList.map((out) => (
                  <div className="outlier-card" key={out.column}>
                    <strong>{out.column}</strong>
                    <p>
                      {out.count} outlier(s) ({out.percentage}%)
                    </p>
                    <p style={{ marginTop: "4px", fontSize: "11px" }}>
                      Bounds: [{out.lower_bound}, {out.upper_bound}]
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* =========================
          VISUALIZATIONS
      ========================= */}
      {visualizations && (
        <section className="analysis-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DISTRIBUTIONS & FREQUENCIES</p>
              <h2>Explore your data</h2>
            </div>
            <BarChart3 size={22} />
          </div>

          {/* Visualization Type Filter Tabs */}
          {(() => {
            const vizList = visualizations.visualizations || [];
            const histCount = vizList.filter((v) => v.type === "histogram").length;
            const freqCount = vizList.filter((v) => v.type === "frequency").length;
            const timeCount = vizList.filter((v) => v.type === "time").length;
            const typeCount = (histCount > 0 ? 1 : 0) + (freqCount > 0 ? 1 : 0) + (timeCount > 0 ? 1 : 0);

            const filteredList = vizList.filter((v) => {
              if (vizFilterTab === "histogram") return v.type === "histogram";
              if (vizFilterTab === "frequency") return v.type === "frequency";
              if (vizFilterTab === "time") return v.type === "time";
              return true;
            });

            return (
              <>
                {typeCount > 1 && (
                  <div className="viz-filter-tabs">
                    <button
                      type="button"
                      className={`viz-tab-btn ${vizFilterTab === "all" ? "active" : ""}`}
                      onClick={() => setVizFilterTab("all")}
                    >
                      All ({vizList.length})
                    </button>
                    {histCount > 0 && (
                      <button
                        type="button"
                        className={`viz-tab-btn ${vizFilterTab === "histogram" ? "active" : ""}`}
                        onClick={() => setVizFilterTab("histogram")}
                      >
                        Numeric Distributions ({histCount})
                      </button>
                    )}
                    {freqCount > 0 && (
                      <button
                        type="button"
                        className={`viz-tab-btn ${vizFilterTab === "frequency" ? "active" : ""}`}
                        onClick={() => setVizFilterTab("frequency")}
                      >
                        Categories ({freqCount})
                      </button>
                    )}
                    {timeCount > 0 && (
                      <button
                        type="button"
                        className={`viz-tab-btn ${vizFilterTab === "time" ? "active" : ""}`}
                        onClick={() => setVizFilterTab("time")}
                      >
                        Timeline ({timeCount})
                      </button>
                    )}
                  </div>
                )}

                <div className="visualization-grid">
                  {filteredList.map((visualization, index) => {
                    const maxCount = Math.max(
                      ...(visualization.data?.map((d) => d.count) || [1]),
                      1
                    );

                    return (
                      <div
                        className="visualization-card"
                        key={`${visualization.column}-${index}`}
                      >
                        <p className="eyebrow">
                          {visualization.type === "histogram"
                            ? "DISTRIBUTION"
                            : visualization.type === "time"
                            ? "TIMELINE"
                            : "CATEGORIES"}
                        </p>

                        <h3>{visualization.column}</h3>

                        <div className="viz-bars">
                          {visualization.data?.slice(0, 10).map((d, i) => (
                            <div className="viz-bar-row" key={i}>
                              <span className="viz-bar-label" title={d.label || d.value || d.bucket || "—"}>
                                {d.label || d.value || d.bucket || "—"}
                              </span>
                              <div className="viz-bar-track">
                                <div
                                  className="viz-bar-fill"
                                  style={{
                                    width: `${Math.max(3, (d.count / maxCount) * 100)}%`,
                                  }}
                                />
                              </div>
                              <span className="viz-bar-count mono">{Number(d.count).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </section>
      )}

      {/* =========================
          KEY FEATURE CORRELATIONS & HEATMAP
      ========================= */}
      <section className="analysis-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">RELATIONSHIPS & HEATMAP</p>
            <h2>Key feature correlations</h2>
          </div>

          {topCorrelations.length > 0 && (
            <div className="corr-view-switcher">
              <button
                type="button"
                className={`corr-view-btn ${corrViewMode === "both" ? "active" : ""}`}
                onClick={() => setCorrViewMode("both")}
              >
                Overview (Both)
              </button>
              <button
                type="button"
                className={`corr-view-btn ${corrViewMode === "heatmap" ? "active" : ""}`}
                onClick={() => setCorrViewMode("heatmap")}
              >
                Heatmap Matrix
              </button>
              <button
                type="button"
                className={`corr-view-btn ${corrViewMode === "cards" ? "active" : ""}`}
                onClick={() => setCorrViewMode("cards")}
              >
                Relationship Cards ({topCorrelations.length})
              </button>
            </div>
          )}
        </div>

        {topCorrelations.length > 0 ? (
          <>
            {/* Correlation Matrix Heatmap Chart */}
            {(corrViewMode === "both" || corrViewMode === "heatmap") && (
              <CorrelationHeatmap
                columns={correlations?.columns || []}
                matrix={correlations?.matrix || []}
                topCorrelations={topCorrelations}
              />
            )}

            {/* Key Relationship Cards */}
            {(corrViewMode === "both" || corrViewMode === "cards") && (
              <div className="correlations-grid">
                {topCorrelations.map((corr, idx) => {
                  const col1 = corr.feature_a || corr.column1 || corr.col1 || "Feature A";
                  const col2 = corr.feature_b || corr.column2 || corr.col2 || "Feature B";
                  const val = typeof corr.correlation === "number" ? corr.correlation : 0;
                  const isPositive = val >= 0;
                  const absVal = Math.min(1, Math.abs(val));

                  // Standard 5-tier classification scale
                  const tier = corr.tier || (
                    absVal >= 0.80 ? "Very Strong" :
                    absVal >= 0.60 ? "Strong" :
                    absVal >= 0.40 ? "Moderate" :
                    absVal >= 0.20 ? "Weak" :
                    "Very Weak"
                  );
                  const strength = corr.strength || `${tier} ${isPositive ? "Positive" : "Negative"}`;

                  return (
                    <div className="correlation-card" key={idx}>
                      <div className="corr-header">
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {isPositive ? (
                            <TrendingUp
                              size={16}
                              style={{ color: "#16a34a" }}
                            />
                          ) : (
                            <TrendingDown
                              size={16}
                              style={{ color: "#dc2626" }}
                            />
                          )}
                          <span className={`corr-strength-badge ${isPositive ? "positive" : "negative"}`}>
                            {strength}
                          </span>
                        </div>
                        <span className={`corr-value-badge ${isPositive ? "positive" : "negative"}`}>
                          {val > 0 ? `+${val.toFixed(3)}` : val.toFixed(3)}
                        </span>
                      </div>

                      <div className="corr-features-row">
                        <span className="corr-feature-name" title={col1}>{col1}</span>
                        <span className="corr-vs-badge">vs</span>
                        <span className="corr-feature-name" title={col2}>{col2}</span>
                      </div>

                      <div className="corr-bar-section">
                        <div className="corr-track">
                          <div
                            className="corr-val-fill"
                            style={{
                              width: `${Math.max(4, absVal * 100)}%`,
                              background: isPositive ? "#16a34a" : "#dc2626",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="analysis-empty-card">
            <GitCommit size={24} className="empty-card-icon" />
            <h4>Not enough numeric variables</h4>
            <p>
              At least two suitable numeric columns are required to calculate correlations.
              This dataset currently contains {correlations?.numeric_column_count ?? 0} suitable numeric column(s).
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

export default Analysis;