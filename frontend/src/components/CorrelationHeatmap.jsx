import { useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Info,
  Layers,
  Sparkles,
  CheckCircle,
} from "lucide-react";

/**
 * Interactive, accessible Correlation Matrix Heatmap Chart.
 * Features:
 * - Full N x N Pearson correlation grid
 * - Dynamic color gradient (-1.0 Negative in Red to +1.0 Positive in Green)
 * - Row and column header highlighting on hover
 * - Real-time cell inspector with directional badges and interpretation
 * - Color scale legend
 * - Responsive horizontal scrolling with sticky axis headers
 */
export default function CorrelationHeatmap({
  columns = [],
  matrix = [],
  topCorrelations = [],
}) {
  const [hoveredCell, setHoveredCell] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);

  // Matrix map lookup for instant cell access
  const matrixMap = useMemo(() => {
    const map = {};
    matrix.forEach((row) => {
      map[row.column] = row.values || {};
    });
    return map;
  }, [matrix]);

  // Color calculation helper
  const getCellStyles = (val, isDiagonal) => {
    if (isDiagonal || val === 1.0) {
      return {
        background: "rgba(15, 23, 42, 0.08)",
        color: "#0f172a",
        fontWeight: 700,
      };
    }

    if (val === null || val === undefined || isNaN(val)) {
      return {
        background: "#f8fafc",
        color: "#94a3b8",
      };
    }

    const absVal = Math.abs(val);

    if (val > 0) {
      // Positive: Emerald Green gradient
      const alpha = Math.min(0.9, Math.max(0.12, absVal * 0.9));
      const textColor = absVal >= 0.52 ? "#ffffff" : "#0f172a";
      return {
        background: `rgba(22, 163, 74, ${alpha})`,
        color: textColor,
        fontWeight: absVal >= 0.4 ? 700 : 600,
      };
    } else if (val < 0) {
      // Negative: Crimson Red gradient
      const alpha = Math.min(0.9, Math.max(0.12, absVal * 0.9));
      const textColor = absVal >= 0.52 ? "#ffffff" : "#0f172a";
      return {
        background: `rgba(220, 38, 38, ${alpha})`,
        color: textColor,
        fontWeight: absVal >= 0.4 ? 700 : 600,
      };
    }

    return {
      background: "rgba(241, 245, 249, 0.7)",
      color: "#64748b",
      fontWeight: 500,
    };
  };

  // Helper to classify correlation
  const getCellClassification = (val) => {
    if (val === 1.0) return { strength: "Identity (1.00)", isPos: true };
    const absVal = Math.abs(val);
    const isPos = val >= 0;
    let tier = "Very Weak";
    if (absVal >= 0.80) tier = "Very Strong";
    else if (absVal >= 0.60) tier = "Strong";
    else if (absVal >= 0.40) tier = "Moderate";
    else if (absVal >= 0.20) tier = "Weak";

    return {
      strength: `${tier} ${isPos ? "Positive" : "Negative"}`,
      tier,
      isPos,
    };
  };

  const activeInspection = selectedCell || hoveredCell;

  if (columns.length < 2) {
    return (
      <div className="analysis-empty-card">
        <Layers size={24} className="empty-card-icon" />
        <h4>Heatmap Unavailable</h4>
        <p>At least two valid numeric columns are required to construct the correlation matrix.</p>
      </div>
    );
  }

  return (
    <div className="correlation-heatmap-container">
      {/* Interactive Inspector Banner */}
      <div className="heatmap-inspector-card">
        {activeInspection ? (
          <div className="inspector-content active">
            <div className="inspector-pair-badge">
              <span className="col-name">{activeInspection.rowCol}</span>
              <span className="vs-tag">vs</span>
              <span className="col-name">{activeInspection.colCol}</span>
            </div>

            <div className="inspector-metrics">
              <div className="inspector-value-pill">
                {activeInspection.isDiagonal ? (
                  <CheckCircle size={15} color="#0f172a" />
                ) : activeInspection.isPos ? (
                  <TrendingUp size={15} color="#16a34a" />
                ) : (
                  <TrendingDown size={15} color="#dc2626" />
                )}
                <span className="value-number mono">
                  {activeInspection.value > 0 ? `+${activeInspection.value.toFixed(3)}` : activeInspection.value.toFixed(3)}
                </span>
                <span className={`strength-tag ${activeInspection.isPos ? "positive" : "negative"}`}>
                  {activeInspection.strength}
                </span>
              </div>

              <span className="inspector-explanation">
                {activeInspection.isDiagonal
                  ? "Perfect self-correlation (same feature)."
                  : activeInspection.isPos
                  ? `Positive relationship: as ${activeInspection.rowCol} increases, ${activeInspection.colCol} tends to increase.`
                  : `Inverse relationship: as ${activeInspection.rowCol} increases, ${activeInspection.colCol} tends to decrease.`}
              </span>
            </div>
          </div>
        ) : (
          <div className="inspector-content placeholder">
            <Info size={15} />
            <span>Hover or click any cell in the heatmap matrix below to inspect pairwise correlation values.</span>
          </div>
        )}
      </div>

      {/* Heatmap Grid Table */}
      <div className="heatmap-scroll-wrapper">
        <table className="heatmap-matrix-table">
          <thead>
            <tr>
              <th className="heatmap-corner-cell">Features</th>
              {columns.map((col) => {
                const isHoveredAxis =
                  activeInspection &&
                  (activeInspection.colCol === col || activeInspection.rowCol === col);

                return (
                  <th
                    key={col}
                    className={`heatmap-col-header ${isHoveredAxis ? "highlight" : ""}`}
                    title={col}
                  >
                    <span className="col-header-text">{col}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {columns.map((rowCol) => {
              const isHoveredRow =
                activeInspection &&
                (activeInspection.rowCol === rowCol || activeInspection.colCol === rowCol);

              return (
                <tr key={rowCol}>
                  <td
                    className={`heatmap-row-header ${isHoveredRow ? "highlight" : ""}`}
                    title={rowCol}
                  >
                    <span className="row-header-text">{rowCol}</span>
                  </td>

                  {columns.map((colCol) => {
                    const isDiagonal = rowCol === colCol;
                    const val = matrixMap[rowCol]?.[colCol] ?? (isDiagonal ? 1.0 : 0.0);
                    const cellInfo = getCellClassification(val);
                    const styles = getCellStyles(val, isDiagonal);

                    const isCellActive =
                      activeInspection &&
                      activeInspection.rowCol === rowCol &&
                      activeInspection.colCol === colCol;

                    return (
                      <td
                        key={colCol}
                        className={`heatmap-cell ${isDiagonal ? "diagonal" : ""} ${
                          isCellActive ? "active-cell" : ""
                        }`}
                        style={styles}
                        onMouseEnter={() =>
                          setHoveredCell({
                            rowCol,
                            colCol,
                            value: val,
                            strength: cellInfo.strength,
                            isPos: cellInfo.isPos,
                            isDiagonal,
                          })
                        }
                        onMouseLeave={() => setHoveredCell(null)}
                        onClick={() =>
                          setSelectedCell((prev) =>
                            prev?.rowCol === rowCol && prev?.colCol === colCol
                              ? null
                              : {
                                  rowCol,
                                  colCol,
                                  value: val,
                                  strength: cellInfo.strength,
                                  isPos: cellInfo.isPos,
                                  isDiagonal,
                                }
                          )
                        }
                        title={`${rowCol} vs ${colCol}: ${val > 0 ? `+${val.toFixed(3)}` : val.toFixed(3)} (${cellInfo.strength})`}
                      >
                        <span className="cell-val mono">
                          {isDiagonal ? "1.00" : val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Heatmap Legend Bar */}
      <div className="heatmap-legend-row">
        <div className="legend-label neg">
          <TrendingDown size={13} />
          <span>-1.0 Negative</span>
        </div>

        <div className="legend-gradient-bar">
          <div className="gradient-track" />
          <div className="gradient-center-marker">
            <span>0.0 Neutral</span>
          </div>
        </div>

        <div className="legend-label pos">
          <TrendingUp size={13} />
          <span>+1.0 Positive</span>
        </div>
      </div>
    </div>
  );
}
