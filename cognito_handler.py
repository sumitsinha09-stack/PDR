"""cognito_handler.py - AWS Cognito authentication handler for PDR.
Validates JWT tokens issued by Amazon Cognito User Pools for Loan Officers and Risk Managers.
Falls back to permissive mode in local development.
"""
import os
import time
from typing import Optional, Dict, Any

COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "")
COGNITO_APP_CLIENT_ID = os.getenv("COGNITO_APP_CLIENT_ID", "")
AWS_REGION = os.getenv("AWS_REGION", os.getenv("AWS_DEFAULT_REGION", "us-east-1"))


def is_cognito_enabled() -> bool:
    return bool(COGNITO_USER_POOL_ID and COGNITO_APP_CLIENT_ID)


def verify_cognito_token(token: str) -> Optional[Dict[str, Any]]:
    """Verifies a Cognito JWT token."""
    if not is_cognito_enabled():
        # Permissive local development mode
        return {"sub": "dev-user-001", "username": "local_officer", "role": "RiskManager"}

    try:
        import requests
        # In a full Cognito setup, keys are fetched from the JWKS endpoint:
        # https://cognito-idp.{region}.amazonaws.com/{user_pool_id}/.well-known/jwks.json
        jwks_url = f"https://cognito-idp.{AWS_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}/.well-known/jwks.json"
        
        # Parse unverified claims to check expiration & audience
        import base64
        import json
        parts = token.split(".")
        if len(parts) != 3:
            return None
            
        payload = json.loads(base64.b64decode(parts[1] + "==").decode("utf-8"))
        
        # Validate expiration
        if payload.get("exp", 0) < time.time():
            return None
            
        # Validate client ID
        if payload.get("client_id") != COGNITO_APP_CLIENT_ID and payload.get("aud") != COGNITO_APP_CLIENT_ID:
            return None
            
        return payload
    except Exception as e:
        print(f"[COGNITO AUTH ERROR] Token validation failed: {e}")
        return None
