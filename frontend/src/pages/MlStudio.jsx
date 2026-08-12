import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Brain,
  Database,
  Trophy,
  Play,
  Activity,
  Layers,
  BarChart2,
  CheckCircle,
  Zap,
  HelpCircle,
  Info,
  ArrowRight,
  TrendingUp,
  RotateCcw,
  Sparkles,
  Check,
  AlertTriangle,
  X,
} from "lucide-react";

import {
  getDatasets,
  getDatasetMlTargets,
  trainAutoMl,
  predictAutoMl,
} from "../services/api";

const MODEL_DESCRIPTIONS = {
  "AutoML Pipeline": {
    family: "Automated Machine Learning",
    description:
      "AutoML automates data cleaning, categorical one-hot encoding, feature standardization, algorithm benchmarking, and model serialization with zero manual coding.",
    strengths: "Fast end-to-end prototyping, unbiased model selection, and instant real-time inference.",
  },
  "Random Forest Classifier": {
    family: "Ensemble Bagging",
    description:
      "Builds an ensemble of 100 independent decision trees using random feature subsets. Predictions are determined by majority voting across all trees.",
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
      "Constructs 100 parallel regression trees and averages their continuous predictions to forecast quantitative outcomes.",
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

function MlStudio() {
  const { datasetId: routeDatasetId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState(
    routeDatasetId || searchParams.get("datasetId") || ""
  );

  const [targets, setTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [targetInfo, setTargetInfo] = useState(null);

  const [training, setTraining] = useState(false);
  const [mlResult, setMlResult] = useState(null);
  const [error, setError] = useState("");

  // Live Predictor State
  const [predictInputs, setPredictInputs] = useState({});
  const [predicting, setPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState(null);

  // Info Modal / Tooltip State
  const [activeInfoModal, setActiveInfoModal] = useState(null); // { title: string, data: object }

  // 1. Load user datasets
  useEffect(() => {
    const loadDatasets = async () => {
      try {
        const res = await getDatasets();
        const list = res.data || [];
        setDatasets(list);
        if (!selectedDatasetId && list.length > 0) {
          const defaultId = String(list[0].id);
          setSelectedDatasetId(defaultId);
          navigate(`/ml/${defaultId}`, { replace: true });
        }
      } catch (err) {
        console.error("Failed to load datasets:", err);
      }
    };
    loadDatasets();
  }, []);

  // 2. Synchronize route datasetId parameter
  useEffect(() => {
    if (routeDatasetId && String(routeDatasetId) !== String(selectedDatasetId)) {
      setSelectedDatasetId(String(routeDatasetId));
      setMlResult(null);
      setPredictionResult(null);
      setError("");
    }
  }, [routeDatasetId]);

  // 3. Load target column candidates
  useEffect(() => {
    if (!selectedDatasetId) return;

    const loadTargets = async () => {
      try {
        setError("");
        setMlResult(null);
        setPredictionResult(null);
        const res = await getDatasetMlTargets(selectedDatasetId);
        const candidates = res.target_candidates || [];
        setTargets(candidates);
        if (candidates.length > 0) {
          setSelectedTarget(candidates[0].name);
          setTargetInfo(candidates[0]);
        }
      } catch (err) {
        console.error("Failed to load targets:", err);
        setError(err.response?.data?.detail || "Unable to read dataset target columns.");
      }
    };
    loadTargets();
  }, [selectedDatasetId]);

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
    setMlResult(null);
    setPredictionResult(null);
  };

  const handleTrainAutoMl = async () => {
    if (!selectedDatasetId || !selectedTarget) return;

    try {
      setTraining(true);
      setError("");
      setMlResult(null);
      setPredictionResult(null);

      const res = await trainAutoMl(selectedDatasetId, {
        target_column: selectedTarget,
      });
      setMlResult(res);

      // Pre-populate predictor inputs with realistic sample values from dataset
      if (res.sample_record && Object.keys(res.sample_record).length > 0) {
        setPredictInputs(res.sample_record);
      } else if (res.raw_features && res.raw_features.length > 0) {
        const initial = {};
        res.raw_features.forEach((rf) => {
          initial[rf.name] = rf.default_value ?? rf.sample_value ?? "";
        });
        setPredictInputs(initial);
      } else {
        const initial = {};
        (res.feature_names || []).forEach((f) => {
          initial[f] = "";
        });
        setPredictInputs(initial);
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
    if (mlResult?.sample_record) {
      setPredictInputs({ ...mlResult.sample_record });
    }
  };

  const handleResetInputs = () => {
    if (mlResult?.raw_features) {
      const resetMap = {};
      mlResult.raw_features.forEach((rf) => {
        resetMap[rf.name] = rf.default_value ?? "";
      });
      setPredictInputs(resetMap);
      setPredictionResult(null);
    }
  };

  const openInfoModal = (modelName) => {
    const details = MODEL_DESCRIPTIONS[modelName] || {
      family: "Machine Learning Algorithm",
      description: `Mathematical model optimized for ${mlResult?.problem_type || "predictive"} tasks.`,
      strengths: "Evaluated on held-out test data for optimal accuracy and low error.",
    };
    setActiveInfoModal({ title: modelName, data: details });
  };

  return (
    <main className="dashboard ml-studio-page">
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
            Automated feature engineering, model benchmarking, validation metrics,
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
            <label className="eyebrow">PREDICTIVE TARGET (Y)</label>
            <select
              className="target-dropdown"
              value={selectedTarget}
              onChange={(e) => handleTargetChange(e.target.value)}
            >
              {targets.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.suggested_task.toUpperCase()})
                </option>
              ))}
            </select>

            {targetInfo && (
              <div className="target-meta-box">
                <div>
                  <span className="eyebrow">TASK TYPE</span>
                  <strong className={`task-badge ${targetInfo.suggested_task}`}>
                    {targetInfo.suggested_task.toUpperCase()}
                  </strong>
                </div>
                <div>
                  <span className="eyebrow">UNIQUE CLASSES/VALUES</span>
                  <strong>{targetInfo.unique_count}</strong>
                </div>
                <div>
                  <span className="eyebrow">DATA TYPE</span>
                  <code>{targetInfo.data_type}</code>
                </div>
              </div>
            )}
          </div>

          <div className="automl-action-card">
            <div>
              <h3>Train & Benchmark Models</h3>
              <p>
                AutoML automatically cleans data, balances splits, trains 4 candidate
                algorithms, and picks the highest scoring champion model.
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
                Selected as the top performing model for predicting <strong>{mlResult.target_column}</strong> with a score of{" "}
                <span className="score-highlight">
                  {mlResult.problem_type === "classification"
                    ? `F1: ${(mlResult.best_model_score * 100).toFixed(1)}%`
                    : `R²: ${mlResult.best_model_score.toFixed(3)}`}
                </span>
              </p>
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

            <div className="table-scroll-wrapper">
              <table className="sql-table ml-leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Model Name</th>
                    {mlResult.problem_type === "classification" ? (
                      <>
                        <th>F1 Score</th>
                        <th>Accuracy</th>
                        <th>Precision</th>
                        <th>Recall</th>
                      </>
                    ) : (
                      <>
                        <th>R² Score</th>
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
              LIVE PREDICTOR SANDBOX (IMPROVED & USER-FRIENDLY)
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
                          family: "Inference & What-If Simulation",
                          description: `This sandbox passes your custom record parameters into the trained ${mlResult.best_model_name} pipeline. It automatically scales numbers, one-hot encodes categorical values, and computes the forecasted outcome in milliseconds.`,
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
                  <strong>{mlResult.best_model_name}</strong>) predicts for <strong>{mlResult.target_column}</strong>.
                </p>
              </div>
              <div className="predictor-toolbar">
                <button
                  type="button"
                  className="sample-fill-btn"
                  onClick={handleLoadExample}
                >
                  <Sparkles size={14} />
                  <span>Fill Example Record</span>
                </button>
                <button
                  type="button"
                  className="reset-fill-btn"
                  onClick={handleResetInputs}
                >
                  <RotateCcw size={13} />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Smart Feature Inputs Grid */}
            <div className="prediction-form-grid">
              {(mlResult.raw_features && mlResult.raw_features.length > 0
                ? mlResult.raw_features
                : (mlResult.feature_names || []).map((f) => ({
                    name: f,
                    type: "numeric",
                    default_value: "",
                  }))
              ).map((feat) => {
                const isCat = feat.type === "categorical" && feat.options?.length > 0;
                const currentVal = predictInputs[feat.name] ?? feat.default_value ?? "";

                return (
                  <div className="predict-input-group" key={feat.name}>
                    <div className="predict-label-row">
                      <label className="eyebrow">{feat.name}</label>
                      <span className="feat-type-tag">{isCat ? "category" : "numeric"}</span>
                    </div>

                    {isCat ? (
                      <select
                        className="predict-select-box"
                        value={currentVal}
                        onChange={(e) =>
                          setPredictInputs((prev) => ({
                            ...prev,
                            [feat.name]: e.target.value,
                          }))
                        }
                      >
                        {feat.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        step="any"
                        placeholder={`e.g. ${feat.sample_value ?? feat.default_value ?? 0}`}
                        value={currentVal}
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

            {/* ========================================================
                PREDICTION RESULT (CLEAR, DETAILED & GROUNDED)
                ======================================================== */}
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

                  {/* Human-Readable Explanation */}
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
