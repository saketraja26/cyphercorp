import { useState, useRef, useEffect, useMemo } from "react";
import {
  ChevronDown,
  Search,
  Check,
  Sparkles,
  AlertTriangle,
  ShieldAlert,
  Layers,
  X,
  Database,
  Tag,
  Hash,
} from "lucide-react";

/**
 * Enhanced, accessible, highly readable dropdown for selecting AutoML Target Variables.
 * Features:
 * - Real-time column search and filtering
 * - Category / Task filter tabs (All, Recommended, Classification, Regression, Warnings)
 * - Grouped presentation (Recommended vs Eligible vs Warnings/Identifiers)
 * - Rich metadata display (Task badge, Quality badge, Data type, Unique categories count, Sample values)
 * - Keyboard navigation (Arrows, Enter, Escape)
 * - Responsive, modern glassmorphism styling with high-contrast readability
 */
export default function TargetSelectDropdown({
  targets = [],
  selectedTarget = "",
  onSelectTarget,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilterTab, setActiveFilterTab] = useState("all");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Find currently selected target object
  const currentTarget = useMemo(() => {
    return targets.find((t) => t.name === selectedTarget) || null;
  }, [targets, selectedTarget]);

  // Counts for filter tabs
  const tabCounts = useMemo(() => {
    let recommended = 0;
    let classification = 0;
    let regression = 0;
    let warnings = 0;

    targets.forEach((t) => {
      if (t.status === "recommended" && !t.is_identifier) recommended++;
      if (t.suggested_task === "classification") classification++;
      if (t.suggested_task === "regression") regression++;
      if (t.is_identifier || t.status === "warning" || t.status === "not_recommended") {
        warnings++;
      }
    });

    return {
      all: targets.length,
      recommended,
      classification,
      regression,
      warnings,
    };
  }, [targets]);

  // Filter targets based on search query and active tab
  const filteredTargets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return targets.filter((t) => {
      // Tab filter
      if (activeFilterTab === "recommended" && (t.status !== "recommended" || t.is_identifier)) {
        return false;
      }
      if (activeFilterTab === "classification" && t.suggested_task !== "classification") {
        return false;
      }
      if (activeFilterTab === "regression" && t.suggested_task !== "regression") {
        return false;
      }
      if (
        activeFilterTab === "warnings" &&
        !t.is_identifier &&
        t.status !== "warning" &&
        t.status !== "not_recommended"
      ) {
        return false;
      }

      // Search query filter
      if (!query) return true;
      const matchName = t.name.toLowerCase().includes(query);
      const matchTask = (t.suggested_task || "").toLowerCase().includes(query);
      const matchType = (t.data_type || "").toLowerCase().includes(query);
      const matchVerdict = (t.quality_verdict || "").toLowerCase().includes(query);
      const matchSamples = (t.sample_values || []).some((s) =>
        String(s).toLowerCase().includes(query)
      );

      return matchName || matchTask || matchType || matchVerdict || matchSamples;
    });
  }, [targets, searchQuery, activeFilterTab]);

  // Group filtered targets into Recommended, Eligible, and Warnings/Identifiers
  const groupedTargets = useMemo(() => {
    const recommended = [];
    const eligible = [];
    const warnings = [];

    filteredTargets.forEach((t) => {
      if (t.is_identifier || t.status === "not_recommended" || t.status === "warning") {
        warnings.push(t);
      } else if (t.status === "recommended") {
        recommended.push(t);
      } else {
        eligible.push(t);
      }
    });

    const groups = [];
    if (recommended.length > 0) {
      groups.push({
        id: "recommended",
        title: "Recommended Targets",
        subtitle: "Optimal for high-performance machine learning",
        icon: <Sparkles size={14} className="text-amber-500" />,
        items: recommended,
      });
    }
    if (eligible.length > 0) {
      groups.push({
        id: "eligible",
        title: "Eligible Variables",
        subtitle: "Valid columns suitable for predictive modeling",
        icon: <Layers size={14} />,
        items: eligible,
      });
    }
    if (warnings.length > 0) {
      groups.push({
        id: "warnings",
        title: "Identifiers & Caution Columns",
        subtitle: "High-cardinality IDs, constant values, or target leakage risks",
        icon: <AlertTriangle size={14} className="text-amber-500" />,
        items: warnings,
      });
    }

    return groups;
  }, [filteredTargets]);

  // Flatten items for keyboard navigation
  const flatItems = useMemo(() => {
    return groupedTargets.flatMap((g) => g.items);
  }, [groupedTargets]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      setHighlightedIndex(-1);
    } else {
      setSearchQuery("");
      setActiveFilterTab("all");
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev + 1;
        return next >= flatItems.length ? 0 : next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? flatItems.length - 1 : next;
      });
    } else if (e.key === "Enter" && highlightedIndex >= 0 && flatItems[highlightedIndex]) {
      e.preventDefault();
      handleSelect(flatItems[highlightedIndex].name);
    }
  };

  const handleSelect = (targetName) => {
    if (onSelectTarget) {
      onSelectTarget(targetName);
    }
    setIsOpen(false);
  };

  // Helper for rendering status pill
  const renderStatusBadge = (t) => {
    if (t.is_identifier) {
      return (
        <span className="target-pill-badge identifier" title="High uniqueness identifier">
          <ShieldAlert size={11} /> Identifier (Not Recommended)
        </span>
      );
    }
    if (t.status === "warning") {
      return (
        <span className="target-pill-badge warning" title="Target quality warning">
          <AlertTriangle size={11} /> Caution / Warning
        </span>
      );
    }
    if (t.status === "recommended") {
      return (
        <span className="target-pill-badge recommended" title="Recommended AutoML target">
          <Sparkles size={11} /> Recommended
        </span>
      );
    }
    return (
      <span className="target-pill-badge standard">
        Eligible
      </span>
    );
  };

  return (
    <div
      className={`target-custom-dropdown-container ${isOpen ? "is-open" : ""} ${
        disabled ? "is-disabled" : ""
      }`}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {/* ========================================================
          TRIGGER BUTTON (CLOSED STATE)
          ======================================================== */}
      <button
        type="button"
        className="target-dropdown-trigger"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <div className="target-trigger-content">
          {currentTarget ? (
            <>
              <div className="target-trigger-main-row">
                <span className="target-trigger-name" title={currentTarget.name}>
                  {currentTarget.name}
                </span>

                <div className="target-trigger-badges">
                  <span
                    className={`task-badge-pill ${
                      currentTarget.suggested_task === "classification"
                        ? "classification"
                        : "regression"
                    }`}
                  >
                    {currentTarget.suggested_task === "classification"
                      ? "Classification"
                      : "Regression"}
                  </span>
                  {renderStatusBadge(currentTarget)}
                </div>
              </div>

              <div className="target-trigger-sub-row">
                <span className="target-meta-chip">
                  <Tag size={12} />
                  <code>{currentTarget.data_type}</code>
                </span>
                <span className="target-meta-divider">•</span>
                <span className="target-meta-chip">
                  <Hash size={12} />
                  {currentTarget.suggested_task === "classification"
                    ? `${currentTarget.unique_count} categories`
                    : `${currentTarget.unique_count?.toLocaleString()} unique values`}
                </span>

                {currentTarget.sample_values && currentTarget.sample_values.length > 0 && (
                  <>
                    <span className="target-meta-divider">•</span>
                    <span className="target-meta-samples" title={currentTarget.sample_values.join(", ")}>
                      Samples: {currentTarget.sample_values.slice(0, 3).join(", ")}
                    </span>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="target-trigger-placeholder">
              <Database size={16} />
              <span>Select predictive target column...</span>
            </div>
          )}
        </div>

        <div className="target-trigger-arrow">
          <ChevronDown size={18} className={`chevron-icon ${isOpen ? "rotate" : ""}`} />
        </div>
      </button>

      {/* ========================================================
          DROPDOWN OVERLAY / MENU
          ======================================================== */}
      {isOpen && (
        <div className="target-dropdown-menu" role="listbox">
          {/* Header & Quick Search */}
          <div className="target-menu-header">
            <div className="target-search-box">
              <Search size={15} className="target-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                className="target-search-input"
                placeholder="Search target columns, data types, sample values..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="target-search-clear-btn"
                  onClick={() => setSearchQuery("")}
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="target-filter-tabs">
              <button
                type="button"
                className={`target-tab-btn ${activeFilterTab === "all" ? "active" : ""}`}
                onClick={() => setActiveFilterTab("all")}
              >
                All ({tabCounts.all})
              </button>
              {tabCounts.recommended > 0 && (
                <button
                  type="button"
                  className={`target-tab-btn rec ${
                    activeFilterTab === "recommended" ? "active" : ""
                  }`}
                  onClick={() => setActiveFilterTab("recommended")}
                >
                  <Sparkles size={11} /> Recommended ({tabCounts.recommended})
                </button>
              )}
              {tabCounts.classification > 0 && (
                <button
                  type="button"
                  className={`target-tab-btn clf ${
                    activeFilterTab === "classification" ? "active" : ""
                  }`}
                  onClick={() => setActiveFilterTab("classification")}
                >
                  Classification ({tabCounts.classification})
                </button>
              )}
              {tabCounts.regression > 0 && (
                <button
                  type="button"
                  className={`target-tab-btn reg ${
                    activeFilterTab === "regression" ? "active" : ""
                  }`}
                  onClick={() => setActiveFilterTab("regression")}
                >
                  Regression ({tabCounts.regression})
                </button>
              )}
              {tabCounts.warnings > 0 && (
                <button
                  type="button"
                  className={`target-tab-btn warn ${
                    activeFilterTab === "warnings" ? "active" : ""
                  }`}
                  onClick={() => setActiveFilterTab("warnings")}
                >
                  <AlertTriangle size={11} /> Warnings ({tabCounts.warnings})
                </button>
              )}
            </div>
          </div>

          {/* Grouped Target List */}
          <div className="target-options-list" ref={listRef}>
            {groupedTargets.length === 0 ? (
              <div className="target-empty-state">
                <AlertTriangle size={20} className="empty-icon" />
                <p>No target columns match &quot;{searchQuery}&quot;</p>
                <button
                  type="button"
                  className="target-reset-filter-btn"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveFilterTab("all");
                  }}
                >
                  Reset search & filters
                </button>
              </div>
            ) : (
              groupedTargets.map((group) => (
                <div className="target-option-group" key={group.id}>
                  <div className="target-group-header">
                    <div className="group-title-row">
                      {group.icon}
                      <span className="group-title">{group.title}</span>
                      <span className="group-count">({group.items.length})</span>
                    </div>
                    <span className="group-subtitle">{group.subtitle}</span>
                  </div>

                  <div className="target-group-items">
                    {group.items.map((item) => {
                      const isSelected = item.name === selectedTarget;
                      const isHighlighted =
                        flatItems[highlightedIndex]?.name === item.name;

                      return (
                        <div
                          key={item.name}
                          className={`target-option-card ${
                            isSelected ? "is-selected" : ""
                          } ${isHighlighted ? "is-highlighted" : ""} ${
                            item.is_identifier ? "is-identifier-item" : ""
                          }`}
                          onClick={() => handleSelect(item.name)}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <div className="target-option-radio">
                            <div className={`radio-dot ${isSelected ? "checked" : ""}`}>
                              {isSelected && <Check size={12} />}
                            </div>
                          </div>

                          <div className="target-option-body">
                            <div className="target-option-header-row">
                              <span className="target-option-name">{item.name}</span>

                              <div className="target-option-badges">
                                <span
                                  className={`task-badge-pill ${
                                    item.suggested_task === "classification"
                                      ? "classification"
                                      : "regression"
                                  }`}
                                >
                                  {item.suggested_task === "classification"
                                    ? "Classification"
                                    : "Regression"}
                                </span>
                                {renderStatusBadge(item)}
                              </div>
                            </div>

                            <div className="target-option-details-row">
                              <span className="target-chip">
                                <Tag size={11} />
                                <code>{item.data_type}</code>
                              </span>
                              <span className="target-chip">
                                <Hash size={11} />
                                {item.suggested_task === "classification"
                                  ? `${item.unique_count} categories`
                                  : `${item.unique_count?.toLocaleString()} unique values`}
                              </span>

                              {item.sample_values && item.sample_values.length > 0 && (
                                <span
                                  className="target-samples-preview"
                                  title={item.sample_values.join(", ")}
                                >
                                  Samples: {item.sample_values.slice(0, 3).join(", ")}
                                </span>
                              )}
                            </div>

                            {/* Optional Quality Reason / Explanatory Note */}
                            {item.quality_verdict && (
                              <div className="target-verdict-note">
                                <span>{item.quality_verdict}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
