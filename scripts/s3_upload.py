#!/usr/bin/env python3
"""
S3 Upload Helper Script

Uploads files to S3-compatible storage using boto3.
Uses environment variables from .env file for credentials.

Usage:
    python3 scripts/s3_upload.py FILE_PATH [S3_PREFIX]

Arguments:
    FILE_PATH   - Path to file to upload
    S3_PREFIX   - Optional prefix in S3 bucket (default: "")

Environment Variables (from .env):
    S3_ENDPOINT_URL     - S3 endpoint (empty for AWS S3)
    S3_ACCESS_KEY_ID    - Access key
    S3_SECRET_ACCESS_KEY - Secret key
    S3_BUCKET_NAME      - Bucket name
    S3_REGION           - Region (default: us-east-1)

Examples:
    # Upload to bucket root
    python3 scripts/s3_upload.py /opt/notes/backups/couchdb-20251115.tar.gz

    # Upload to specific prefix
    python3 scripts/s3_upload.py backup.tar.gz couchdb-backups/

Exit codes:
    0 - Success
    1 - Missing required argument
    2 - File not found
    3 - Missing environment variables
    4 - Upload failed
"""

import os
import sys
from pathlib import Path
from datetime import datetime

try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError
except ImportError:
    print("ERROR: boto3 is not installed", file=sys.stderr)
    print("Install: pip3 install boto3", file=sys.stderr)
    sys.exit(5)


def load_env_file(env_path="/opt/budget/.env"):
    """Load environment variables from .env file"""
    env_vars = {}

    if not os.path.exists(env_path):
        print(f"WARNING: .env file not found: {env_path}", file=sys.stderr)
        return env_vars

    try:
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                # Skip comments and empty lines
                if not line or line.startswith('#'):
                    continue
                # Parse KEY=VALUE
                if '=' in line:
                    key, value = line.split('=', 1)
                    # Remove quotes if present
                    value = value.strip().strip('"').strip("'")
                    env_vars[key.strip()] = value
    except Exception as e:
        print(f"WARNING: Failed to parse .env file: {e}", file=sys.stderr)

    return env_vars


def get_s3_config():
    """Get S3 configuration from environment variables"""
    # Load .env file first
    env_vars = load_env_file()

    # Get config (prefer OS env vars, fallback to .env file)
    config = {
        'endpoint_url': os.getenv('S3_ENDPOINT_URL') or env_vars.get('S3_ENDPOINT_URL', ''),
        'access_key': os.getenv('S3_ACCESS_KEY_ID') or env_vars.get('S3_ACCESS_KEY_ID', ''),
        'secret_key': os.getenv('S3_SECRET_ACCESS_KEY') or env_vars.get('S3_SECRET_ACCESS_KEY', ''),
        'bucket': os.getenv('S3_BUCKET_NAME') or env_vars.get('S3_BUCKET_NAME', ''),
        'region': os.getenv('S3_REGION') or env_vars.get('S3_REGION', 'us-east-1'),
    }

    # Validate required variables
    missing = []
    if not config['access_key']:
        missing.append('S3_ACCESS_KEY_ID')
    if not config['secret_key']:
        missing.append('S3_SECRET_ACCESS_KEY')
    if not config['bucket']:
        missing.append('S3_BUCKET_NAME')

    if missing:
        print("ERROR: Missing required environment variables:", file=sys.stderr)
        for var in missing:
            print(f"  - {var}", file=sys.stderr)
        print("\nSet these variables in /opt/budget/.env or as environment variables", file=sys.stderr)
        sys.exit(3)

    return config


def format_size(size_bytes):
    """Format size in bytes to human-readable format"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"


def upload_to_s3(file_path, s3_prefix=""):
    """Upload file to S3 with progress indication"""

    # Validate file exists
    file_path = Path(file_path)
    if not file_path.exists():
        print(f"ERROR: File not found: {file_path}", file=sys.stderr)
        sys.exit(2)

    # Get S3 configuration
    config = get_s3_config()

    # Prepare S3 key
    s3_key = f"{s3_prefix}{file_path.name}" if s3_prefix else file_path.name

    # Get file size
    file_size = file_path.stat().st_size

    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting S3 upload")
    print(f"  File: {file_path}")
    print(f"  Size: {format_size(file_size)}")
    print(f"  Bucket: {config['bucket']}")
    print(f"  Key: {s3_key}")
    if config['endpoint_url']:
        print(f"  Endpoint: {config['endpoint_url']}")
    print("")

    try:
        # Create S3 client
        s3_client_args = {
            'aws_access_key_id': config['access_key'],
            'aws_secret_access_key': config['secret_key'],
            'region_name': config['region']
        }

        if config['endpoint_url']:
            s3_client_args['endpoint_url'] = config['endpoint_url']

        s3 = boto3.client('s3', **s3_client_args)

        # Upload with progress callback
        uploaded_bytes = [0]  # Mutable for callback

        def progress_callback(bytes_amount):
            uploaded_bytes[0] += bytes_amount
            percent = (uploaded_bytes[0] / file_size) * 100
            # Simple progress indicator (every 10%)
            if percent % 10 < (bytes_amount / file_size * 100):
                print(f"  Progress: {percent:.1f}% ({format_size(uploaded_bytes[0])} / {format_size(file_size)})")

        # Upload file
        start_time = datetime.now()
        s3.upload_file(
            str(file_path),
            config['bucket'],
            s3_key,
            Callback=progress_callback
        )

        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        print("")
        print(f"✅ Upload completed successfully")
        print(f"  Duration: {duration:.1f} seconds")
        print(f"  Speed: {format_size(file_size / duration)}/s")
        print(f"  S3 URI: s3://{config['bucket']}/{s3_key}")

        return 0

    except NoCredentialsError:
        print("ERROR: Invalid AWS credentials", file=sys.stderr)
        return 4
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
        error_msg = e.response.get('Error', {}).get('Message', str(e))
        print(f"ERROR: S3 upload failed ({error_code}): {error_msg}", file=sys.stderr)
        return 4
    except Exception as e:
        print(f"ERROR: Upload failed: {e}", file=sys.stderr)
        return 4


def main():
    """Main function"""
    # Parse arguments
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/s3_upload.py FILE_PATH [S3_PREFIX]", file=sys.stderr)
        print("", file=sys.stderr)
        print("Examples:", file=sys.stderr)
        print("  python3 scripts/s3_upload.py backup.tar.gz", file=sys.stderr)
        print("  python3 scripts/s3_upload.py backup.tar.gz couchdb-backups/", file=sys.stderr)
        sys.exit(1)

    file_path = sys.argv[1]
    s3_prefix = sys.argv[2] if len(sys.argv) > 2 else ""

    # Upload to S3
    exit_code = upload_to_s3(file_path, s3_prefix)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
