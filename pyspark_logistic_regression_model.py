# -*- coding: utf-8 -*-
"""
Late Delivery Risk Prediction using PySpark Logistic Regression.

This script implements an end-to-end Machine Learning pipeline:
1. Loads the DataCo Supply Chain Dataset.
2. Cleans and preprocesses data (handling missing values, dropping unneeded columns).
3. Encodes categorical variables using PySpark StringIndexer and OneHotEncoder.
4. Performs correlation analysis and multicollinearity filtering.
5. Builds a feature pipeline (VectorAssembler & StandardScaler).
6. Trains a Logistic Regression model to predict 'Late_delivery_risk'.
7. Evaluates performance using AUC-ROC, Recall, F1-Score, and a Confusion Matrix.
"""

import os
import sys
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from dotenv import load_dotenv

# PySpark imports
from pyspark.sql import SparkSession
import pyspark.sql.functions as F
from pyspark.ml import Pipeline
from pyspark.ml.feature import StringIndexer, OneHotEncoder, VectorAssembler, StandardScaler
from pyspark.ml.classification import LogisticRegression
from pyspark.ml.evaluation import BinaryClassificationEvaluator, MulticlassClassificationEvaluator


def export_to_mongodb(csv_path: str, batch_size: int = 1000):
    """
    Optional helper function to ingest the dataset into MongoDB Atlas.
    Requires MONGO_URI to be configured in .env or environment variables.
    """
    load_dotenv()
    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        print("[MongoDB] MONGO_URI not found. Skipping MongoDB export.")
        return

    try:
        from pymongo import MongoClient
        from tqdm import tqdm

        print(f"[MongoDB] Connecting to MongoDB Atlas...")
        client = MongoClient(mongo_uri)
        db = client["Regression_loogistic"]
        collection = db["preprocessing"]

        print(f"[MongoDB] Reading {csv_path} for MongoDB ingestion...")
        df_raw = pd.read_csv(csv_path, encoding="latin1")
        data = df_raw.to_dict("records")

        print(f"[MongoDB] Inserting {len(data)} records in batches of {batch_size}...")
        for i in tqdm(range(0, len(data), batch_size), desc="Ingesting to MongoDB"):
            batch = data[i : i + batch_size]
            collection.insert_many(batch)

        print(f"[MongoDB] Total documents in collection: {collection.count_documents({})}")
        client.close()
        print("[MongoDB] Ingestion completed successfully.")
    except Exception as e:
        print(f"[MongoDB] Error during ingestion: {e}")


def main():
    # 1. Resolve dataset path
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(base_dir, "DataCoSupplyChainDataset.csv")

    if not os.path.exists(csv_path):
        print(f"Error: Dataset file not found at {csv_path}")
        print("Please ensure DataCoSupplyChainDataset.csv is in the project root directory.")
        sys.exit(1)

    print("=" * 60)
    print("Late Delivery Risk Prediction - PySpark ML Pipeline")
    print("=" * 60)

    # 2. Initialize SparkSession
    print("[1/7] Initializing PySpark Session...")
    spark = (
        SparkSession.builder.master("local[*]")
        .appName("SupplyChainLateDeliveryPrediction")
        .config("spark.driver.memory", "4g")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")

    # 3. Load Dataset
    print(f"[2/7] Loading dataset from: {csv_path}...")
    dc = spark.read.csv(csv_path, header=True, inferSchema=True)
    print(f"Total Rows: {dc.count()} | Total Columns: {len(dc.columns)}")

    # 4. Data Cleaning
    print("[3/7] Cleaning data and removing unnecessary columns...")
    columns_to_drop = [
        "Customer Email",
        "Customer Country",
        "Customer Password",
        "Longitude",
        "Latitude",
        "Customer Street",
        "Product Image",
        "order date (DateOrders)",
        "Product Description",
        "Order Zipcode",
        "Shipping Zipcode",
    ]
    dsc = dc.drop(*columns_to_drop)

    # Inspect null counts and drop rows with nulls
    print("Checking for null values...")
    null_counts = dsc.select([F.sum(F.col(c).isNull().cast("int")).alias(c) for c in dsc.columns])
    null_counts.show()

    dc_c = dsc.dropna()
    print(f"Rows after dropna: {dc_c.count()}")

    # 5. Define Feature Sets
    numerical_columns = [
        "Days for shipping (real)",
        "Days for shipment (scheduled)",
        "Benefit per order",
        "Sales per customer",
        "Category Id",
        "Customer Id",
        "Customer Zipcode",
        "Department Id",
        "Order Customer Id",
        "Order Id",
        "Order Item Cardprod Id",
        "Order Item Discount",
        "Order Item Discount Rate",
        "Order Item Id",
        "Order Item Product Price",
        "Order Item Profit Ratio",
        "Order Item Quantity",
        "Sales",
        "Order Item Total",
        "Product Card Id",
        "Order Profit Per Order",
        "Product Category Id",
        "Product Price",
        "Product Status",
    ]

    categorical_cols = [
        "Type",
        "Delivery Status",
        "Category Name",
        "Customer City",
        "Customer Fname",
        "Customer Lname",
        "Customer Segment",
        "Customer State",
        "Department Name",
        "Market",
        "Order City",
        "Order Country",
        "Order Region",
        "Order State",
        "Order Status",
        "Product Name",
        "Shipping Mode",
    ]

    # 6. Feature Encoding
    print("[4/7] Indexing and One-Hot Encoding categorical features...")
    indexers = [
        StringIndexer(inputCol=c, outputCol=f"{c}_index", handleInvalid="keep")
        for c in categorical_cols
    ]

    encoders = [
        OneHotEncoder(
            dropLast=False,
            inputCol=indexer.getOutputCol(),
            outputCol=f"{indexer.getOutputCol()}_encoded",
        )
        for indexer in indexers
    ]

    # Index categorical features for exploratory correlation analysis
    index_pipeline = Pipeline(stages=indexers)
    df_indexed = index_pipeline.fit(dc_c).transform(dc_c)

    # Drop high-cardinality/redundant original string columns before correlation
    cols_to_remove_for_corr = [
        "Type",
        "Delivery Status",
        "Category Name",
        "Customer City",
        "Customer Fname",
        "Customer Lname",
        "Customer Segment",
        "Customer State",
        "Department Name",
        "Market",
        "Order City",
        "Order Country",
        "Order Region",
        "Order State",
        "shipping date (DateOrders)",
        "Order Status",
        "Product Name",
        "Shipping Mode",
    ]
    df_for_corr = df_indexed.drop(*cols_to_remove_for_corr)

    # 7. Correlation Analysis (Sampled for efficiency)
    print("[5/7] Performing Correlation Analysis...")
    sample_size = min(50000, df_for_corr.count())
    pandas_sample = df_for_corr.limit(sample_size).toPandas()

    corr_matrix = pandas_sample.corr(numeric_only=True).round(2)

    # Save heatmap visualization
    assets_dir = os.path.join(base_dir, "assets")
    os.makedirs(assets_dir, exist_ok=True)
    corr_plot_path = os.path.join(assets_dir, "correlation_heatmap.png")

    plt.figure(figsize=(18, 16))
    sns.heatmap(corr_matrix, annot=False, cmap="coolwarm", linewidths=0.5)
    plt.title("Feature Correlation Matrix", fontsize=16)
    plt.tight_layout()
    plt.savefig(corr_plot_path, dpi=200)
    plt.close()
    print(f"Correlation heatmap saved to: {corr_plot_path}")

    # Identify multi-collinear features (Correlation > 0.85)
    upper_triangle = corr_matrix.where(
        np.triu(np.ones(corr_matrix.shape), k=1).astype(bool)
    )
    high_corr_pairs = upper_triangle.stack().reset_index()
    high_corr_pairs.columns = ["Feature 1", "Feature 2", "Correlation"]
    high_corr_pairs = high_corr_pairs[high_corr_pairs["Correlation"] > 0.85]

    print(f"Found {len(high_corr_pairs)} highly correlated feature pairs (> 0.85):")
    print(high_corr_pairs.head(10).to_string(index=False))

    target = "Late_delivery_risk"
    if target in corr_matrix.columns:
        corr_with_target = corr_matrix[target].abs().sort_values(ascending=False)
        print("\nTop 10 Features correlated with Late_delivery_risk:")
        print(corr_with_target.head(10).to_string())

    # 8. Feature Pipeline for Modeling
    print("[6/7] Building modeling pipeline...")
    # Selected features based on EDA & domain importance (excluding target leakages)
    feature_cols_advanc = [
        "Days for shipping (real)",
        "Days for shipment (scheduled)",
        "Shipping Mode_index",
        "Order Status_index",
        "Type_index",
        "Customer Zipcode",
        "Customer City_index",
        "Order Item Quantity",
        "Department Id",
        "Customer Segment_index",
        "Customer Lname_index",
        "Customer State_index",
    ]

    feature_assembler = VectorAssembler(
        inputCols=feature_cols_advanc,
        outputCol="advanced_features",
        handleInvalid="skip",
    )

    feature_scaler = StandardScaler(
        inputCol="advanced_features",
        outputCol="trained_advanced_features",
        withMean=True,
        withStd=True,
    )

    # Transform dataset with full pipeline
    stages = indexers + [feature_assembler, feature_scaler]
    model_prep_pipeline = Pipeline(stages=stages)
    prepared_data = model_prep_pipeline.fit(dc_c).transform(dc_c)

    # 9. Train / Test Split
    print("[7/7] Training Logistic Regression Model...")
    train_data, test_data = prepared_data.randomSplit([0.8, 0.2], seed=42)
    print(f"Training set: {train_data.count()} | Testing set: {test_data.count()}")

    # 10. Logistic Regression Training
    log_re = LogisticRegression(
        featuresCol="trained_advanced_features",
        labelCol="Late_delivery_risk",
        maxIter=20,
    )
    logistic_model = log_re.fit(train_data)
    print("Model training complete.")

    # 11. Model Evaluation
    print("\n" + "=" * 60)
    print("MODEL EVALUATION RESULTS")
    print("=" * 60)
    predictions = logistic_model.transform(test_data)
    predictions.select("Late_delivery_risk", "prediction", "probability").show(10, truncate=False)

    # AUC-ROC
    binary_eval = BinaryClassificationEvaluator(
        labelCol="Late_delivery_risk",
        rawPredictionCol="rawPrediction",
        metricName="areaUnderROC",
    )
    auc = binary_eval.evaluate(predictions)
    print(f"ROC-AUC Score:      {auc:.4f}")

    # Weighted Recall
    multiclass_eval_recall = MulticlassClassificationEvaluator(
        labelCol="Late_delivery_risk",
        predictionCol="prediction",
        metricName="weightedRecall",
    )
    recall = multiclass_eval_recall.evaluate(predictions)
    print(f"Weighted Recall:    {recall:.4f}")

    # F1-Score
    multiclass_eval_f1 = MulticlassClassificationEvaluator(
        labelCol="Late_delivery_risk",
        predictionCol="prediction",
        metricName="f1",
    )
    f1 = multiclass_eval_f1.evaluate(predictions)
    print(f"F1-Score:           {f1:.4f}")

    # Confusion Matrix Counts
    print("\nConfusion Matrix (Late_delivery_risk vs Prediction):")
    predictions.groupBy("Late_delivery_risk", "prediction").count().show()

    # 12. Clean Up Spark
    spark.stop()
    print("Spark session stopped cleanly. Pipeline completed successfully!")


if __name__ == "__main__":
    main()
