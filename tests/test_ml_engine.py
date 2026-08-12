import os
import sys
import tempfile
import unittest
import numpy as np
import pandas as pd

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.ml.preprocessor import detect_problem_type, get_target_candidates, preprocess_and_split
from app.ml.trainer import train_automl_pipeline
from app.ml.predictor import predict_sample


class TestMlEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # 1. Classification Dataset (Customer Churn)
        np.random.seed(42)
        n = 100
        cls.clf_df = pd.DataFrame({
            "customer_id": [f"CUST_{i}" for i in range(n)],
            "age": np.random.randint(18, 70, size=n),
            "monthly_charges": np.random.uniform(20.0, 120.0, size=n),
            "contract": np.random.choice(["Month-to-Month", "One-Year", "Two-Year"], size=n),
            "churn": np.random.choice(["Yes", "No"], size=n, p=[0.3, 0.7]),
        })

        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w", newline="") as f:
            cls.clf_df.to_csv(f.name, index=False)
            cls.clf_csv = f.name

        # 2. Regression Dataset (House Prices)
        cls.reg_df = pd.DataFrame({
            "sqft": np.random.uniform(500, 3500, size=n),
            "bedrooms": np.random.randint(1, 5, size=n),
            "location": np.random.choice(["Urban", "Suburban", "Rural"], size=n),
            "price": np.random.uniform(150000, 800000, size=n),
        })

        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w", newline="") as f:
            cls.reg_df.to_csv(f.name, index=False)
            cls.reg_csv = f.name

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.clf_csv):
            os.remove(cls.clf_csv)
        if os.path.exists(cls.reg_csv):
            os.remove(cls.reg_csv)

    def test_target_candidates(self):
        candidates = get_target_candidates(self.clf_csv)
        target_names = [c["name"] for c in candidates]
        self.assertIn("churn", target_names)
        self.assertIn("contract", target_names)
        # customer_id should be filtered out due to high unique ID ratio
        self.assertNotIn("customer_id", target_names)

    def test_problem_type_detection(self):
        self.assertEqual(detect_problem_type(self.clf_df["churn"]), "classification")
        self.assertEqual(detect_problem_type(self.reg_df["price"]), "regression")

    def test_preprocessing_and_split(self):
        prep = preprocess_and_split(self.clf_df, target_column="churn")
        self.assertEqual(prep["problem_type"], "classification")
        self.assertGreater(prep["train_samples"], 0)
        self.assertGreater(prep["test_samples"], 0)
        self.assertEqual(prep["train_samples"] + prep["test_samples"], 100)

    def test_classification_training_and_leaderboard(self):
        result = train_automl_pipeline(self.clf_csv, target_column="churn", dataset_id=1)
        self.assertEqual(result["problem_type"], "classification")
        self.assertGreater(len(result["leaderboard"]), 2)
        self.assertIn("best_model_name", result)
        self.assertGreater(len(result["feature_importance"]), 0)
        self.assertIn("sample_record", result)
        self.assertIn("raw_features", result)
        self.assertGreater(len(result["sample_record"]), 0)
        self.assertTrue(os.path.exists(result["model_file"]))

        # Test live prediction on trained model
        pred = predict_sample(
            model_path=result["model_file"],
            input_data=result["sample_record"],
        )
        self.assertIn("prediction", pred)
        self.assertIn(pred["prediction"], ["Yes", "No"])
        self.assertIsNotNone(pred["probabilities"])

        # Clean up model file
        if os.path.exists(result["model_file"]):
            os.remove(result["model_file"])

    def test_regression_training_and_prediction(self):
        result = train_automl_pipeline(self.reg_csv, target_column="price", dataset_id=2)
        self.assertEqual(result["problem_type"], "regression")
        self.assertGreater(len(result["leaderboard"]), 2)
        self.assertIn("r2_score", result["leaderboard"][0])
        self.assertIn("rmse", result["leaderboard"][0])
        self.assertTrue(os.path.exists(result["model_file"]))

        # Test prediction
        pred = predict_sample(
            model_path=result["model_file"],
            input_data={"sqft": 2000, "bedrooms": 3, "location": "Suburban"},
        )
        self.assertIsInstance(pred["prediction"], float)
        self.assertGreater(pred["prediction"], 0)

        # Clean up model file
        if os.path.exists(result["model_file"]):
            os.remove(result["model_file"])


if __name__ == "__main__":
    unittest.main()
