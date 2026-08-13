import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Database,
  FileSpreadsheet,
  Plus,
  Sparkles,
} from "lucide-react";

import { getCachedDatasets, getDatasets, uploadDataset } from "../services/api";
import SEOHead from "../components/SEOHead";

function Dashboard() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [datasets, setDatasets] = useState(() => getCachedDatasets());
  const [loading, setLoading] = useState(() => getCachedDatasets().length === 0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const loadDatasets = async () => {
    try {
      const response = await getDatasets();
      setDatasets(response.data || []);
    } catch (error) {
      console.error("Failed to load datasets:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setUploadError("Please select a valid CSV (.csv) file.");
      return;
    }

    try {
      setUploading(true);
      setUploadError("");

      const res = await uploadDataset(file);
      const newDataset = res.dataset || res;

      await loadDatasets();

      if (newDataset?.id) {
        navigate(`/analysis/${newDataset.id}`);
      }
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(
        err.response?.data?.detail || "Failed to upload CSV dataset."
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const totalRows = datasets.reduce(
    (total, dataset) => total + (dataset.row_count || 0),
    0
  );

  const latestDataset = datasets.length > 0 ? datasets[0] : null;

  return (
    <main className="dashboard">
      <SEOHead
        title="Workspace Dashboard"
        description="CypherCorp unified data intelligence workspace. View active datasets, quick EDA statistics, and AutoML benchmark summaries."
        canonicalUrl="https://cyphercorp.com/dashboard"
      />
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".csv"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* =========================
          WELCOME
      ========================== */}
      <section className="welcome">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h1>
            Your data,
            <br />
            understood.
          </h1>
          <p className="intro">
            Analyze datasets, discover patterns, query relational data with SQL,
            and benchmark machine learning models with CypherCorp.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={handleUploadClick}
          disabled={uploading}
        >
          <Plus size={17} />
          {uploading ? "Uploading CSV..." : "Upload dataset"}
        </button>
      </section>

      {uploadError && (
        <section className="sql-error-card" style={{ marginTop: "20px" }}>
          <p className="eyebrow">UPLOAD ERROR</p>
          <p>{uploadError}</p>
        </section>
      )}

      {/* =========================
          METRICS
      ========================== */}
      <section className="metrics">
        {/* DATASETS */}
        <div
          className="metric"
          style={{ cursor: "pointer" }}
          onClick={() => navigate("/datasets")}
        >
          <span className="metric-label">DATASETS</span>
          <strong className="metric-value mono">
            {String(datasets.length).padStart(2, "0")}
          </strong>
          <span className="metric-note">
            <ArrowUpRight size={13} />
            Active in workspace
          </span>
        </div>

        {/* ROWS */}
        <div className="metric">
          <span className="metric-label">ROWS ANALYZED</span>
          <strong className="metric-value mono">
            {String(totalRows).padStart(2, "0")}
          </strong>
          <span className="metric-note">Across your datasets</span>
        </div>

        {/* AI CAPABILITIES */}
        <div
          className="metric"
          style={{ cursor: "pointer" }}
          onClick={() => {
            if (latestDataset) {
              navigate(`/analysis/${latestDataset.id}`);
            } else {
              navigate("/datasets");
            }
          }}
        >
          <span className="metric-label">AI ENGINE</span>
          <strong className="metric-value mono">
            {String(datasets.length > 0 ? "LIVE" : "READY")}
          </strong>
          <span className="metric-note">
            <Sparkles size={13} />
            EDA · SQL · AutoML
          </span>
        </div>
      </section>

      {/* =========================
          RECENT DATASETS
      ========================== */}
      <section className="datasets-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR DATA</p>
            <h2>Recent datasets</h2>
          </div>

          <button
            className="text-button"
            onClick={() => navigate("/datasets")}
          >
            View all
            <ArrowUpRight size={15} />
          </button>
        </div>

        {/* LOADING */}
        {loading && (
          <div className="dataset-card">
            <div className="dataset-info">
              <p>Loading datasets...</p>
            </div>
          </div>
        )}

        {/* NO DATASETS */}
        {!loading && datasets.length === 0 && (
          <div
            className="dataset-card"
            style={{ cursor: "pointer", borderStyle: "dashed" }}
            onClick={handleUploadClick}
          >
            <div className="dataset-icon">
              <Database size={21} />
            </div>

            <div className="dataset-info">
              <h3>No datasets yet</h3>
              <p>Click here to upload your first CSV and begin automated intelligence analysis.</p>
            </div>
          </div>
        )}

        {/* DATASETS LIST */}
        {!loading &&
          datasets.length > 0 &&
          datasets.slice(0, 5).map((dataset) => (
            <div className="dataset-card" key={dataset.id}>
              <div className="dataset-icon">
                <FileSpreadsheet size={21} />
              </div>

              <div className="dataset-info">
                <h3>{dataset.name}</h3>
                <p className="mono">
                  {dataset.row_count} rows · {dataset.column_count} columns
                </p>
              </div>

              <div className="dataset-health">
                <span className="health-indicator" />
                <span>Analyzed</span>
              </div>

              <button
                className="open-button"
                onClick={() => navigate(`/analysis/${dataset.id}`)}
              >
                Open
                <ArrowUpRight size={15} />
              </button>
            </div>
          ))}
      </section>

      {/* =========================
          LATEST AI ANALYSIS
      ========================== */}
      <section className="insight-preview">
        <div className="insight-mark">
          <Database size={20} />
        </div>

        <div>
          <p className="eyebrow">LATEST ANALYSIS</p>
          <h2>
            {latestDataset
              ? `Dataset '${latestDataset.name}' is ready for exploration.`
              : "Upload a dataset to begin automated intelligence."}
          </h2>
          <p>
            {latestDataset
              ? `CypherCorp has identified data-quality signals, distributions, correlations and automated insights for '${latestDataset.name}'.`
              : "Upload a CSV file to inspect statistical distributions, run natural language SQL queries, and train AutoML models."}
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={() => {
            if (latestDataset) {
              navigate(`/analysis/${latestDataset.id}`);
            } else {
              handleUploadClick();
            }
          }}
        >
          {latestDataset ? "View analysis" : "Upload CSV"}
          <ArrowUpRight size={15} />
        </button>
      </section>
    </main>
  );
}

export default Dashboard;