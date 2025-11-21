#!/usr/bin/env python3
################################################################################
# Family Budget - S3 Backup Utility (boto3)
################################################################################
#
# Description:
#   Python utility for S3 operations using boto3
#   Replaces AWS CLI dependency with pure Python implementation
#
# Usage:
#   ./s3_backup.py upload <file> <s3_key> --bucket <name> --endpoint-url <url>
#   ./s3_backup.py cleanup --retention-days <days> --bucket <name> --endpoint-url <url>
#
# Environment Variables Required:
#   AWS_ACCESS_KEY_ID       S3/Yandex Object Storage access key
#   AWS_SECRET_ACCESS_KEY   S3/Yandex Object Storage secret key
#
# Exit Codes:
#   0 - Success
#   1 - Error (file not found, upload failed, etc.)
#
################################################################################

import argparse
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError
except ImportError:
    print("ERROR: boto3 not installed", file=sys.stderr)
    print("Install with: pip3 install boto3", file=sys.stderr)
    sys.exit(1)


def create_s3_client(endpoint_url):
    """Create S3 client with credentials from environment"""
    access_key = os.environ.get('AWS_ACCESS_KEY_ID')
    secret_key = os.environ.get('AWS_SECRET_ACCESS_KEY')

    if not access_key or not secret_key:
        print("ERROR: AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY not set", file=sys.stderr)
        sys.exit(1)

    return boto3.client(
        's3',
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        # Use us-east-1 as default (Yandex Object Storage compatible)
        region_name='us-east-1'
    )


def upload_file(args):
    """Upload file to S3"""
    file_path = Path(args.file)

    if not file_path.exists():
        print(f"ERROR: File not found: {file_path}", file=sys.stderr)
        return 1

    s3_client = create_s3_client(args.endpoint_url)

    try:
        # Get file size for progress
        file_size = file_path.stat().st_size
        file_size_mb = file_size / 1024 / 1024

        print(f"Uploading {file_path.name} ({file_size_mb:.2f} MB)...")

        # Upload with progress callback
        def progress_callback(bytes_transferred):
            progress = (bytes_transferred / file_size) * 100
            print(f"\rProgress: {progress:.1f}%", end='', flush=True)

        # Upload file
        s3_client.upload_file(
            str(file_path),
            args.bucket,
            args.s3_key,
            Callback=progress_callback if not args.quiet else None
        )

        if not args.quiet:
            print()  # New line after progress

        print(f"SUCCESS: Uploaded to s3://{args.bucket}/{args.s3_key}")
        return 0

    except NoCredentialsError:
        print("ERROR: Invalid AWS credentials", file=sys.stderr)
        return 1
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_msg = e.response['Error']['Message']
        print(f"ERROR: S3 upload failed: {error_code} - {error_msg}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"ERROR: Unexpected error: {e}", file=sys.stderr)
        return 1


def cleanup_old_backups(args):
    """Delete S3 backups older than retention period"""
    s3_client = create_s3_client(args.endpoint_url)

    # Calculate cutoff date
    cutoff_date = datetime.now() - timedelta(days=args.retention_days)

    print(f"Cleaning up backups older than {cutoff_date.date()} ({args.retention_days} days)...")

    try:
        deleted_count = 0
        total_size = 0

        # List all objects in bucket
        paginator = s3_client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=args.bucket)

        for page in pages:
            if 'Contents' not in page:
                continue

            for obj in page['Contents']:
                key = obj['Key']
                last_modified = obj['LastModified']
                size = obj['Size']

                # Only process backup files (backup_YYYYMMDD_*.sql.gz)
                if not key.endswith('.sql.gz') or 'backup_' not in key:
                    continue

                # Check if older than cutoff date
                if last_modified.replace(tzinfo=None) < cutoff_date:
                    if not args.quiet:
                        print(f"Deleting: {key} (modified: {last_modified.date()})")

                    s3_client.delete_object(Bucket=args.bucket, Key=key)
                    deleted_count += 1
                    total_size += size

        total_size_mb = total_size / 1024 / 1024
        print(f"SUCCESS: Deleted {deleted_count} old backup(s) ({total_size_mb:.2f} MB freed)")
        return 0

    except NoCredentialsError:
        print("ERROR: Invalid AWS credentials", file=sys.stderr)
        return 1
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_msg = e.response['Error']['Message']
        print(f"ERROR: S3 cleanup failed: {error_code} - {error_msg}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"ERROR: Unexpected error: {e}", file=sys.stderr)
        return 1


def main():
    parser = argparse.ArgumentParser(
        description='S3 Backup Utility using boto3',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    subparsers.required = True

    # Upload command
    upload_parser = subparsers.add_parser('upload', help='Upload file to S3')
    upload_parser.add_argument('file', help='Local file path to upload')
    upload_parser.add_argument('s3_key', help='S3 key (path in bucket)')
    upload_parser.add_argument('--bucket', required=True, help='S3 bucket name')
    upload_parser.add_argument('--endpoint-url', required=True, help='S3 endpoint URL')
    upload_parser.add_argument('--quiet', action='store_true', help='Suppress progress output')
    upload_parser.set_defaults(func=upload_file)

    # Cleanup command
    cleanup_parser = subparsers.add_parser('cleanup', help='Delete old backups from S3')
    cleanup_parser.add_argument('--retention-days', type=int, required=True,
                                help='Delete backups older than N days')
    cleanup_parser.add_argument('--bucket', required=True, help='S3 bucket name')
    cleanup_parser.add_argument('--endpoint-url', required=True, help='S3 endpoint URL')
    cleanup_parser.add_argument('--quiet', action='store_true', help='Suppress output')
    cleanup_parser.set_defaults(func=cleanup_old_backups)

    args = parser.parse_args()

    # Execute command
    exit_code = args.func(args)
    sys.exit(exit_code)


if __name__ == '__main__':
    main()
