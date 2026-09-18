"""s3_handler.py - AWS S3 storage adapter for PDR.
Handles uploading bank statements, credit decision letters, and generated PDF reports
to Amazon S3 with secure pre-signed download URLs.
Falls back gracefully to local filesystem if S3 is not configured.
"""
import os
import pathlib
from typing import Optional

S3_BUCKET = os.getenv("S3_BUCKET_NAME", "")
AWS_REGION = os.getenv("AWS_REGION", os.getenv("AWS_DEFAULT_REGION", "us-east-1"))
LOCAL_UPLOAD_DIR = pathlib.Path(__file__).parent / "uploads"


def _get_s3_client():
    try:
        import boto3
        if S3_BUCKET:
            return boto3.client("s3", region_name=AWS_REGION)
    except Exception as e:
        print(f"[S3 NOTICE] Boto3 client unavailable ({e})")
    return None


def upload_statement_file(file_bytes: bytes, filename: str, applicant_id: str) -> dict:
    """Uploads a bank statement to S3 or stores locally."""
    s3_key = f"statements/{applicant_id}/{filename}"
    s3 = _get_s3_client()

    if s3 and S3_BUCKET:
        try:
            s3.put_object(
                Bucket=S3_BUCKET,
                Key=s3_key,
                Body=file_bytes,
                ContentType="application/octet-stream",
            )
            # Generate pre-signed URL valid for 24 hours
            url = s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": S3_BUCKET, "Key": s3_key},
                ExpiresIn=86400,
            )
            return {"storage": "s3", "key": s3_key, "url": url}
        except Exception as e:
            print(f"[S3 ERROR] Failed to upload to S3: {e}")

    # Local fallback
    LOCAL_UPLOAD_DIR.mkdir(exist_ok=True)
    target_path = LOCAL_UPLOAD_DIR / f"{applicant_id}_{filename}"
    with open(target_path, "wb") as f:
        f.write(file_bytes)

    return {"storage": "local", "path": str(target_path), "url": f"/files/{applicant_id}_{filename}"}


def upload_report_pdf(pdf_path: str, applicant_id: str) -> Optional[str]:
    """Uploads generated decision PDF to S3."""
    if not os.path.exists(pdf_path):
        return None

    s3 = _get_s3_client()
    if s3 and S3_BUCKET:
        try:
            s3_key = f"reports/{applicant_id}/{os.path.basename(pdf_path)}"
            with open(pdf_path, "rb") as f:
                s3.put_object(
                    Bucket=S3_BUCKET,
                    Key=s3_key,
                    Body=f,
                    ContentType="application/pdf",
                )
            return s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": S3_BUCKET, "Key": s3_key},
                ExpiresIn=86400,
            )
        except Exception as e:
            print(f"[S3 ERROR] Failed report upload: {e}")

    return f"file://{os.path.abspath(pdf_path)}"
