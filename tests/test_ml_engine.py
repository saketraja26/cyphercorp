import os
import sys
import tempfile
import unittest
import numpy as np
import pandas as pd

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.ml.preprocessor import (
    analyze_column_identifier,
    detect_problem_type,
    detect_target_leakage,
    evaluate_target_eligibility,
    get_target_candidates,
    preprocess_and_split,
)
from app.ml.trainer import train_automl_pipeline
from app.ml.predictor import predict_sample


class TestMlEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        np.random.seed(42)
        n = 100

        # 1. Customer Churn Dataset with CustomerID, sequential ID, and Leakage column
        cls.clf_df = pd.DataFrame({
            "CustomerID": [f"CUST_{i:04d}" for i in range(n)],
            "row_id": list(range(1, n + 1)),
            "age": np.random.randint(18, 70, size=n),
            "monthly_charges": np.random.uniform(20.0, 120.0, size=n),
            "contract": np.random.choice(["Month-to-Month", "One-Year", "Two-Year"], size=n),
            "churn": np.random.choice(["Yes", "No"], size=n, p=[0.3, 0.7]),
            "churn_reason": [
                "Price increase" if i % 4 == 0 else ("Competitor" if i % 4 == 1 else "None")
                for i in range(n)
            ],
            "constant_col": ["FixedValue"] * n,
        })

        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w", newline="") as f:
            cls.clf_df.to_csv(f.name, index=False)
            cls.clf_csv = f.name

        # 2. Regression Dataset (House Prices) with transaction_id
        cls.reg_df = pd.DataFrame({
            "transaction_id": [f"TX_{i}" for i in range(n)],
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

    def test_identifier_detection_heuristics(self):
        """Test identifier detection across name patterns, uniqueness ratios, and sequential series."""
        total_rows = len(self.clf_df)

        # 1. CustomerID with prefix pattern & 100% uniqueness
        cust_id_info = analyze_column_identifier(self.clf_df["CustomerID"], "CustomerID", total_rows)
        self.assertTrue(cust_id_info["is_identifier"])
        self.assertGreater(cust_id_info["confidence"], 0.8)
        self.assertEqual(cust_id_info["uniqueness_ratio"], 1.0)

        # 2. Sequential integer row_id
        row_id_info = analyze_column_identifier(self.clf_df["row_id"], "row_id", total_rows)
        self.assertTrue(row_id_info["is_identifier"])
        self.assertTrue(row_id_info["is_sequential"])

        # 3. Regular feature: monthly_charges
        charges_info = analyze_column_identifier(self.clf_df["monthly_charges"], "monthly_charges", total_rows)
        self.assertFalse(charges_info["is_identifier"])

        # 4. Target variable: churn
        churn_info = analyze_column_identifier(self.clf_df["churn"], "churn", total_rows)
        self.assertFalse(churn_info["is_identifier"])

    def test_target_eligibility_and_ranking(self):
        """Test target evaluation and intelligent recommendation of genuine outcomes over IDs."""
        total_rows = len(self.clf_df)

        # CustomerID should be evaluated as candidate identifier & not recommended
        cust_eval = evaluate_target_eligibility(self.clf_df["CustomerID"], "CustomerID", total_rows)
        self.assertEqual(cust_eval["status"], "not_recommended")
        self.assertTrue(cust_eval["is_identifier"])
        self.assertEqual(cust_eval["quality_verdict"], "Candidate Identifier")

        # Churn should be recommended as classification target with class distribution
        churn_eval = evaluate_target_eligibility(self.clf_df["churn"], "churn", total_rows)
        self.assertIn(churn_eval["status"], ["recommended", "warning"])
        self.assertEqual(churn_eval["suggested_task"], "classification")
        self.assertIsNotNone(churn_eval["class_distribution"])

        # Constant column should be ineligible
        const_eval = evaluate_target_eligibility(self.clf_df["constant_col"], "constant_col", total_rows)
        self.assertEqual(const_eval["status"], "not_recommended")
        self.assertEqual(const_eval["quality_verdict"], "Ineligible")

        # Full target candidate summary via CSV
        candidates_data = get_target_candidates(self.clf_csv)
        self.assertEqual(candidates_data["recommended_target"], "churn")
        self.assertIn("CustomerID", candidates_data["identifier_columns"])
        self.assertIn("CustomerID", candidates_data["recommendation_banner"])
        self.assertIn("excluded from predictive modeling", candidates_data["recommendation_banner"])
        self.assertIn("Recommended target: churn", candidates_data["recommendation_banner"])

    def test_target_leakage_detection(self):
        """Test detection of post-outcome variables and extreme correlation."""
        leakage = detect_target_leakage(self.clf_df, "churn")
        self.assertIn("churn_reason", leakage)
        self.assertEqual(leakage["churn_reason"]["risk"], "high")

    def test_zero_leakage_preprocessing_and_split(self):
        """Test train/test split isolation and preprocessor fit strictly on training set."""
        prep = preprocess_and_split(self.clf_df, target_column="churn")

        self.assertEqual(prep["problem_type"], "classification")
        self.assertNotIn("CustomerID", prep["active_features"])
        self.assertNotIn("row_id", prep["active_features"])
        self.assertNotIn("constant_col", prep["active_features"])
        self.assertNotIn("churn_reason", prep["active_features"])

        # Active features should only include valid modeling predictors
        self.assertIn("age", prep["active_features"])
        self.assertIn("monthly_charges", prep["active_features"])
        self.assertIn("contract", prep["active_features"])

        # Check sample splits
        self.assertEqual(prep["train_samples"], 80)
        self.assertEqual(prep["test_samples"], 20)
        self.assertTrue(prep["stratified_split"])

        # Verify transformers fitted
        self.assertIn("age", prep["numeric_medians"])
        self.assertIn("contract", prep["cat_vocab"])

    def test_feature_override_customization(self):
        """Test manual user overrides for including/excluding features."""
        # Force include CustomerID and exclude age
        prep = preprocess_and_split(
            self.clf_df,
            target_column="churn",
            included_features=["CustomerID"],
            excluded_features=["age"],
        )
        self.assertIn("CustomerID", prep["active_features"])
        self.assertNotIn("age", prep["active_features"])

    def test_classification_training_cv_and_leaderboard(self):
        """Test training pipeline with 3-fold cross validation and isolated test evaluation."""
        result = train_automl_pipeline(self.clf_csv, target_column="churn", dataset_id=1)

        self.assertEqual(result["problem_type"], "classification")
        self.assertGreater(len(result["leaderboard"]), 2)
        self.assertIn("best_model_name", result)

        # Verify cross validation scores present in leaderboard
        for item in result["leaderboard"]:
            self.assertIn("cv_score_mean", item)
            self.assertIn("cv_score_std", item)
            self.assertIn("f1_score", item)
            self.assertIn("accuracy", item)

        self.assertTrue(os.path.exists(result["model_file"]))

        # Live real-time prediction with Local Feature Attribution
        pred = predict_sample(
            model_path=result["model_file"],
            input_data=result["sample_record"],
        )
        self.assertIn("prediction", pred)
        self.assertIn(pred["prediction"], ["Yes", "No"])
        self.assertIsNotNone(pred["probabilities"])
        self.assertIsNotNone(pred["confidence_pct"])
        self.assertIn("feature_attributions", pred)
        self.assertGreater(len(pred["feature_attributions"]), 0)

        # Verify Feature Attribution & Model Diagnostics
        self.assertIn("feature_attribution", result)
        self.assertGreater(len(result["feature_attribution"]), 0)
        top_attr = result["feature_attribution"][0]
        self.assertIn("direction", top_attr)
        self.assertIn("direction_label", top_attr)
        self.assertIn("narrative", top_attr)

        self.assertIn("model_diagnostics", result)
        diag = result["model_diagnostics"]
        self.assertIn("grade", diag)
        self.assertIn("readiness", diag)
        self.assertIn("executive_narrative", diag)
        self.assertIn("class_metrics", diag)

        if os.path.exists(result["model_file"]):
            os.remove(result["model_file"])

    def test_regression_training_and_prediction(self):
        """Test regression pipeline on house prices with transaction_id auto-excluded."""
        candidates_data = get_target_candidates(self.reg_csv)
        self.assertEqual(candidates_data["recommended_target"], "price")
        self.assertIn("transaction_id", candidates_data["identifier_columns"])

        result = train_automl_pipeline(self.reg_csv, target_column="price", dataset_id=2)
        self.assertEqual(result["problem_type"], "regression")
        self.assertNotIn("transaction_id", result["active_features"])

        for item in result["leaderboard"]:
            self.assertIn("cv_score_mean", item)
            self.assertIn("r2_score", item)
            self.assertIn("rmse", item)

        # Test live inference
        pred = predict_sample(
            model_path=result["model_file"],
            input_data={"sqft": 2000, "bedrooms": 3, "location": "Suburban"},
        )
        self.assertIsInstance(pred["prediction"], float)
        self.assertGreater(pred["prediction"], 0)
        self.assertIn("feature_attributions", pred)

        self.assertIn("model_diagnostics", result)
        self.assertIn("executive_narrative", result["model_diagnostics"])
        self.assertIn("over_prediction_pct", result["model_diagnostics"])

        if os.path.exists(result["model_file"]):
            os.remove(result["model_file"])

    def test_large_dataset_automl_pipeline(self):
        """Test AutoML pipeline stability on large datasets (>9,000 rows) with infinite values and high-cardinality."""
        n_large = 9500
        large_df = pd.DataFrame({
            "id": list(range(n_large)),
            "feat_num1": np.random.uniform(0, 100, size=n_large),
            "feat_num2_noisy": [np.inf if i == 5 else (np.nan if i == 10 else float(i % 50)) for i in range(n_large)],
            "feat_cat_high_card": [f"Category_{i % 50}" for i in range(n_large)],
            "target_class": np.random.choice(["Class_A", "Class_B"], size=n_large, p=[0.8, 0.2]),
        })

        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w", newline="") as f:
            large_df.to_csv(f.name, index=False)
            large_csv = f.name

        try:
            candidates = get_target_candidates(large_csv)
            self.assertEqual(candidates["recommended_target"], "target_class")

            res = train_automl_pipeline(large_csv, target_column="target_class", dataset_id=99)
            self.assertEqual(res["problem_type"], "classification")
            self.assertGreater(len(res["leaderboard"]), 0)
            self.assertIn("feature_attribution", res)
            self.assertIn("model_diagnostics", res)

            # Test inference on large trained model
            pred = predict_sample(
                model_path=res["model_file"],
                input_data={"feat_num1": 55.0, "feat_num2_noisy": 12.0, "feat_cat_high_card": "Category_3"},
            )
            self.assertIn("prediction", pred)
            self.assertIn("feature_attributions", pred)

            if os.path.exists(res["model_file"]):
                os.remove(res["model_file"])
        finally:
            if os.path.exists(large_csv):
                os.remove(large_csv)


if __name__ == "__main__":
    unittest.main()
