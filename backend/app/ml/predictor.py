import math
from pathlib import Path
from typing import Any
import joblib
import numpy as np
import pandas as pd


def predict_sample(model_path: str, input_data: dict[str, Any]) -> dict[str, Any]:
    """
    Run real-time inference on a custom user input record using the serialized pipeline artifact.
    """
    path = Path(model_path)
    if not path.exists():
        raise FileNotFoundError(f"Trained model artifact not found at {model_path}")

    artifact = joblib.load(path)

    model = artifact["model"]
    scaler = artifact["scaler"]
    label_encoder = artifact["label_encoder"]
    feature_names = artifact["feature_names"]
    problem_type = artifact["problem_type"]
    num_cols = artifact["num_cols"]
    cat_cols = artifact["cat_cols"]
    target_classes = artifact["target_classes"]

    # 1. Construct single-row DataFrame
    row_dict = {}
    for col in num_cols:
        val = input_data.get(col)
        try:
            row_dict[col] = float(val) if val is not None else 0.0
        except (ValueError, TypeError):
            row_dict[col] = 0.0

    for col in cat_cols:
        val = input_data.get(col)
        row_dict[col] = str(val) if val is not None else "Missing"

    # 2. Re-create feature vector aligned with feature_names
    vector = np.zeros(len(feature_names))

    for idx, f_name in enumerate(feature_names):
        if f_name in num_cols:
            vector[idx] = row_dict.get(f_name, 0.0)
        else:
            # Check if this is a dummy column for categorical
            for cat_col in cat_cols:
                prefix = f"{cat_col}_"
                if f_name.startswith(prefix):
                    category_val = f_name[len(prefix):]
                    if str(row_dict.get(cat_col)) == category_val:
                        vector[idx] = 1.0

    # 3. Scale features
    vector_scaled = scaler.transform(vector.reshape(1, -1))

    # 4. Run Model Prediction
    raw_pred = model.predict(vector_scaled)[0]

    probabilities = None
    confidence_pct = None
    verdict = ""
    explanation = ""

    if problem_type == "classification":
        if label_encoder is not None:
            try:
                prediction_label = str(label_encoder.inverse_transform([int(raw_pred)])[0])
            except Exception:
                prediction_label = str(raw_pred)
        else:
            prediction_label = str(raw_pred)

        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(vector_scaled)[0]
            probabilities = {
                target_classes[i] if i < len(target_classes) else f"Class_{i}": round(float(p), 4)
                for i, p in enumerate(probs)
            }
            max_prob = max(probs)
            confidence_pct = round(float(max_prob * 100), 1)

        prediction_val = prediction_label
        verdict = f"{artifact['target_column']} = {prediction_val}"
        conf_str = f" with {confidence_pct}% confidence" if confidence_pct is not None else ""
        explanation = (
            f"The champion {artifact['model_name']} model classifies this record as '{prediction_val}'{conf_str} "
            f"based on the provided feature values."
        )
    else:
        prediction_val = round(float(raw_pred), 4)
        verdict = f"Predicted {artifact['target_column']} = {prediction_val:,.2f}"
        explanation = (
            f"The champion {artifact['model_name']} model estimates a value of {prediction_val:,.2f} "
            f"for '{artifact['target_column']}' based on the supplied parameters."
        )

    return {
        "prediction": prediction_val,
        "verdict": verdict,
        "explanation": explanation,
        "confidence_pct": confidence_pct,
        "probabilities": probabilities,
        "problem_type": problem_type,
        "model_name": artifact["model_name"],
        "target_column": artifact["target_column"],
    }
