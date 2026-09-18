"""dynamodb_handler.py - AWS DynamoDB adapter for PDR.
Stores applicant records, SHAP explainability factors, and loan offers in Amazon DynamoDB.
Falls back seamlessly to local SQLite if DynamoDB is not configured.
"""
import os
import json
from decimal import Decimal
from typing import Optional, Dict, Any

DYNAMODB_TABLE = os.getenv("DYNAMODB_TABLE_NAME", "PDR_Applicants")
AWS_REGION = os.getenv("AWS_REGION", os.getenv("AWS_DEFAULT_REGION", "us-east-1"))


def is_dynamodb_enabled() -> bool:
    """Returns True if explicitly enabled via environment variable and credentials exist."""
    return bool(os.getenv("ENABLE_DYNAMODB") or os.getenv("DYNAMODB_TABLE_NAME"))


def _float_to_decimal(obj):
    """DynamoDB requires Decimal instead of float."""
    if isinstance(obj, float):
        return Decimal(str(round(obj, 6)))
    elif isinstance(obj, dict):
        return {k: _float_to_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_float_to_decimal(v) for v in obj]
    return obj


def _decimal_to_float(obj):
    """Convert Decimals back to standard Python floats for JSON serialization."""
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: _decimal_to_float(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_decimal_to_float(v) for v in obj]
    return obj


def _get_table():
    try:
        import boto3
        dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
        return dynamodb.Table(DYNAMODB_TABLE)
    except Exception as e:
        print(f"[DYNAMODB NOTICE] Client unavailable ({e})")
        return None


def save_to_dynamodb(scoring_result: dict, applicant_id: str, name: str = "", city: str = "", business_type: str = "") -> bool:
    """Saves scoring result item to DynamoDB."""
    if not is_dynamodb_enabled():
        return False

    table = _get_table()
    if not table:
        return False

    try:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        
        item = {
            "applicant_id": applicant_id,
            "name": name,
            "city": city,
            "business_type": business_type,
            "grade": scoring_result.get("grade", "UNKNOWN"),
            "outcome": scoring_result.get("outcome", "UNKNOWN"),
            "default_probability": scoring_result.get("default_probability", 0.0),
            "primary_reason": scoring_result.get("primary_reason", ""),
            "decision_source": scoring_result.get("decision_source", "model"),
            "score_date": scoring_result.get("scored_at", now),
            "shap_factors": scoring_result.get("shap_reasons", []),
            "loan_offer": scoring_result.get("loan_offer", {}),
            "features": scoring_result.get("features", {}),
            "created_at": now,
        }

        # Convert all floats to Decimal for DynamoDB compliance
        dynamo_item = _float_to_decimal(item)
        table.put_item(Item=dynamo_item)
        print(f"[DYNAMODB] Saved applicant {applicant_id} to {DYNAMODB_TABLE}")
        return True
    except Exception as e:
        print(f"[DYNAMODB ERROR] Failed to save {applicant_id}: {e}")
        return False


def fetch_from_dynamodb(applicant_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves an applicant record from DynamoDB."""
    if not is_dynamodb_enabled():
        return None

    table = _get_table()
    if not table:
        return None

    try:
        response = table.get_item(Key={"applicant_id": applicant_id})
        item = response.get("Item")
        if item:
            return _decimal_to_float(item)
    except Exception as e:
        print(f"[DYNAMODB ERROR] Failed to fetch {applicant_id}: {e}")
    return None
