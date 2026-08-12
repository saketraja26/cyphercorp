import os
import sys
import tempfile
import unittest
import pandas as pd

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "test_secret_key_12345678901234567890")

from app.sql.sql_validator import validate_sql
from app.sql.sql_engine import execute_sql_query, get_dataset_schema
from app.sql.sql_generator import (
    generate_sql_from_nl,
    explain_query_result,
    generate_suggested_questions,
)


class TestSqlEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_df = pd.DataFrame({
            "product": ["Laptop", "Mouse", "Monitor", "Keyboard", "Headset"],
            "category": ["Electronics", "Accessories", "Electronics", "Accessories", "Audio"],
            "price": [1200.0, 25.0, 300.0, 75.0, 150.0],
            "units_sold": [50, 400, 120, 250, 180],
        })
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w", newline="") as f:
            cls.test_df.to_csv(f.name, index=False)
            cls.csv_path = f.name

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.csv_path):
            os.remove(cls.csv_path)

    # 1. Security & Guardrail Tests
    def test_security_reject_drop(self):
        with self.assertRaises(ValueError):
            validate_sql("DROP TABLE dataset")

    def test_security_reject_delete(self):
        with self.assertRaises(ValueError):
            validate_sql("DELETE FROM dataset WHERE price > 100")

    def test_security_reject_update(self):
        with self.assertRaises(ValueError):
            validate_sql("UPDATE dataset SET price = 0")

    def test_security_reject_insert(self):
        with self.assertRaises(ValueError):
            validate_sql("INSERT INTO dataset VALUES ('Phone', 'Tech', 999, 10)")

    def test_security_reject_alter(self):
        with self.assertRaises(ValueError):
            validate_sql("ALTER TABLE dataset ADD COLUMN secret TEXT")

    def test_security_reject_multi_statement(self):
        with self.assertRaises(ValueError):
            validate_sql("SELECT * FROM dataset; DROP TABLE dataset;")

    def test_security_reject_attach(self):
        with self.assertRaises(ValueError):
            validate_sql("ATTACH DATABASE 'malicious.db' AS mal")

    # 2. Execution Tests
    def test_valid_select_query(self):
        res = execute_sql_query(self.csv_path, "SELECT product, price FROM dataset WHERE price > 100 ORDER BY price DESC")
        self.assertEqual(res["row_count"], 3)
        self.assertEqual(res["columns"], ["product", "price"])
        self.assertEqual(res["rows"][0]["product"], "Laptop")
        self.assertGreater(res["execution_time_ms"], 0)

    def test_valid_aggregation_query(self):
        res = execute_sql_query(self.csv_path, 'SELECT category, SUM(units_sold) as total_units FROM dataset GROUP BY category ORDER BY total_units DESC')
        self.assertEqual(res["row_count"], 3)
        self.assertEqual(res["columns"], ["category", "total_units"])
        self.assertEqual(res["rows"][0]["category"], "Accessories")
        self.assertEqual(res["rows"][0]["total_units"], 650)

    def test_valid_cte_query(self):
        cte_sql = """
        WITH HighValue AS (
            SELECT product, price * units_sold AS revenue FROM dataset
        )
        SELECT product, revenue FROM HighValue WHERE revenue > 20000 ORDER BY revenue DESC
        """
        res = execute_sql_query(self.csv_path, cte_sql)
        self.assertEqual(res["row_count"], 3)
        self.assertEqual(res["rows"][0]["product"], "Laptop")

    # 3. Schema & NL Tests
    def test_get_dataset_schema(self):
        schema = get_dataset_schema(self.csv_path)
        self.assertEqual(schema["table_name"], "dataset")
        self.assertEqual(schema["column_count"], 4)
        self.assertEqual(len(schema["columns"]), 4)

    def test_suggested_questions(self):
        schema = get_dataset_schema(self.csv_path)
        suggestions = generate_suggested_questions(schema)
        self.assertGreaterEqual(len(suggestions), 3)

    def test_nl_to_sql_and_explain(self):
        schema = get_dataset_schema(self.csv_path)
        question = "Which product has the highest price?"
        sql = generate_sql_from_nl(question, schema)
        self.assertTrue(sql.upper().startswith("SELECT"))
        res = execute_sql_query(self.csv_path, sql)
        self.assertGreater(res["row_count"], 0)
        explanation = explain_query_result(question, sql, res)
        self.assertIsInstance(explanation, str)
        self.assertGreater(len(explanation), 10)

    def test_customer_id_counts_not_summed(self):
        customer_schema = {
            "columns": [
                {"name": "CustomerID", "data_type": "INTEGER", "sample_values": [1, 2, 3]},
                {"name": "Gender", "data_type": "TEXT", "sample_values": ["Male", "Female"]},
            ],
            "sample_rows": [{"CustomerID": 1, "Gender": "Female"}],
        }
        sql = generate_sql_from_nl("which gender has the highest number of customer id", customer_schema)
        self.assertIn("COUNT", sql.upper())
        self.assertNotIn("SUM", sql.upper())
        self.assertNotIn("AVG", sql.upper())

    def test_first_10_rows_limit_preserved(self):
        schema = get_dataset_schema(self.csv_path)
        sql = generate_sql_from_nl("see first 10 row", schema)
        self.assertIn("LIMIT 10", sql.upper())
        self.assertNotIn("LIMIT 25", sql.upper())


if __name__ == "__main__":
    unittest.main()
