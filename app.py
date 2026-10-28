import os
import math
import json
from flask import Flask, render_template, request, jsonify, send_from_directory
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0


# Load exported model metadata
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model_metadata.json")
try:
    with open(MODEL_PATH, "r") as f:
        MODEL_META = json.load(f)
except Exception as e:
    print(f"Warning: Could not load model_metadata.json: {e}")
    MODEL_META = {}

MONGO_URI = os.getenv("MONGO_URI") or os.getenv("MONGODB_URI")


def get_category_index(category_col: str, value: str) -> float:
    """Helper to convert string category to numeric index using learned labels."""
    if not MODEL_META or "labels_map" not in MODEL_META:
        return 0.0
    labels = MODEL_META["labels_map"].get(category_col, [])
    if value in labels:
        return float(labels.index(value))
    return float(len(labels))  # Spark handleInvalid='keep' maps unseen to index = len(labels)


def calculate_risk(features_dict: dict) -> dict:
    """
    Computes exact Logistic Regression inference matching PySpark MLlib:
    1. Extract feature values in exact pipeline order
    2. Apply StandardScaler: (x - mean) / std
    3. Apply dot product with learned coefficients + intercept
    4. Apply Sigmoid function: 1 / (1 + exp(-z))
    """
    days_real = float(features_dict.get("days_real", 3.0))
    days_sched = float(features_dict.get("days_scheduled", 4.0))
    shipping_mode = features_dict.get("shipping_mode", "Standard Class")
    order_status = features_dict.get("order_status", "COMPLETE")
    pay_type = features_dict.get("type", "DEBIT")
    zipcode = float(features_dict.get("zipcode", 725))
    city = features_dict.get("city", "Caguas")
    qty = float(features_dict.get("quantity", 1))
    dept_id = float(features_dict.get("department_id", 2))
    segment = features_dict.get("segment", "Consumer")
    lname = features_dict.get("lname", "Holloway")
    state = features_dict.get("state", "PR")

    raw_features = [
        days_real,
        days_sched,
        get_category_index("Shipping Mode", shipping_mode),
        get_category_index("Order Status", order_status),
        get_category_index("Type", pay_type),
        zipcode,
        get_category_index("Customer City", city),
        qty,
        dept_id,
        get_category_index("Customer Segment", segment),
        get_category_index("Customer Lname", lname),
        get_category_index("Customer State", state),
    ]

    means = MODEL_META.get("scaler_mean", [0.0] * 12)
    stds = MODEL_META.get("scaler_std", [1.0] * 12)
    coeffs = MODEL_META.get("coefficients", [0.0] * 12)
    intercept = MODEL_META.get("intercept", 0.0)

    # Standardize & compute contribution
    z = intercept
    contributions = []
    feature_names = [
        "Days for shipping (real)",
        "Days for shipment (scheduled)",
        "Shipping Mode",
        "Order Status",
        "Payment Type",
        "Customer Zipcode",
        "Customer City",
        "Order Quantity",
        "Department ID",
        "Customer Segment",
        "Customer Surname",
        "Customer State",
    ]

    for i in range(len(raw_features)):
        mean_val = means[i]
        std_val = stds[i] if stds[i] != 0 else 1.0
        norm_val = (raw_features[i] - mean_val) / std_val
        impact = coeffs[i] * norm_val
        z += impact
        contributions.append({
            "name": feature_names[i],
            "raw_value": raw_features[i],
            "impact": round(impact, 3),
            "coefficient": round(coeffs[i], 3),
        })

    # Numerically stable sigmoid
    if z >= 0:
        prob = 1.0 / (1.0 + math.exp(-z))
    else:
        prob = math.exp(z) / (1.0 + math.exp(z))

    prob = max(0.0001, min(0.9999, prob))
    prediction = 1 if prob >= 0.5 else 0

    if prob < 0.35:
        risk_level = "Low Risk"
        risk_color = "emerald"
    elif prob < 0.70:
        risk_level = "Moderate Risk"
        risk_color = "amber"
    else:
        risk_level = "High Late Risk"
        risk_color = "rose"

    # Sort contributions by absolute impact
    contributions.sort(key=lambda x: abs(x["impact"]), reverse=True)

    recommendations = []
    if days_real > days_sched:
        recommendations.append(f"Actual transit time ({int(days_real)} days) exceeds scheduled window ({int(days_sched)} days). Priority re-routing required.")
    if shipping_mode == "First Class" and days_real > 2:
        recommendations.append("First Class service guarantee breached. Flag dispatch expediter.")
    if prob >= 0.5:
        recommendations.append("Proactively send delivery delay notification email/SMS to customer.")
        recommendations.append("Review local fulfillment center inventory allocation.")
    else:
        recommendations.append("Order is on track for on-time delivery. Standard monitoring active.")

    return {
        "prediction": prediction,
        "is_late_risk": bool(prediction == 1),
        "probability": round(prob, 4),
        "risk_percentage": round(prob * 100, 1),
        "risk_level": risk_level,
        "risk_color": risk_color,
        "logit_z": round(z, 3),
        "top_contributions": contributions[:5],
        "recommendations": recommendations,
    }


@app.route("/")
def index():
    return render_template("index.html", meta=MODEL_META)


@app.route("/api/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json() or {}
        result = calculate_risk(data)
        return jsonify({"success": True, "data": result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route("/api/metrics", methods=["GET"])
def metrics():
    return jsonify({
        "success": True,
        "metrics": MODEL_META.get("metrics", {}),
        "features": MODEL_META.get("features", []),
        "coefficients": MODEL_META.get("coefficients", []),
    })


@app.route("/api/mongo/status", methods=["GET"])
def mongo_status():
    if not MONGO_URI:
        return jsonify({"connected": False, "message": "MONGO_URI not configured in .env"})
    try:
        from pymongo import MongoClient
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
        client.admin.command("ping")
        db = client["Regression_loogistic"]
        collection = db["preprocessing"]
        count = collection.estimated_document_count()
        client.close()
        return jsonify({
            "connected": True,
            "database": "Regression_loogistic",
            "collection": "preprocessing",
            "count": count,
        })
    except Exception as e:
        return jsonify({"connected": False, "error": str(e)})


@app.route("/api/mongo/samples", methods=["GET"])
def mongo_samples():
    if not MONGO_URI:
        return jsonify({"success": False, "error": "No MONGO_URI"})
    try:
        from pymongo import MongoClient
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
        db = client["Regression_loogistic"]
        collection = db["preprocessing"]
        docs = list(collection.find({}, {
            "_id": 0,
            "Type": 1,
            "Days for shipping (real)": 1,
            "Days for shipment (scheduled)": 1,
            "Delivery Status": 1,
            "Late_delivery_risk": 1,
            "Category Name": 1,
            "Customer City": 1,
            "Customer State": 1,
            "Order City": 1,
            "Order Country": 1,
            "Order Status": 1,
            "Shipping Mode": 1,
            "Sales": 1,
        }).limit(8))
        client.close()
        return jsonify({"success": True, "samples": docs})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route("/assets/<path:filename>")
def serve_assets(filename):
    assets_dir = os.path.join(os.path.dirname(__file__), "assets")
    return send_from_directory(assets_dir, filename)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Late Delivery Risk Prediction Web Server on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)

