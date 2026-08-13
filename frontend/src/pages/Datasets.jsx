import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  FileSpreadsheet,
  Upload,
  CheckCircle,
  RefreshCw,
  Zap,
} from "lucide-react";

import { getCachedDatasets, getDatasets, uploadDataset } from "../services/api";
import SEOHead from "../components/SEOHead";

function Datasets() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [datasets, setDatasets] = useState(() => getCachedDatasets());
  const [loading, setLoading] = useState(() => getCachedDatasets().length === 0);
  const [isSyncing, setIsSyncing] = useState(() => getCachedDatasets().length > 0);
  const [isColdStarting, setIsColdStarting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadDatasets = async (force = false) => {
    let coldTimer = null;
    try {
      setError("");
      // If no cached datasets or forcing refresh, show cold-start alert after 2.5 seconds
      coldTimer = setTimeout(() => {
        setIsColdStarting(true);
      }, 2500);

      const response = await getDatasets(force);
      setDatasets(response.data || []);
    } catch (err) {
      console.error("Failed to load datasets:", err);
      if (datasets.length === 0) {
        setError("Unable to connect to the cloud server. The instance may still be waking up. Please click retry.");
      }
    } finally {
      if (coldTimer) clearTimeout(coldTimer);
      setLoading(false);
      setIsSyncing(false);
      setIsColdStarting(false);
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
      setError("Please select a valid CSV (.csv) file.");
      return;
    }

    try {
      setUploading(true);
      setError("");
      setSuccessMsg("");

      const res = await uploadDataset(file);
      const newDataset = res.dataset || res;
      setSuccessMsg(`Dataset '${file.name}' uploaded successfully!`);

      // Reload dataset list
      await loadDatasets();

      // Navigate to analysis
      if (newDataset?.id) {
        setTimeout(() => {
          navigate(`/analysis/${newDataset.id}`);
        }, 600);
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(
        err.response?.data?.detail || "Failed to upload CSV dataset. Please check file format."
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <main className="dashboard datasets-page">
      <SEOHead
        title="Dataset Management & CSV Ingestion"
        description="Upload, manage, and inspect isolated CSV datasets for statistical analysis and machine learning training."
        canonicalUrl="https://cyphercorp.com/datasets"
      />
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".csv"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <section className="welcome">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>
            Your
            <br />
            datasets.
          </h1>
          <p className="intro">
            Manage your private datasets and explore automated statistical profiles,
            SQL analytics, and machine learning models with CypherCorp.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={handleUploadClick}
          disabled={uploading}
        >
          <Upload size={17} />
          {uploading ? "Uploading CSV..." : "Upload dataset"}
        </button>
      </section>

      {/* Notices */}
      {error && (
        <section className="sql-error-card" style={{ marginTop: "24px" }}>
          <p className="eyebrow">CONNECTION ERROR</p>
          <p>{error}</p>
          <div style={{ marginTop: "12px" }}>
            <button
              className="secondary-button"
              onClick={() => {
                setLoading(true);
                loadDatasets(true);
              }}
              style={{ fontSize: "12px", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <RefreshCw size={13} />
              Retry Connection
            </button>
          </div>
        </section>
      )}

      {isColdStarting && loading && (
        <section
          className="auth-notice"
          style={{
            marginTop: "24px",
            padding: "16px 20px",
            borderLeft: "3px solid #6366f1",
            background: "rgba(99, 102, 241, 0.08)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <Zap size={20} style={{ color: "#6366f1", flexShrink: 0, animation: "pulse 2s infinite" }} />
          <div>
            <strong style={{ display: "block", fontSize: "13px", color: "var(--text)" }}>
              Waking up cloud server instance...
            </strong>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              Free-tier cloud backends (e.g. Render/Railway) enter idle sleep after inactivity and take ~30–40s on first load. Please stay on this page.
            </span>
          </div>
        </section>
      )}

      {successMsg && (
        <section
          className="auth-notice success"
          style={{ marginTop: "24px", padding: "16px 20px" }}
        >
          <CheckCircle size={18} style={{ marginRight: "10px" }} />
          <span>{successMsg}</span>
        </section>
      )}

      <section className="datasets-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">DATA LIBRARY</p>
            <h2>All datasets</h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {isSyncing && (
              <span className="mono" style={{ fontSize: "11px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "5px" }}>
                <RefreshCw size={12} className="spin-icon" style={{ animation: "spin 1.5s linear infinite" }} />
                Syncing...
              </span>
            )}
            <span className="mono">
              {datasets.length.toString().padStart(2, "0")} DATASETS
            </span>
          </div>
        </div>

        {loading && datasets.length === 0 && (
          <div className="dataset-card">
            <div className="dataset-info">
              <p>
                {isColdStarting
                  ? "Server is spinning up, fetching your datasets..."
                  : "Loading your private datasets..."}
              </p>
            </div>
          </div>
        )}

        {!loading && datasets.length === 0 && !error && (
          <div
            className="dataset-card"
            style={{ cursor: "pointer", borderStyle: "dashed" }}
            onClick={handleUploadClick}
          >
            <div className="dataset-icon">
              <Upload size={21} />
            </div>
            <div className="dataset-info">
              <h3>Upload your first dataset</h3>
              <p>Click here to select and upload a CSV file to begin automated intelligence analysis.</p>
            </div>
          </div>
        )}

        {datasets.map((dataset) => (
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
    </main>
  );
}

export default Datasets;