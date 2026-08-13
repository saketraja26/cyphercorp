import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Terminal,
  Send,
  Sparkles,
  Database,
  Copy,
  Check,
  Clock,
  Rows3,
  ShieldCheck,
  Code2,
  Table as TableIcon,
  HelpCircle,
} from "lucide-react";

import { getCachedDatasets, getDatasets, getDatasetSqlSchema, executeSqlQuery } from "../services/api";

function SqlAnalyst() {
  const { datasetId: routeDatasetId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [datasets, setDatasets] = useState(() => getCachedDatasets());
  const [selectedDatasetId, setSelectedDatasetId] = useState(
    routeDatasetId || searchParams.get("datasetId") || ""
  );

  const [schemaInfo, setSchemaInfo] = useState(null);
  const [mode, setMode] = useState("nl"); // "nl" or "raw_sql"
  const [queryInput, setQueryInput] = useState("");
  const [sqlInput, setSqlInput] = useState("");

  const [executing, setExecuting] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const [history, setHistory] = useState([]);

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
          navigate(`/sql/${defaultId}`, { replace: true });
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
      setQueryResult(null);
      setError("");
    }
  }, [routeDatasetId]);

  // 3. Load schema when dataset changes
  useEffect(() => {
    if (!selectedDatasetId) return;

    const loadSchema = async () => {
      try {
        setError("");
        const res = await getDatasetSqlSchema(selectedDatasetId);
        setSchemaInfo(res);
      } catch (err) {
        console.error("Failed to load dataset schema:", err);
        setError(err.response?.data?.detail || "Unable to read dataset schema.");
      }
    };
    loadSchema();
  }, [selectedDatasetId]);

  const handleDatasetChange = (newId) => {
    if (!newId) return;
    setSelectedDatasetId(String(newId));
    setQueryResult(null);
    setError("");
    navigate(`/sql/${newId}`);
  };

  const handleRunQuery = async (overridePrompt = null, overrideSql = null) => {
    const activePrompt = overridePrompt !== null ? overridePrompt : queryInput;
    const activeSql = overrideSql !== null ? overrideSql : sqlInput;

    if (mode === "nl" && !activePrompt.trim()) return;
    if (mode === "raw_sql" && !activeSql.trim()) return;

    try {
      setExecuting(true);
      setError("");

      const payload = {
        mode,
        query: mode === "nl" ? activePrompt : undefined,
        sql: mode === "raw_sql" ? activeSql : undefined,
      };

      const result = await executeSqlQuery(selectedDatasetId, payload);
      setQueryResult(result);

      if (mode === "nl" && result.sql) {
        setSqlInput(result.sql);
      }

      // Add to session history
      setHistory((prev) => [
        {
          id: Date.now(),
          question: result.question,
          sql: result.sql,
          rows: result.row_count,
          time: result.execution_time_ms,
        },
        ...prev.slice(0, 9),
      ]);
    } catch (err) {
      console.error("Query failed:", err);
      setError(err.response?.data?.detail || "Query execution failed.");
    } finally {
      setExecuting(false);
    }
  };

  const handleCopySql = () => {
    const code = queryResult?.sql || sqlInput;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="dashboard sql-analyst-page">
      {/* =========================
          HEADER
      ========================= */}
      <section className="sql-header">
        <div>
          <p className="eyebrow">AI SQL ANALYST</p>
          <h1>Natural Language to SQL.</h1>
          <p className="intro">
            Ask any question in plain English. CypherCorp plans, validates, executes,
            and returns grounded relational insights on your data.
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
          QUERY CONSOLE
      ========================= */}
      <section className="sql-console-section">
        {/* Mode Switcher */}
        <div className="console-mode-bar">
          <div className="mode-toggle">
            <button
              className={`mode-btn ${mode === "nl" ? "active" : ""}`}
              onClick={() => setMode("nl")}
            >
              <Sparkles size={15} />
              Natural Language (AI)
            </button>
            <button
              className={`mode-btn ${mode === "raw_sql" ? "active" : ""}`}
              onClick={() => setMode("raw_sql")}
            >
              <Code2 size={15} />
              Direct SQL (Expert)
            </button>
          </div>

          <div className="safe-guard-badge">
            <ShieldCheck size={15} />
            <span>Read-Only Guardrails Active</span>
          </div>
        </div>

        {/* Query Input Box */}
        <div className="query-input-container">
          {mode === "nl" ? (
            <div className="input-wrapper">
              <input
                type="text"
                placeholder="e.g. Which region generated the highest average sales?"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRunQuery();
                }}
              />
              <button
                className="primary-button run-btn"
                disabled={executing || !queryInput.trim()}
                onClick={() => handleRunQuery()}
              >
                <Send size={16} />
                {executing ? "Analyzing..." : "Ask AI"}
              </button>
            </div>
          ) : (
            <div className="sql-editor-wrapper">
              <textarea
                placeholder="SELECT * FROM dataset WHERE ..."
                value={sqlInput}
                rows={4}
                onChange={(e) => setSqlInput(e.target.value)}
              />
              <button
                className="primary-button run-btn"
                disabled={executing || !sqlInput.trim()}
                onClick={() => handleRunQuery()}
              >
                <Terminal size={16} />
                {executing ? "Executing..." : "Run SQL"}
              </button>
            </div>
          )}
        </div>

        {/* Suggested Starter Questions */}
        {mode === "nl" && schemaInfo?.suggested_questions?.length > 0 && (
          <div className="suggested-pills-bar">
            <span className="eyebrow">
              <HelpCircle size={12} style={{ verticalAlign: "middle", marginRight: "4px" }} />
              SUGGESTED QUESTIONS:
            </span>
            <div className="pills-list">
              {schemaInfo.suggested_questions.map((question, idx) => (
                <button
                  key={idx}
                  className="question-pill"
                  onClick={() => {
                    setQueryInput(question);
                    handleRunQuery(question);
                  }}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* =========================
          ERROR NOTICE
      ========================= */}
      {error && (
        <section className="sql-error-card">
          <p className="eyebrow">QUERY ERROR</p>
          <p>{error}</p>
        </section>
      )}

      {/* =========================
          QUERY RESULT & INSIGHTS
      ========================= */}
      {queryResult && (
        <section className="sql-results-section">
          {/* Metrics bar */}
          <div className="result-metrics-bar">
            <div className="metric-item">
              <Clock size={15} />
              <span>Execution: <strong>{queryResult.execution_time_ms} ms</strong></span>
            </div>
            <div className="metric-item">
              <Rows3 size={15} />
              <span>Rows Returned: <strong>{queryResult.row_count}</strong></span>
            </div>
            <div className="metric-item">
              <TableIcon size={15} />
              <span>Columns: <strong>{queryResult.columns?.length || 0}</strong></span>
            </div>
          </div>

          {/* AI Grounded Explanation */}
          {queryResult.explanation && (
            <div className="sql-ai-answer-card">
              <div className="ai-badge-row">
                <Sparkles size={18} />
                <span className="eyebrow">GROUNDED DATA SCIENTIST ANSWER</span>
              </div>
              <p>{queryResult.explanation}</p>
            </div>
          )}

          {/* Generated SQL Viewer */}
          <div className="sql-code-viewer">
            <div className="code-viewer-header">
              <span className="eyebrow">EXECUTED SQL QUERY</span>
              <button className="copy-code-btn" onClick={handleCopySql}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? "Copied" : "Copy SQL"}</span>
              </button>
            </div>
            <pre>
              <code>{queryResult.sql}</code>
            </pre>
          </div>

          {/* Data Table */}
          <div className="sql-data-table-container">
            <div className="table-header-bar">
              <span className="eyebrow">QUERY RESULTS ({queryResult.row_count} RECORDS)</span>
            </div>

            {queryResult.row_count === 0 ? (
              <div className="empty-results">No records found matching query criteria.</div>
            ) : (
              <div className="table-scroll-wrapper">
                <table className="sql-table">
                  <thead>
                    <tr>
                      {queryResult.columns?.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResult.rows?.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {queryResult.columns?.map((col) => (
                          <td key={col}>{row[col] !== null ? String(row[col]) : <em style={{ color: "var(--muted)" }}>NULL</em>}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* =========================
          RECENT SESSION HISTORY
      ========================= */}
      {history.length > 0 && (
        <section className="sql-history-section">
          <div className="section-heading">
            <p className="eyebrow">QUERY HISTORY</p>
            <h2>Recent executions</h2>
          </div>

          <div className="history-list">
            {history.map((item) => (
              <div
                className="history-item"
                key={item.id}
                onClick={() => {
                  setSqlInput(item.sql);
                  setMode("raw_sql");
                  handleRunQuery(null, item.sql);
                }}
              >
                <div>
                  <strong>{item.question}</strong>
                  <code>{item.sql}</code>
                </div>
                <div className="history-meta">
                  <span>{item.rows} rows</span> · <span>{item.time} ms</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export default SqlAnalyst;
