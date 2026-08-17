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
  "HistGradient Boosting": {
    family: "Histogram-Based Gradient Boosting",
    description:
      "Modern binning-based gradient boosting algorithm (LightGBM-style). Bins continuous values into integer histograms for extreme speed and accurate non-linear partitioning.",
    strengths: "State-of-the-art accuracy on complex tabular datasets, robust to mixed features, and resistant to overfitting.",
  },
  "HistGradient Boosting Regressor": {
    family: "Histogram-Based Gradient Boosting",
    description:
      "Modern LightGBM-style histogram boosting algorithm that builds deep non-linear regression ensembles with native L2 regularization.",
    strengths: "Exceptional precision on continuous financial and quantitative targets, fast computation, and smooth interaction modeling.",
  },
  "Extra Trees Classifier": {
    family: "Extremely Randomized Trees",
    description:
      "Fits randomized decision trees on various sub-samples of the dataset with randomized cut-points to achieve lower variance and higher generalization.",
    strengths: "Reduces overfitting, faster training than standard Random Forest, and captures intricate feature interactions.",
  },
  "Extra Trees Regressor": {
    family: "Extremely Randomized Trees",
    description:
      "Constructs deeply randomized regression trees with randomized decision boundaries for superior variance reduction and smooth continuous interpolation.",
    strengths: "Excellent interpolation accuracy, low prediction variance, and high resistance to noisy measurements.",
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
        canonicalUrl="https://www.cyphercorp.in/ml"
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

          {/* ========================================================
              MODEL EXPLAINABILITY & DIAGNOSTICS
              ======================================================== */}
          {mlResult.model_diagnostics && (
            <div className="ml-card explainability-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">MODEL EXPLAINABILITY & DIAGNOSTICS</p>
                  <h2>Executive Model Decision Logic</h2>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: "4px",
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "#10b981",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                    }}
                  >
                    Grade: {mlResult.model_diagnostics.grade}
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: "4px",
                      background: "rgba(59, 130, 246, 0.15)",
                      color: "#3b82f6",
                      border: "1px solid rgba(59, 130, 246, 0.3)",
                    }}
                  >
                    {mlResult.model_diagnostics.readiness}
                  </span>
                </div>
              </div>

              {/* Executive Summary Narrative */}
              <div
                style={{
                  padding: "14px 18px",
                  borderRadius: "6px",
                  background: "var(--surface-alt)",
                  border: "1px solid var(--border)",
                  marginBottom: "18px",
                  lineHeight: "1.6",
                }}
              >
                <p style={{ margin: 0, fontSize: "14px", color: "var(--text)" }}>
                  {mlResult.model_diagnostics.executive_narrative}
                </p>
              </div>

              {/* Class-level breakdown or Regression error distribution */}
              {mlResult.problem_type === "classification" &&
                mlResult.model_diagnostics.class_metrics?.length > 0 && (
                  <div style={{ marginBottom: "20px" }}>
                    <p className="eyebrow" style={{ marginBottom: "8px" }}>
                      CLASS-BY-CLASS RECOVERY & PRECISION MATRIX
                    </p>
                    <div className="table-scroll-wrapper">
                      <table className="sql-table" style={{ fontSize: "13px" }}>
                        <thead>
                          <tr>
                            <th>Outcome Class</th>
                            <th>Precision (%)</th>
                            <th>Recall / Sensitivity (%)</th>
                            <th>Test Samples</th>
                            <th>Accuracy Indicator</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mlResult.model_diagnostics.class_metrics.map((cm) => (
                            <tr key={cm.class_name}>
                              <td>
                                <strong>{cm.class_name}</strong>
                              </td>
                              <td className="mono">{cm.precision_pct}%</td>
                              <td className="mono">{cm.recall_pct}%</td>
                              <td className="mono">{cm.support}</td>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <div className="viz-bar-track" style={{ width: "120px", height: "6px" }}>
                                    <div
                                      className="viz-bar-fill highlight"
                                      style={{ width: `${Math.max(6, cm.recall_pct)}%` }}
                                    />
                                  </div>
                                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                                    {cm.recall_pct >= 80 ? "High" : cm.recall_pct >= 50 ? "Moderate" : "Low"}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {mlResult.problem_type === "regression" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "14px",
                    marginBottom: "20px",
                  }}
                >
                  <div
                    style={{
                      padding: "12px 16px",
                      borderRadius: "6px",
                      background: "var(--surface-alt)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <span className="eyebrow">MEAN ABSOLUTE % ERROR (MAPE)</span>
                    <strong style={{ fontSize: "18px", display: "block", marginTop: "4px" }}>
                      {mlResult.model_diagnostics.mape_pct !== null
                        ? `${mlResult.model_diagnostics.mape_pct}%`
                        : "N/A"}
                    </strong>
                  </div>

                  <div
                    style={{
                      padding: "12px 16px",
                      borderRadius: "6px",
                      background: "var(--surface-alt)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <span className="eyebrow">ERROR RESIDUAL DISTRIBUTION</span>
                    <div style={{ marginTop: "4px", fontSize: "13px" }}>
                      <span>Over: {mlResult.model_diagnostics.over_prediction_pct}%</span>
                      <span style={{ margin: "0 6px" }}>•</span>
                      <span>Under: {mlResult.model_diagnostics.under_prediction_pct}%</span>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "12px 16px",
                      borderRadius: "6px",
                      background: "var(--surface-alt)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <span className="eyebrow">MAX RESIDUAL ERROR</span>
                    <strong style={{ fontSize: "18px", display: "block", marginTop: "4px" }}>
                      {mlResult.model_diagnostics.max_residual_error}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              FEATURE ATTRIBUTION & DIRECTIONALITY
              ======================================================== */}
          {(() => {
            const rankedFeatures = (mlResult.feature_attribution || mlResult.feature_importance || []).filter(
              (f) => Number(f.importance || 0) > 0
            );

            if (rankedFeatures.length === 0) return null;

            return (
              <div className="ml-card">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">FEATURE ATTRIBUTION & IMPACT POLARITY</p>
                    <h2>Directional Feature Influence</h2>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 500 }}>
                      {rankedFeatures.length} features ranked
                    </span>
                    <BarChart2 size={20} />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    maxHeight: "380px",
                    overflowY: "auto",
                    paddingRight: "8px",
                  }}
                  className="table-scroll-wrapper"
                >
                  {rankedFeatures.map((f, idx) => {
                    const isPositive = f.direction === "positive";
                    const isNegative = f.direction === "negative";
                    const badgeBg = isPositive
                      ? "rgba(16, 185, 129, 0.12)"
                      : isNegative
                        ? "rgba(245, 158, 11, 0.12)"
                        : "rgba(59, 130, 246, 0.12)";
                    const badgeColor = isPositive ? "#10b981" : isNegative ? "#f59e0b" : "#3b82f6";
                    const badgeBorder = isPositive
                      ? "rgba(16, 185, 129, 0.3)"
                      : isNegative
                        ? "rgba(245, 158, 11, 0.3)"
                        : "rgba(59, 130, 246, 0.3)";

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: "14px 16px",
                          background: "var(--surface-alt)",
                          border: "1px solid var(--border)",
                          borderRadius: "6px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "8px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)" }}>
                              {f.feature}
                            </span>
                            {f.direction_label && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  padding: "2px 8px",
                                  borderRadius: "4px",
                                  background: badgeBg,
                                  color: badgeColor,
                                  border: `1px solid ${badgeBorder}`,
                                }}
                              >
                                {f.direction_label}
                              </span>
                            )}
                            {f.correlation !== undefined && f.correlation !== null && (
                              <span className="mono" style={{ fontSize: "11px", color: "var(--muted)" }}>
                                (r = {f.correlation > 0 ? `+${f.correlation}` : f.correlation})
                              </span>
                            )}
                          </div>
                          <strong className="mono" style={{ fontSize: "14px" }}>
                            {f.importance}% Importance
                          </strong>
                        </div>

                        <div className="viz-bar-track" style={{ marginBottom: "8px" }}>
                          <div
                            className="viz-bar-fill"
                            style={{
                              width: `${Math.max(4, f.importance)}%`,
                              background: isPositive ? "#10b981" : isNegative ? "#f59e0b" : "var(--text)",
                            }}
                          />
                        </div>

                        {f.narrative && (
                          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", lineHeight: "1.5" }}>
                            {f.narrative}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

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

                {/* Local Feature Attribution / Prediction Drivers */}
                {predictionResult.feature_attributions?.length > 0 && (
                  <div
                    style={{
                      marginTop: "16px",
                      padding: "16px",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "12px",
                      }}
                    >
                      <span className="eyebrow" style={{ margin: 0 }}>
                        LOCAL PREDICTION DRIVERS (WHY THIS OUTCOME WAS GENERATED)
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                        Per-record feature attribution breakdown
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                        gap: "10px",
                      }}
                    >
                      {predictionResult.feature_attributions.map((attr, i) => {
                        const isPos = attr.direction === "positive";
                        return (
                          <div
                            key={i}
                            style={{
                              padding: "10px 12px",
                              background: "var(--surface-alt)",
                              border: "1px solid var(--border)",
                              borderRadius: "4px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "4px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  color: "var(--text)",
                                  maxWidth: "130px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                                title={attr.feature}
                              >
                                {attr.base_feature || attr.feature}
                              </span>
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  padding: "2px 6px",
                                  borderRadius: "3px",
                                  background: isPos
                                    ? "rgba(16, 185, 129, 0.15)"
                                    : "rgba(245, 158, 11, 0.15)",
                                  color: isPos ? "#10b981" : "#f59e0b",
                                  border: isPos
                                    ? "1px solid rgba(16, 185, 129, 0.3)"
                                    : "1px solid rgba(245, 158, 11, 0.3)",
                                }}
                              >
                                {attr.impact_label}
                              </span>
                            </div>
                            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                              Input value: <strong style={{ color: "var(--text)" }}>{attr.input_value}</strong>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Probability Distribution */}
                {predictionResult.probabilities && (
                  <div className="class-probs-container">
                    <span className="eyebrow">CLASS PROBABILITY DISTRIBUTION</span>
                    <div className="probs-grid">
                      {Object.entries(predictionResult.probabilities).map(
                        ([cls, prob]) => (
                          <div
                            className={`prob-item ${String(cls) === String(predictionResult.prediction)
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
                                className={`viz-bar-fill ${String(cls) === String(predictionResult.prediction)
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
