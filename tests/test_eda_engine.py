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

    def test_ai_fallback(self):
        df = pd.DataFrame({"a": [1, 2, 3], "b": [10, 20, 30]})
        p, s, q, v, ins = self._run_pipeline(df)
        context = build_analysis_context(s, q, ins, v.get("correlations", {}))
        prompt = build_analysis_prompt(context)
        result = ask_ai(prompt, context)
        self.assertIn("summary", result)
        self.assertIn("data_quality", result)
        self.assertIn("key_findings", result)
        self.assertIn("recommendations", result)
        self.assertGreater(len(result["summary"]), 0)


if __name__ == "__main__":
    unittest.main()
