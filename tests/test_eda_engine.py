import os
import sys
import tempfile
import time
import unittest
import numpy as np
import pandas as pd

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.profiling.profiler import profile_csv
from app.profiling.statistics import calculate_statistics
from app.profiling.data_quality import analyze_data_quality
from app.profiling.visualizations import generate_visualization_data
from app.profiling.insights import generate_insights
from app.ai.service import build_analysis_context, build_analysis_prompt, ask_ai


class TestEDAEngine(unittest.TestCase):

    def _run_pipeline(self, df: pd.DataFrame):
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w", newline="") as f:
            df.to_csv(f.name, index=False)
            path = f.name
        try:
            profile = profile_csv(path)
            stats = calculate_statistics(path)
            quality = analyze_data_quality(path)
            viz = generate_visualization_data(path)
            insights = generate_insights(stats, quality, viz.get("correlations", {}))
            return profile, stats, quality, viz, insights
        finally:
            if os.path.exists(path):
                os.remove(path)

    def test_empty_rows(self):
        df = pd.DataFrame(columns=["name", "age", "salary"])
        p, s, q, v, ins = self._run_pipeline(df)
        self.assertEqual(p["row_count"], 0)
        self.assertEqual(s["row_count"], 0)
        self.assertEqual(q["row_count"], 0)

    def test_single_row(self):
        df = pd.DataFrame({"name": ["Alice"], "age": [25], "salary": [50000.0]})
        p, s, q, v, ins = self._run_pipeline(df)
        self.assertEqual(p["row_count"], 1)
        self.assertEqual(s["columns"][1]["statistics"]["mean"], 25.0)

    def test_all_null_columns(self):
        df = pd.DataFrame({
            "name": ["Alice", "Bob"],
            "age": [np.nan, np.nan],
            "salary": [50000.0, 60000.0]
        })
        p, s, q, v, ins = self._run_pipeline(df)
        self.assertEqual(q["missing_cells"], 2)
        self.assertIn("age", q["empty_columns"])
        self.assertGreaterEqual(len(v["visualizations"]), 1)

    def test_constant_columns(self):
        df = pd.DataFrame({
            "name": ["A", "B", "C"],
            "status": ["active", "active", "active"],
            "score": [100.0, 100.0, 100.0]
        })
        p, s, q, v, ins = self._run_pipeline(df)
        self.assertIn("status", q["constant_columns"])
        self.assertIn("score", q["constant_columns"])

    def test_datetime_detection(self):
        df = pd.DataFrame({
            "user_id": ["u1", "u2", "u3", "u4"],
            "created_at": ["2024-01-01", "2024-01-02", "2024-02-15", "2024-03-01"],
            "amount": [100.5, 200.0, 150.75, 300.0]
        })
        p, s, q, v, ins = self._run_pipeline(df)
        time_viz = [item for item in v["visualizations"] if item["type"] == "time"]
        self.assertEqual(len(time_viz), 1)
        self.assertEqual(time_viz[0]["column"], "created_at")

    def test_outlier_detection(self):
        df = pd.DataFrame({
            "val": [10.0] * 50 + [500.0, 1000.0, -400.0]
        })
        p, s, q, v, ins = self._run_pipeline(df)
        self.assertGreater(len(q["outliers"]), 0)
        self.assertEqual(q["outliers"][0]["column"], "val")
        self.assertGreaterEqual(q["outliers"][0]["count"], 3)

    def test_correlations(self):
        np.random.seed(42)
        x = np.linspace(1, 100, 50)
        y = 2 * x + np.random.normal(0, 1, 50)
        z = np.random.uniform(0, 1, 50)
        df = pd.DataFrame({"x": x, "y": y, "z": z})
        p, s, q, v, ins = self._run_pipeline(df)
        corrs = v["correlations"]
        self.assertGreater(len(corrs["top_correlations"]), 0)
        top = corrs["top_correlations"][0]
        self.assertTrue((top["column1"] == "x" and top["column2"] == "y") or (top["column1"] == "y" and top["column2"] == "x"))
        self.assertGreater(top["correlation"], 0.95)
        self.assertEqual(top["strength"], "Very Strong Positive")

    def test_dataset_adaptive_analytics_switching(self):
        """Test that switching between different datasets produces completely adaptive analytics and variables."""
        # Dataset A: Sales & Pricing
        df_sales = pd.DataFrame({
            "price": [10.0, 20.0, 30.0, 40.0, 50.0],
            "quantity": [100, 80, 60, 40, 20],
            "sales": [1000.0, 1600.0, 1800.0, 1600.0, 1000.0],
            "profit": [200.0, 400.0, 500.0, 400.0, 200.0],
            "region": ["East", "West", "North", "South", "East"],
        })
        p_sales, s_sales, q_sales, v_sales, ins_sales = self._run_pipeline(df_sales)
        sales_corrs = v_sales["correlations"]["top_correlations"]
        sales_features = set()
        for sc in sales_corrs:
            sales_features.add(sc["feature_a"])
            sales_features.add(sc["feature_b"])

        self.assertIn("price", sales_features)
        self.assertIn("quantity", sales_features)

        # Dataset B: Employee HR
        df_hr = pd.DataFrame({
            "age": [25, 30, 35, 40, 45, 50],
            "salary": [50000, 65000, 80000, 95000, 110000, 125000],
            "experience": [2, 5, 8, 12, 16, 20],
            "rating": [3.5, 4.0, 4.2, 4.5, 4.8, 4.9],
            "department": ["Eng", "Sales", "Eng", "HR", "Sales", "Eng"],
        })
        p_hr, s_hr, q_hr, v_hr, ins_hr = self._run_pipeline(df_hr)
        hr_corrs = v_hr["correlations"]["top_correlations"]
        hr_features = set()
        for hc in hr_corrs:
            hr_features.add(hc["feature_a"])
            hr_features.add(hc["feature_b"])

        self.assertIn("experience", hr_features)
        self.assertIn("salary", hr_features)
        # Verify completely independent schema with no cross-contamination
        self.assertNotIn("price", hr_features)
        self.assertNotIn("salary", sales_features)

    def test_negative_and_5_tier_classification(self):
        """Test exact 5-tier classification labels and direction for negative correlations."""
        df = pd.DataFrame({
            "speed": [10, 20, 30, 40, 50, 60, 70, 80],
            "travel_time": [80, 70, 60, 50, 40, 30, 20, 10], # Perfect negative -1.0
            "fuel_consumed": [5, 12, 18, 26, 35, 45, 58, 72], # Positive non-linear
        })
        p, s, q, v, ins = self._run_pipeline(df)
        corrs = v["correlations"]["top_correlations"]
        self.assertGreaterEqual(len(corrs), 1)
        neg_corr = next((c for c in corrs if c["correlation"] < 0), None)
        self.assertIsNotNone(neg_corr)
        self.assertIn("Negative", neg_corr["strength"])

    def test_insufficient_numeric_empty_state(self):
        """Test dataset with fewer than 2 numeric columns returns clear empty state metadata."""
        df_text_only = pd.DataFrame({
            "name": ["Alice", "Bob", "Charlie"],
            "city": ["New York", "London", "Tokyo"],
            "role": ["Engineer", "Designer", "Manager"],
        })
        p, s, q, v, ins = self._run_pipeline(df_text_only)
        corrs = v["correlations"]
        self.assertEqual(len(corrs["top_correlations"]), 0)
        self.assertEqual(corrs["numeric_column_count"], 0)

    def test_statistics_sum_variance_and_semantic_types(self):
        """Test that statistics include sum, variance, std, and semantic_type."""
        df = pd.DataFrame({
            "revenue": [100.0, 200.0, 300.0],
            "is_active": [True, False, True],
            "category": ["A", "B", "A"],
        })
        p, s, q, v, ins = self._run_pipeline(df)
        rev_col = next(c for c in s["columns"] if c["name"] == "revenue")
        self.assertEqual(rev_col["semantic_type"], "numeric")
        self.assertEqual(rev_col["statistics"]["sum"], 600.0)
        self.assertIsNotNone(rev_col["statistics"]["variance"])

        bool_col = next(c for c in s["columns"] if c["name"] == "is_active")
        self.assertEqual(bool_col["semantic_type"], "boolean")

        cat_col = next(c for c in s["columns"] if c["name"] == "category")
        self.assertEqual(cat_col["semantic_type"], "categorical")

    def test_large_dataset_performance(self):
        np.random.seed(42)
        n_rows = 5000
        data = {}
        for i in range(10):
            data[f"num_{i}"] = np.random.randn(n_rows) * 100
        for i in range(10):
            data[f"cat_{i}"] = np.random.choice(["Alpha", "Beta", "Gamma", "Delta"], size=n_rows)
        for i in range(5):
            data[f"date_{i}"] = pd.date_range("2023-01-01", periods=n_rows, freq="h").astype(str)
        for i in range(5):
            data[f"sparse_{i}"] = np.where(np.random.rand(n_rows) > 0.2, np.random.rand(n_rows), np.nan)

        df = pd.DataFrame(data)
        start = time.time()
        p, s, q, v, ins = self._run_pipeline(df)
        elapsed = time.time() - start

        self.assertEqual(p["row_count"], 5000)
        self.assertEqual(p["column_count"], 30)
        self.assertLess(elapsed, 5.0, f"Processing took {elapsed}s which is > 5s")
        self.assertGreater(len(ins), 0)

    def test_customer_id_and_unique_identifiers_excluded_from_correlations(self):
        """
        Verify that unique entity identifiers like CustomerID are strictly excluded
        from correlation matrix, heatmap, and top correlation pairs, leaving only key features.
        """
        np.random.seed(42)
        n = 100
        df = pd.DataFrame({
            "CustomerID": [1000 + i for i in range(n)],  # Unique integer customer ID (100% unique)
            "Age": np.random.randint(20, 65, size=n),
            "Tenure": np.random.randint(1, 10, size=n),
            "Usage Frequency": np.random.uniform(5.0, 50.0, size=n),
            "Support Calls": np.random.randint(0, 8, size=n),
            "Payment Delay": np.random.randint(0, 30, size=n),
            "Total Spend": np.random.uniform(100.0, 5000.0, size=n),
            "Last Interaction": np.random.randint(1, 60, size=n),
            "Churn": np.random.choice([0, 1], size=n, p=[0.7, 0.3]),
        })

        p, s, q, v, ins = self._run_pipeline(df)
        corrs = v.get("correlations", {})
        corr_cols = corrs.get("columns", [])
        matrix = corrs.get("matrix", [])
        top_corrs = corrs.get("top_correlations", [])

        # CustomerID MUST NOT be present in correlation columns
        self.assertNotIn("CustomerID", corr_cols)

        # CustomerID MUST NOT be in any matrix row or value map
        for row in matrix:
            self.assertNotEqual(row["column"], "CustomerID")
            self.assertNotIn("CustomerID", row["values"])

        # CustomerID MUST NOT be in top correlation pairs
        for pair in top_corrs:
            self.assertNotEqual(pair["column1"], "CustomerID")
            self.assertNotEqual(pair["column2"], "CustomerID")
            self.assertNotEqual(pair.get("feature_a"), "CustomerID")
            self.assertNotEqual(pair.get("feature_b"), "CustomerID")

        # All 8 key domain features MUST be present
        expected_features = [
            "Age", "Tenure", "Usage Frequency", "Support Calls",
            "Payment Delay", "Total Spend", "Last Interaction", "Churn"
        ]
        for feat in expected_features:
            self.assertIn(feat, corr_cols)

        self.assertEqual(len(corr_cols), len(expected_features))

    def test_various_identifier_formats_and_non_id_words(self):
        """Test camelCase CustomerID, snake_case user_id, row numbers, UUIDs are excluded, while real words (grid, fluid) are kept."""
        np.random.seed(42)
        n = 50
        df = pd.DataFrame({
            "CustomerID": [f"CUST_{i:04d}" for i in range(n)],
            "user_id": [2000 + i for i in range(n)],
            "row_id": list(range(1, n + 1)),
            "grid_stability": np.random.uniform(0.1, 0.9, size=n),
            "fluid_flow": np.random.uniform(10.0, 100.0, size=n),
            "total_spend": np.random.uniform(50.0, 500.0, size=n),
            "churn_rate": np.random.uniform(0.0, 1.0, size=n),
        })

        p, s, q, v, ins = self._run_pipeline(df)
        corr_cols = v.get("correlations", {}).get("columns", [])

        # Identifiers excluded
        self.assertNotIn("CustomerID", corr_cols)
        self.assertNotIn("user_id", corr_cols)
        self.assertNotIn("row_id", corr_cols)

        # Legitimate domain features preserved
        self.assertIn("grid_stability", corr_cols)
        self.assertIn("fluid_flow", corr_cols)
        self.assertIn("total_spend", corr_cols)
        self.assertIn("churn_rate", corr_cols)


if __name__ == "__main__":
    unittest.main()
