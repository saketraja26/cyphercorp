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
  ArrowRight,
  TrendingUp,
} from "lucide-react";

import {
  getDatasets,
  getDatasetMlTargets,
  trainAutoMl,
  predictAutoMl,
} from "../services/api";

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

      // Initialize predictor inputs with default zeroes/empty
      const initialInputs = {};
      (res.feature_names || []).forEach((f) => {
        initialInputs[f] = "";
      });
      setPredictInputs(initialInputs);
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

  return (
    <main className="dashboard ml-studio-page">
      {/* =========================
          HEADER
      ========================= */}
      <section className="ml-header">
        <div>
          <p className="eyebrow">AUTOMATED MACHINE LEARNING</p>
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
            <div className="action-info">
              <span className="eyebrow">AUTO-BENCHMARK CANDIDATES</span>
              <h3>Train & Compare Models</h3>
              <p>
                CypherCorp AutoML trains 4 candidate algorithms, computes cross-validation
                metrics, determines the champion model, and generates feature importance.
              </p>
            </div>

            <button
              className="primary-button train-action-btn"
              disabled={training || !selectedTarget}
              onClick={handleTrainAutoMl}
            >
              <Play size={17} />
              {training ? "Training Candidate Models..." : "Launch AutoML Pipeline"}
            </button>
          </div>
        </div>
      </section>

      {/* =========================
          ERROR CARD
      ========================= */}
      {error && (
        <section className="sql-error-card">
          <p className="eyebrow">TRAINING ERROR</p>
          <p>{error}</p>
        </section>
      )}

      {/* =========================
          AUTOML RESULTS DASHBOARD
      ========================= */}
      {mlResult && (
        <section className="ml-results-section">
          {/* Champion Banner */}
          <div className="champion-banner">
            <div className="champion-badge">
              <Trophy size={24} />
            </div>
            <div>
              <span className="eyebrow">CHAMPION MODEL</span>
              <h2>{mlResult.best_model_name}</h2>
              <p>
                Selected as best performer for <strong>{mlResult.problem_type.toUpperCase()}</strong> on{" "}
                <strong>'{mlResult.target_column}'</strong> with benchmark score:{" "}
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

          {/* Live Predictor Sandbox */}
          <div className="ml-card predictor-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">INFERENCE SANDBOX</p>
                <h2>Live Real-Time Predictor</h2>
              </div>
              <Zap size={22} />
            </div>

            <p className="intro" style={{ margin: "0 0 20px" }}>
              Enter feature values below to generate real-time predictions using the champion model (
              <strong>{mlResult.best_model_name}</strong>).
            </p>

            <div className="prediction-form-grid">
              {(mlResult.feature_names || []).slice(0, 12).map((feat) => (
                <div className="predict-input-group" key={feat}>
                  <label className="eyebrow">{feat}</label>
                  <input
                    type="text"
                    placeholder="Value..."
                    value={predictInputs[feat] ?? ""}
                    onChange={(e) =>
                      setPredictInputs((prev) => ({
                        ...prev,
                        [feat]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>

            <button
              className="primary-button predict-submit-btn"
              disabled={predicting}
              onClick={handleRunPrediction}
            >
              <Zap size={16} />
              {predicting ? "Computing Prediction..." : "Run Prediction"}
            </button>

            {/* Prediction Output */}
            {predictionResult && (
              <div className="prediction-output-box">
                <div className="pred-header">
                  <span className="eyebrow">PREDICTED OUTCOME</span>
                  <div className="pred-value">
                    {String(predictionResult.prediction)}
                  </div>
                </div>

                {predictionResult.probabilities && (
                  <div className="class-probs-container">
                    <span className="eyebrow">CLASS PROBABILITIES</span>
                    <div className="probs-grid">
                      {Object.entries(predictionResult.probabilities).map(
                        ([cls, prob]) => (
                          <div className="prob-item" key={cls}>
                            <div className="prob-label">
                              <span>{cls}</span>
                              <strong>{(prob * 100).toFixed(1)}%</strong>
                            </div>
                            <div className="viz-bar-track">
                              <div
                                className="viz-bar-fill"
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
