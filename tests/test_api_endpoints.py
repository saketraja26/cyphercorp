import os
import sys
import unittest
import tempfile
import pandas as pd

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from fastapi.testclient import TestClient
from app.main import app
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.dataset import Dataset
from app.database.database import get_db

class MockUser:
    id = 1
    email = "test@cyphercorp.ai"
    is_active = True

async def override_get_current_user():
    return MockUser()

app.dependency_overrides[get_current_user] = override_get_current_user

class TestApiEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_root(self):
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "running")

    def test_eda_workflow_on_csv(self):
        from app.profiling.profiler import profile_csv
        from app.profiling.statistics import calculate_statistics
        from app.profiling.data_quality import analyze_data_quality
        from app.profiling.visualizations import generate_visualization_data
        from app.profiling.insights import generate_insights
        from app.ai.service import build_analysis_context, build_analysis_prompt, ask_ai

        df = pd.DataFrame({
            "product": ["A", "B", "C", "D", "E"],
            "sales": [100.0, 150.0, 200.0, 250.0, 1000.0],
            "units": [10, 15, 20, 25, 30],
            "region": ["North", "South", "East", "West", "North"],
        })

        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w", newline="") as f:
            df.to_csv(f.name, index=False)
            path = f.name

        try:
            profile = profile_csv(path)
            stats = calculate_statistics(path)
            quality = analyze_data_quality(path)
            viz = generate_visualization_data(path)
            corrs = viz.get("correlations", {})
            insights = generate_insights(stats, quality, corrs)
            context = build_analysis_context(stats, quality, insights, corrs)
            prompt = build_analysis_prompt(context)
            ai_res = ask_ai(prompt, context)

            self.assertEqual(profile["row_count"], 5)
            self.assertEqual(profile["column_count"], 4)
            self.assertEqual(quality["health_status"], "Excellent")
            self.assertGreater(len(corrs["top_correlations"]), 0)
            self.assertGreater(len(insights), 0)
            self.assertIn("summary", ai_res)
        finally:
            if os.path.exists(path):
                os.remove(path)

    def test_ensure_dataset_file_rehydrates_from_db(self):
        from app.datasets.storage import ensure_dataset_file
        csv_content = "id,name,val\n1,Alpha,100\n2,Beta,200\n"
        dataset = Dataset(
            id=999,
            name="test_rehydrate",
            user_id=1,
            row_count=2,
            column_count=3,
            file_path="uploads/1/missing_test_file.csv",
            csv_data=csv_content,
        )
        # Ensure file does not exist on disk
        if os.path.exists(dataset.file_path):
            os.remove(dataset.file_path)

        restored_path = ensure_dataset_file(dataset)
        self.assertTrue(restored_path.is_file())
        self.assertEqual(restored_path.read_text(encoding="utf-8-sig"), csv_content)
        # Cleanup
        if restored_path.exists():
            restored_path.unlink()


    def test_password_hash_and_verify(self):
        from app.auth.security import hash_password, verify_password
        pwd = "SecurePassword123!"
        hashed = hash_password(pwd)
        self.assertTrue(verify_password(pwd, hashed))
        self.assertFalse(verify_password("WrongPassword", hashed))


if __name__ == "__main__":
    unittest.main()
