import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Database,
  Trophy,
  Play,
  Activity,
  Layers,
  BarChart2,
  CheckCircle,
  Zap,
  Info,
  RotateCcw,
  Sparkles,
  Check,
  X,
  ShieldCheck,
  Filter,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import {
  getCachedDatasets,
  getDatasets,
  getDatasetMlTargets,
  trainAutoMl,
  getDatasetBenchmark,
  predictAutoMl,
} from "../services/api";
import TargetSelectDropdown from "../components/TargetSelectDropdown";
import SEOHead from "../components/SEOHead";

const MODEL_DESCRIPTIONS = {
  "AutoML Pipeline": {
    family: "Automated Machine Learning",
    description:
      "AutoML automates data cleaning, zero-leakage preprocessing, categorical encoding, feature scaling, 3-fold cross-validation benchmarking, and champion model serialization.",
    strengths: "Fast end-to-end prototyping, unbiased model selection, leakage prevention, and instant real-time inference.",
  },
  "Random Forest Classifier": {
    family: "Ensemble Bagging",
    description:
      "Builds an ensemble of decision trees using random feature subsets. Predictions are determined by majority voting across all trees.",
    strengths: "Resistant to overfitting, handles complex non-linear interactions, and excels with mixed data types.",
  },
  "Gradient Boosting": {
    family: "Sequential Boosting",
    description:
      "Trains trees sequentially, where each new tree specifically focuses on correcting the errors (residuals) made by previous trees.",
    strengths: "Often delivers state-of-the-art accuracy on structured tabular datasets.",
  },
  "Logistic Regression": {
    family: "Generalized Linear Model",
    description:
      "Calculates a linear combination of input features and passes it through a logistic sigmoid function to output calibrated probabilities between 0 and 1.",
    strengths: "Fast training, mathematically rigorous, and provides clear linear feature interpretability.",
  },
  "Decision Tree": {
    family: "Tree-Based Partitioner",
    description:
      "Recursively splits the feature space using optimal decision thresholds that maximize Gini impurity reduction or information gain.",
    strengths: "Highly interpretable, fast inference, and captures step-function relationships.",
  },
  "Random Forest Regressor": {
    family: "Ensemble Bagging",
    description:
      "Constructs parallel regression trees and averages their continuous predictions to forecast quantitative outcomes.",
    strengths: "Low variance, resistant to noisy outliers, and captures non-linear price/revenue trends.",
  },
  "Gradient Boosting Regressor": {
    family: "Sequential Boosting",
    description:
      "Iteratively optimizes Mean Squared Error loss by fitting successive shallow trees directly to the negative gradient residuals.",
    strengths: "Exceptional predictive precision for continuous targets such as prices, salaries, and scores.",
  },
  "Ridge Regression": {
    family: "Regularized Linear Model",
    description:
      "Performs linear regression with an L2 penalty on coefficient magnitudes to prevent multicollinearity and extreme weights.",
    strengths: "Stable coefficients, prevents overfitting in correlated datasets, and fast computation.",
  },
  "Linear Regression": {
    family: "Ordinary Least Squares",
    description:
      "Finds the optimal linear hyperplane minimizing the sum of squared differences between observed and predicted continuous values.",
    strengths: "Zero hyperparameter tuning required, establishes standard baseline performance.",
  },
};

function getFeatureDefinitions(result) {
  if (!result) return [];
  if (result.raw_features && result.raw_features.length > 0) {
    return result.raw_features;
  }

  const rawList = [];
  const catGroups = {};
  const names = result.feature_names || [];

  names.forEach((fn) => {
    if (fn.includes("_")) {
      const parts = fn.split("_");
      const prefix = parts[0];
      const val = parts.slice(1).join("_");
      if (!catGroups[prefix]) catGroups[prefix] = [];
      if (!catGroups[prefix].includes(val)) catGroups[prefix].push(val);
    } else {
      rawList.push({
        name: fn,
        type: "numeric",
        default_value: 0,
        sample_value: 10,
      });
    }
  });

  Object.entries(catGroups).forEach(([catName, opts]) => {
    rawList.push({
      name: catName,
      type: "categorical",
      options: opts,
      default_value: opts[0] || "Missing",
      sample_value: opts[0] || "Missing",
    });
  });

  return rawList;
}

function MlStudio() {
  const { datasetId: routeDatasetId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [datasets, setDatasets] = useState(() => getCachedDatasets());
  const [selectedDatasetId, setSelectedDatasetId] = useState(
    routeDatasetId || searchParams.get("datasetId") || ""
  );

  const [targets, setTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [targetInfo, setTargetInfo] = useState(null);
  const [recommendedTarget, setRecommendedTarget] = useState("");
  const [recommendationBanner, setRecommendationBanner] = useState("");
  const [featureIntelligence, setFeatureIntelligence] = useState([]);
  const [featureSelectionMap, setFeatureSelectionMap] = useState({});
  const [showFeaturePanel, setShowFeaturePanel] = useState(false);

  const [training, setTraining] = useState(false);
  const [mlResult, setMlResult] = useState(null);
  const [error, setError] = useState("");

  // Live Predictor State
  const [predictInputs, setPredictInputs] = useState({});
  const [predicting, setPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState(null);
  const [fillFeedback, setFillFeedback] = useState(false);

  // Info Modal State
  const [activeInfoModal, setActiveInfoModal] = useState(null);

  // 1. Load user datasets
  useEffect(() => {
    const loadDatasets = async () => {
      try {
        const res = await getDatasets();
        const list = res.data || [];
        setDatasets(list);
        if (!routeDatasetId && list.length > 0) {
          const defaultId = String(list[0].id);
          setSelectedDatasetId(defaultId);
          navigate(`/ml/${defaultId}`, { replace: true });
        }
      } catch (err) {
        console.error("Failed to load datasets:", err);
      }
    };
    loadDatasets();
  }, [navigate, routeDatasetId]);

  // 2. Synchronize route datasetId parameter
  useEffect(() => {
    if (routeDatasetId) {
      setSelectedDatasetId(String(routeDatasetId));
      setMlResult(null);
      setPredictionResult(null);
      setError("");
    }
  }, [routeDatasetId]);

  // 3. Load target column candidates & restore existing benchmark
  useEffect(() => {
    if (!selectedDatasetId) return;

    // Check localStorage cache first for instant zero-lag restore
    const cached = localStorage.getItem(`ml_benchmark_${selectedDatasetId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed?.leaderboard) {
          setMlResult(parsed);
          if (parsed.target_column) {
            setSelectedTarget(parsed.target_column);
          }
        }
      } catch (e) {
        console.warn("Failed to parse cached benchmark:", e);
      }
    }

    const loadTargetsAndBenchmark = async () => {
      try {
        setError("");
        const res = await getDatasetMlTargets(selectedDatasetId);
        const candidates = res.target_candidates || [];
        setTargets(candidates);
        setRecommendedTarget(res.recommended_target || "");
        setRecommendationBanner(res.recommendation_banner || "");

        const featList = res.feature_intelligence || [];
        setFeatureIntelligence(featList);

        // Initialize feature selection map
        const initialSelection = {};
        featList.forEach((f) => {
          initialSelection[f.name] = !f.is_excluded_by_default;
        });
        setFeatureSelectionMap(initialSelection);

        // Auto-select recommended target
        const defaultTargetName = res.recommended_target || (candidates[0]?.name ?? "");
        setSelectedTarget(defaultTargetName);
        const found = candidates.find((c) => c.name === defaultTargetName) || candidates[0];
        setTargetInfo(found || null);

        // Fetch backend benchmark cache if not already restored
        try {
          const benchmarkRes = await getDatasetBenchmark(selectedDatasetId);
          if (benchmarkRes && benchmarkRes.leaderboard) {
            setMlResult(benchmarkRes);
            if (benchmarkRes.target_column) {
              setSelectedTarget(benchmarkRes.target_column);
              const bFound = candidates.find((c) => c.name === benchmarkRes.target_column);
              if (bFound) setTargetInfo(bFound);
            }
            localStorage.setItem(
              `ml_benchmark_${selectedDatasetId}`,
              JSON.stringify(benchmarkRes)
            );
          }
        } catch {
          // Non-fatal, benchmark may not exist yet
        }
      } catch (err) {
        console.error("Failed to load targets:", err);
        setError(err.response?.data?.detail || "Unable to read dataset target columns.");
      }
    };

    loadTargetsAndBenchmark();
  }, [selectedDatasetId]);

  // 4. Automatically populate inputs whenever mlResult changes
  useEffect(() => {
    if (!mlResult) return;
    const feats = getFeatureDefinitions(mlResult);
    const populated = {};
    feats.forEach((f) => {
      if (
        mlResult.sample_record &&
        mlResult.sample_record[f.name] !== undefined &&
        mlResult.sample_record[f.name] !== null
      ) {
        populated[f.name] = mlResult.sample_record[f.name];
      } else if (f.sample_value !== undefined && f.sample_value !== null) {
        populated[f.name] = f.sample_value;
      } else {
        populated[f.name] = f.default_value ?? (f.type === "numeric" ? 0 : "");
      }
    });
    setPredictInputs(populated);
  }, [mlResult]);

  const handleDatasetChange = (newId) => {
    if (!newId) return;
    setSelectedDatasetId(String(newId));
    setMlResult(null);
    setPredictionResult(null);
    setError("");
    navigate(`/ml/${newId}`);
  };

  const handleTargetChange = (targetName) => {
    setSelectedTarget(targetName);
    const found = targets.find((t) => t.name === targetName);
    setTargetInfo(found || null);
  };

  const handleApplyRecommended = () => {
    if (recommendedTarget) {
      handleTargetChange(recommendedTarget);
    }
  };

  const handleToggleFeature = (featName) => {
    setFeatureSelectionMap((prev) => ({
      ...prev,
      [featName]: !prev[featName],
    }));
  };

  const handleResetFeatureExclusions = () => {
    const defaultSelection = {};
    featureIntelligence.forEach((f) => {
      defaultSelection[f.name] = !f.is_excluded_by_default;
    });
    setFeatureSelectionMap(defaultSelection);
  };

  const handleTrainAutoMl = async () => {
    if (!selectedDatasetId || !selectedTarget) return;

    try {
      setTraining(true);
      setError("");
      setPredictionResult(null);

      // Determine excluded and included features from map
      const excluded = [];
      const included = [];

      Object.entries(featureSelectionMap).forEach(([featName, isChecked]) => {
        if (featName === selectedTarget) return;
        if (isChecked) {
          included.push(featName);
        } else {
          excluded.push(featName);
        }
      });

      const res = await trainAutoMl(selectedDatasetId, {
        target_column: selectedTarget,
        excluded_features: excluded,
        included_features: included,
      });

      setMlResult(res);
      try {
        localStorage.setItem(
          `ml_benchmark_${selectedDatasetId}`,
          JSON.stringify(res)
        );
      } catch (saveErr) {
        console.warn("Storage quota exceeded:", saveErr);
      }
    } catch (err) {
      console.error("AutoML training failed:", err);
      setError(err.response?.data?.detail || "AutoML model training failed.");
    } finally {
      setTraining(false);
    }
  };

  const handleRunPrediction = async () => {
    if (!mlResult?.model_file) return;

    try {
      setPredicting(true);
      setError("");
      const res = await predictAutoMl(selectedDatasetId, {
        model_file: mlResult.model_file,
        features: predictInputs,
      });
      setPredictionResult(res);
    } catch (err) {
      console.error("Prediction failed:", err);
      setError(err.response?.data?.detail || "Prediction failed.");
    } finally {
      setPredicting(false);
    }
  };

  const handleLoadExample = () => {
    if (!mlResult) return;
    const feats = getFeatureDefinitions(mlResult);
    const populated = {};
    feats.forEach((f) => {
      if (
        mlResult.sample_record &&
        mlResult.sample_record[f.name] !== undefined &&
        mlResult.sample_record[f.name] !== null
      ) {
        populated[f.name] = mlResult.sample_record[f.name];
      } else if (f.sample_value !== undefined && f.sample_value !== null) {
        populated[f.name] = f.sample_value;
      } else {
        populated[f.name] = f.default_value ?? (f.type === "numeric" ? 0 : "");
      }
    });
    setPredictInputs(populated);
    setFillFeedback(true);
    setTimeout(() => setFillFeedback(false), 2000);
  };

  const handleResetInputs = () => {
    if (!mlResult) return;
    const feats = getFeatureDefinitions(mlResult);
    const resetMap = {};
    feats.forEach((rf) => {
      resetMap[rf.name] = "";
    });
    setPredictInputs(resetMap);
    setPredictionResult(null);
  };

  const openInfoModal = (modelName) => {
    const details = MODEL_DESCRIPTIONS[modelName] || {
      family: "Machine Learning Algorithm",
      description: `Mathematical model optimized for ${mlResult?.problem_type || "predictive"} tasks.`,
      strengths: "Evaluated on isolated test data and 3-fold cross-validation for optimal generalization.",
    };
    setActiveInfoModal({ title: modelName, data: details });
  };

  const currentFeatures = getFeatureDefinitions(mlResult);

  // Compute counts for feature intelligence panel
  const totalCandidateFeatures = featureIntelligence.filter((f) => f.name !== selectedTarget).length;
  const activeFeatureCount = Object.entries(featureSelectionMap).filter(
    ([name, active]) => active && name !== selectedTarget
  ).length;
  const excludedFeatureCount = totalCandidateFeatures - activeFeatureCount;

  return (
    <main className="dashboard ml-studio-page">
      <SEOHead
        title="Multi-Model AutoML Studio & Benchmarks"
        description="Automated feature preprocessing, candidate benchmark trainer across Random Forest, Gradient Boosting, Ridge, and live prediction sandbox."
        canonicalUrl="https://cyphercorp.com/ml"
      />
      {/* =========================
          INFO MODAL POPUP
      ========================= */}
      {activeInfoModal && (
        <div className="ml-info-modal-backdrop" onClick={() => setActiveInfoModal(null)}>
          <div className="ml-info-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ml-info-modal-header">
              <div className="ml-info-title-group">
                <div className="ml-info-badge">{activeInfoModal.data.family}</div>
                <h3>{activeInfoModal.title}</h3>
              </div>
              <button
                type="button"
                className="ml-info-close-btn"
                onClick={() => setActiveInfoModal(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="ml-info-modal-body">
              <div className="ml-info-section">
                <label className="eyebrow">HOW IT WORKS</label>
                <p>{activeInfoModal.data.description}</p>
              </div>

              <div className="ml-info-section">
                <label className="eyebrow">KEY STRENGTHS</label>
                <p>{activeInfoModal.data.strengths}</p>
              </div>
            </div>

            <div className="ml-info-modal-footer">
              <button
                type="button"
                className="settings-btn-primary"
                onClick={() => setActiveInfoModal(null)}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================
          HEADER
      ========================= */}
      <section className="ml-header">
        <div>
          <div className="ml-eyebrow-row">
            <span className="eyebrow">AUTOMATED MACHINE LEARNING</span>
            <button
              type="button"
              className="info-icon-btn"
              title="What is AutoML?"
              onClick={() => openInfoModal("AutoML Pipeline")}
            >
              <Info size={14} />
              <span>What is AutoML?</span>
            </button>
          </div>
          <h1>ML Studio & AutoML.</h1>
          <p className="intro">
            Automated feature intelligence, leakage prevention, stratified cross-validation,
            and real-time prediction deployment for classification and regression.
          </p>
        </div>

        {/* Dataset Selector */}
        <div className="dataset-selector-wrapper">
          <label className="eyebrow">ACTIVE DATASET</label>
          <div className="dataset-select-box">
            <Database size={16} />
            <select
              value={selectedDatasetId ? String(selectedDatasetId) : ""}
              onChange={(e) => handleDatasetChange(e.target.value)}
            >
              {datasets.length === 0 ? (
                <option value="">No datasets found</option>
              ) : (
                datasets.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name} ({d.row_count} rows)
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </section>

      {/* ========================================================
          INTELLIGENCE & RECOMMENDATION BANNER
          ======================================================== */}
      {recommendationBanner && (
        <section className="ml-intelligence-banner">
          <div className="ml-intelligence-content">
            <div className="ml-intelligence-icon">
              <Sparkles size={20} />
            </div>
            <div className="ml-intelligence-text">
              <h4>AutoML Target Intelligence</h4>
              <p>{recommendationBanner}</p>
            </div>
          </div>

          {recommendedTarget && selectedTarget !== recommendedTarget && (
            <button
              type="button"
              className="ml-apply-rec-btn"
              onClick={handleApplyRecommended}
            >
              <Check size={14} />
              <span>Select {recommendedTarget}</span>
            </button>
          )}
        </section>
      )}

      {/* =========================
          TRAINING CONFIGURATION
      ========================= */}
      <section className="ml-config-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CONFIGURATION</p>
            <h2>Select Target Variable</h2>
          </div>
          <Layers size={22} />
        </div>

        <div className="target-selection-grid">
          <div className="target-select-card">
            <div className="target-select-label-row">
              <label className="eyebrow">PREDICTIVE TARGET (Y)</label>
              <span className="target-select-helper-text">
                Choose outcome category or metric to forecast
              </span>
            </div>

            <TargetSelectDropdown
              targets={targets}
              selectedTarget={selectedTarget}
              onSelectTarget={handleTargetChange}
              disabled={training}
            />

            {targetInfo && (
              <>
                <div className="target-meta-box">
                  <div>
                    <span className="eyebrow">TASK TYPE</span>
                    <strong className={`task-badge ${targetInfo.suggested_task}`}>
                      {targetInfo.suggested_task.toUpperCase()}
                    </strong>
                  </div>
                  <div>
                    <span className="eyebrow">UNIQUE VALUES</span>
                    <strong>{targetInfo.unique_count?.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="eyebrow">DATA TYPE</span>
                    <code>{targetInfo.data_type}</code>
                  </div>
                </div>

                {/* Target Quality Breakdown Card */}
                <div className="target-quality-card">
                  <div className="target-quality-header">
                    <span className="eyebrow">TARGET QUALITY ASSESSMENT</span>
                    <span className={`quality-verdict-badge ${targetInfo.status || "recommended"}`}>
                      {targetInfo.quality_verdict || "Evaluated"}
                    </span>
                  </div>

                  {targetInfo.quality_reasons && targetInfo.quality_reasons.length > 0 && (
                    <ul className="target-quality-reasons">
                      {targetInfo.quality_reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}

                  {/* Class Distribution Breakdown */}
                  {targetInfo.class_distribution && targetInfo.class_distribution.length > 0 && (
                    <div className="target-distribution-preview">
                      <span className="eyebrow">CLASS DISTRIBUTION</span>
                      {targetInfo.class_distribution.map((cd) => (
                        <div className="dist-bar-item" key={cd.class_name}>
                          <span className="dist-bar-label" title={cd.class_name}>
                            {cd.class_name}
                          </span>
                          <div className="dist-bar-track">
                            <div
                              className="dist-bar-fill"
                              style={{ width: `${Math.max(4, cd.percentage)}%` }}
                            />
                          </div>
                          <span className="dist-bar-pct">{cd.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Numeric Variance Breakdown */}
                  {targetInfo.variance_info && (
                    <div className="variance-stats-grid">
                      <div className="variance-stat-box">
                        <span>Mean</span>
                        <strong>{targetInfo.variance_info.mean}</strong>
                      </div>
                      <div className="variance-stat-box">
                        <span>Std Dev</span>
                        <strong>{targetInfo.variance_info.std}</strong>
                      </div>
                      <div className="variance-stat-box">
                        <span>Min</span>
                        <strong>{targetInfo.variance_info.min}</strong>
                      </div>
                      <div className="variance-stat-box">
                        <span>Max</span>
                        <strong>{targetInfo.variance_info.max}</strong>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="automl-action-card">
            <div>
              <h3>Train & Benchmark Models</h3>
              <p>
                AutoML enforces zero data leakage, runs 3-fold stratified cross-validation on
                the training set, benchmarks 4 candidate models, and isolates held-out test data.
              </p>
            </div>

            <button
              className="primary-button train-btn"
              disabled={training || !selectedTarget}
              onClick={handleTrainAutoMl}
            >
              <Play size={16} />
              {training ? "Training & Benchmarking..." : "Train AutoML Pipeline"}
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================
          FEATURE INTELLIGENCE & EXCLUSIONS ACCORDION
          ======================================================== */}
      {featureIntelligence.length > 0 && (
        <section className="feature-intelligence-card">
          <div
            className="feature-panel-header"
            onClick={() => setShowFeaturePanel((prev) => !prev)}
          >
            <div>
              <div className="ml-eyebrow-row">
                <span className="eyebrow">FEATURE INTELLIGENCE & LEAKAGE PREVENTION</span>
                <span className="info-icon-btn">
                  <ShieldCheck size={13} />
                  <span>Protected</span>
                </span>
              </div>
              <h3>Automated Feature Selection & Exclusions</h3>
              <div className="feature-summary-badges">
                <span className="feat-count-pill active">
                  <Check size={12} /> {activeFeatureCount} Features Active
                </span>
                {excludedFeatureCount > 0 && (
                  <span className="feat-count-pill excluded">
                    <Filter size={12} /> {excludedFeatureCount} Auto-Excluded
                  </span>
                )}
              </div>
            </div>

            <button type="button" className="info-icon-btn dark">
              {showFeaturePanel ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              <span>{showFeaturePanel ? "Hide Details" : "Review & Customize"}</span>
            </button>
          </div>

          {showFeaturePanel && (
            <div className="feature-table-container">
              <table className="feature-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>Use</th>
                    <th>Column Name</th>
                    <th>Data Type</th>
                    <th>Status</th>
                    <th>Exclusion / Leakage Note</th>
                  </tr>
                </thead>
                <tbody>
                  {featureIntelligence
                    .filter((f) => f.name !== selectedTarget)
                    .map((feat) => {
                      const isChecked = !!featureSelectionMap[feat.name];
                      let statusBadge = (
                        <span className="feat-status-pill included">Included Feature</span>
                      );

                      if (feat.is_identifier) {
                        statusBadge = (
                          <span className="feat-status-pill identifier">
                            Candidate Identifier
                          </span>
                        );
                      } else if (feat.leakage_risk !== "none") {
                        statusBadge = (
                          <span className="feat-status-pill leakage">
                            Target Leakage Risk
                          </span>
                        );
                      } else if (feat.is_constant) {
                        statusBadge = (
                          <span className="feat-status-pill constant">Constant Column</span>
                        );
                      }

                      return (
                        <tr key={feat.name}>
                          <td>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleFeature(feat.name)}
                            />
                          </td>
                          <td>
                            <strong>{feat.name}</strong>
                          </td>
                          <td>
                            <code>{feat.data_type}</code>
                          </td>
                          <td>{statusBadge}</td>
                          <td style={{ color: "var(--muted)", fontSize: "12px" }}>
                            {feat.exclusion_reason || "Ready for modeling."}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              <div className="feature-table-toolbar">
                <button
                  type="button"
                  className="reset-fill-btn"
                  onClick={handleResetFeatureExclusions}
                >
                  <RotateCcw size={12} />
                  <span>Reset to Recommended Defaults</span>
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* =========================
          ERROR CARD
      ========================= */}
      {error && (
        <section className="sql-error-card">
          <p className="eyebrow">AUTOML ERROR</p>
          <p>{error}</p>
        </section>
      )}

      {/* =========================
          TRAINING RESULTS & LEADERBOARD
      ========================= */}
      {mlResult && (
        <section className="ml-results-section">
          {/* Champion Banner */}
          <div className="champion-banner">
            <div className="champion-badge">
              <Trophy size={28} />
            </div>
            <div className="champion-info">
              <div className="champion-header-row">
                <span className="eyebrow">CHAMPION MODEL</span>
                <button
                  type="button"
                  className="info-icon-btn dark"
                  onClick={() => openInfoModal(mlResult.best_model_name)}
                >
                  <Info size={14} />
                  <span>Model Info</span>
                </button>
              </div>
              <h2>{mlResult.best_model_name}</h2>
              <p>
                Selected as the top performing model for predicting{" "}
                <strong>{mlResult.target_column}</strong> with a test score of{" "}
                <span className="score-highlight">
                  {mlResult.problem_type === "classification"
                    ? `F1: ${(mlResult.best_model_score * 100).toFixed(1)}%`
                    : `R²: ${mlResult.best_model_score.toFixed(3)}`}
                </span>
              </p>

              {mlResult.excluded_features_info && mlResult.excluded_features_info.length > 0 && (
                <div className="excluded-features-summary-row">
                  <span>Excluded Columns:</span>
                  {mlResult.excluded_features_info.map((ex) => (
                    <span className="excluded-chip" key={ex.name} title={ex.reason}>
                      {ex.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Leaderboard Table */}
          <div className="ml-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">MODEL LEADERBOARD</p>
                <h2>Algorithm Benchmark Comparison</h2>
              </div>
              <Activity size={22} />
            </div>

            {/* Validation Strategy Badge */}
            <div className="validation-methodology-banner">
              <ShieldCheck size={16} />
              <span>
                <strong>Zero Data Leakage Validation:</strong> Models evaluated on an isolated
                20% test holdout with 3-Fold Stratified Cross-Validation.
              </span>
            </div>

            <div className="table-scroll-wrapper">
              <table className="sql-table ml-leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Model Name</th>
                    <th>CV Score (3-Fold)</th>
                    {mlResult.problem_type === "classification" ? (
                      <>
                        <th>Test F1</th>
                        <th>Accuracy</th>
                        <th>Precision</th>
                        <th>Recall</th>
                      </>
                    ) : (
                      <>
                        <th>Test R²</th>
                        <th>RMSE</th>
                        <th>MAE</th>
                        <th>MSE</th>
                      </>
                    )}
                    <th>Training Time</th>
                    <th>Model Info</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mlResult.leaderboard?.map((item, idx) => (
                    <tr
                      key={item.model_name}
                      className={idx === 0 ? "winning-row" : ""}
                    >
                      <td>
                        <strong>#{idx + 1}</strong>
                      </td>
                      <td>
                        <strong>{item.model_name}</strong>
                      </td>
                      <td className="mono">
                        {item.cv_score_mean !== undefined
                          ? mlResult.problem_type === "classification"
                            ? `${(item.cv_score_mean * 100).toFixed(1)}% ± ${(item.cv_score_std * 100).toFixed(1)}%`
                            : `${item.cv_score_mean.toFixed(3)} ± ${item.cv_score_std.toFixed(2)}`
                          : "Evaluated"}
                      </td>
                      {mlResult.problem_type === "classification" ? (
                        <>
                          <td>
                            <strong>{(item.f1_score * 100).toFixed(1)}%</strong>
                          </td>
                          <td>{(item.accuracy * 100).toFixed(1)}%</td>
                          <td>{(item.precision * 100).toFixed(1)}%</td>
                          <td>{(item.recall * 100).toFixed(1)}%</td>
                        </>
                      ) : (
                        <>
                          <td>
                            <strong>{item.r2_score.toFixed(3)}</strong>
                          </td>
                          <td>{item.rmse.toFixed(2)}</td>
                          <td>{item.mae.toFixed(2)}</td>
                          <td>{item.mse.toFixed(2)}</td>
                        </>
                      )}
                      <td className="mono">{item.training_time_ms} ms</td>
                      <td>
                        <button
                          type="button"
                          className="table-info-pill"
                          onClick={() => openInfoModal(item.model_name)}
                        >
                          <Info size={12} />
                          <span>Details</span>
                        </button>
                      </td>
                      <td>
                        {idx === 0 ? (
                          <span className="winner-pill">
                            <CheckCircle size={13} /> Winner
                          </span>
                        ) : (
                          <span className="evaluated-pill">Evaluated</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Feature Importance */}
          {mlResult.feature_importance?.length > 0 && (
            <div className="ml-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">EXPLAINABILITY</p>
                  <h2>Feature Importance Ranking</h2>
                </div>
                <BarChart2 size={22} />
              </div>

              <div className="importance-bars-container">
                {mlResult.feature_importance.map((f, idx) => (
                  <div className="importance-row" key={idx}>
                    <div className="importance-header">
                      <span>{f.feature}</span>
                      <strong>{f.importance}%</strong>
                    </div>
                    <div className="viz-bar-track">
                      <div
                        className="viz-bar-fill"
                        style={{ width: `${Math.max(4, f.importance)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================
              LIVE PREDICTOR SANDBOX
              ======================================================== */}
          <div className="ml-card predictor-card">
            <div className="section-heading">
              <div>
                <div className="ml-eyebrow-row">
                  <p className="eyebrow">REAL-TIME INFERENCE SANDBOX</p>
                  <button
                    type="button"
                    className="info-icon-btn"
                    onClick={() =>
                      setActiveInfoModal({
                        title: "Real-Time Prediction Engine",
                        data: {
                          family: "Inference & Simulation",
                          description: `This sandbox passes your custom record parameters into the trained ${mlResult.best_model_name} pipeline. It automatically applies zero-leakage transforms and computes the predicted outcome in milliseconds.`,
                          strengths: "Test live business hypotheses, evaluate individual client profiles, and understand confidence scores.",
                        },
                      })
                    }
                  >
                    <Info size={13} />
                    <span>How it works</span>
                  </button>
                </div>
                <h2>Predict: {mlResult.target_column}</h2>
              </div>
              <Zap size={24} className="predictor-icon" />
            </div>

            <div className="predictor-instructions-box">
              <div className="instructions-text">
                <p>
                  Enter feature values below to test what outcome the champion model (
                  <strong>{mlResult.best_model_name}</strong>) predicts for{" "}
                  <strong>{mlResult.target_column}</strong>.
                </p>
              </div>
              <div className="predictor-toolbar">
                <button
                  type="button"
                  className="sample-fill-btn"
                  onClick={handleLoadExample}
                >
                  {fillFeedback ? <Check size={14} color="#16a34a" /> : <Sparkles size={14} />}
                  <span>{fillFeedback ? "Record Populated!" : "Fill Example Record"}</span>
                </button>
                <button
                  type="button"
                  className="reset-fill-btn"
                  onClick={handleResetInputs}
                >
                  <RotateCcw size={13} />
                  <span>Clear All</span>
                </button>
              </div>
            </div>

            {/* Smart Feature Inputs Grid */}
            <div className="prediction-form-grid">
              {currentFeatures.map((feat) => {
                const isCat = feat.type === "categorical" && feat.options?.length > 0;
                const currentVal =
                  predictInputs[feat.name] !== undefined && predictInputs[feat.name] !== null
                    ? predictInputs[feat.name]
                    : "";

                return (
                  <div className="predict-input-group" key={feat.name}>
                    <div className="predict-label-row">
                      <label className="eyebrow" title={feat.name}>{feat.name}</label>
                      <span className="feat-type-tag">{isCat ? "category" : "numeric"}</span>
                    </div>

                    {isCat ? (
                      <div className="predict-select-wrapper">
                        <select
                          className="predict-select-box"
                          value={String(currentVal)}
                          onChange={(e) =>
                            setPredictInputs((prev) => ({
                              ...prev,
                              [feat.name]: e.target.value,
                            }))
                          }
                        >
                          {feat.options.map((opt) => (
                            <option key={opt} value={String(opt)}>
                              {String(opt)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="predict-select-arrow" />
                      </div>
                    ) : (
                      <input
                        type="text"
                        placeholder={`e.g. ${feat.sample_value ?? feat.default_value ?? 0}`}
                        value={String(currentVal)}
                        onChange={(e) =>
                          setPredictInputs((prev) => ({
                            ...prev,
                            [feat.name]: e.target.value,
                          }))
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <button
              className="primary-button predict-submit-btn"
              disabled={predicting}
              onClick={handleRunPrediction}
            >
              <Zap size={16} />
              {predicting ? "Computing Prediction..." : `Generate Prediction for ${mlResult.target_column}`}
            </button>

            {/* Prediction Result */}
            {predictionResult && (
              <div className="prediction-output-box">
                <div className="pred-summary-card">
                  <div className="pred-target-eyebrow">
                    <span>TARGET PREDICTED:</span>
                    <strong>{predictionResult.target_column}</strong>
                  </div>

                  <div className="pred-hero-row">
                    <div className="pred-value-badge">
                      <span className="pred-badge-label">PREDICTED OUTCOME</span>
                      <div className="pred-badge-number">
                        {String(predictionResult.prediction)}
                      </div>
                    </div>

                    {predictionResult.confidence_pct !== undefined &&
                      predictionResult.confidence_pct !== null && (
                        <div className="pred-confidence-pill">
                          <CheckCircle size={15} />
                          <span>{predictionResult.confidence_pct}% Confidence</span>
                        </div>
                      )}
                  </div>

                  {predictionResult.explanation && (
                    <div className="pred-explanation-banner">
                      <p>{predictionResult.explanation}</p>
                    </div>
                  )}
                </div>

                {/* Probability Distribution */}
                {predictionResult.probabilities && (
                  <div className="class-probs-container">
                    <span className="eyebrow">CLASS PROBABILITY DISTRIBUTION</span>
                    <div className="probs-grid">
                      {Object.entries(predictionResult.probabilities).map(
                        ([cls, prob]) => (
                          <div
                            className={`prob-item ${
                              String(cls) === String(predictionResult.prediction)
                                ? "winner-prob"
                                : ""
                            }`}
                            key={cls}
                          >
                            <div className="prob-label">
                              <span>
                                {predictionResult.target_column} = <strong>{cls}</strong>
                              </span>
                              <strong>{(prob * 100).toFixed(1)}%</strong>
                            </div>
                            <div className="viz-bar-track">
                              <div
                                className={`viz-bar-fill ${
                                  String(cls) === String(predictionResult.prediction)
                                    ? "highlight"
                                    : ""
                                }`}
                                style={{ width: `${Math.max(4, prob * 100)}%` }}
                              />
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

export default MlStudio;
