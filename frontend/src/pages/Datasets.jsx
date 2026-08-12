import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  FileSpreadsheet,
  Upload,
  Sparkles,
  Database,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

import { getDatasets, uploadDataset } from "../services/api";

function Datasets() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadDatasets = async () => {
    try {
      setError("");
      const response = await getDatasets();
      setDatasets(response.data || []);
    } catch (err) {
      console.error("Failed to load datasets:", err);
      setError("Unable to load datasets.");
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
    <main className="dashboard">
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
          <p className="eyebrow">ERROR</p>
          <p>{error}</p>
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

          <span className="mono">
            {datasets.length.toString().padStart(2, "0")} DATASETS
          </span>
        </div>

        {loading && (
          <div className="dataset-card">
            <div className="dataset-info">
              <p>Loading your private datasets...</p>
            </div>
          </div>
        )}

        {!loading && datasets.length === 0 && (
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

        {!loading &&
          datasets.map((dataset) => (
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