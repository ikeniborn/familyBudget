#!/bin/bash
#
# Generate VAPID keys for Web Push notifications
#
# Usage:
#   ./scripts/generate_vapid_keys.sh              # Generate and display keys
#   ./scripts/generate_vapid_keys.sh --update-env # Generate and update .env file
#
# VAPID keys are generated ONCE per server and shared by all users.
# They must be stored securely in .env file.
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}              VAPID Key Generator for Web Push Notifications${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}[ERROR] Python3 not found. Please install Python 3.${NC}"
    exit 1
fi

# Check if pywebpush is installed
if ! python3 -c "import py_vapid" 2>/dev/null; then
    echo -e "${YELLOW}[INFO] Installing pywebpush...${NC}"
    pip3 install pywebpush --quiet
fi

# Generate VAPID keys using Python
echo -e "${BLUE}[INFO] Generating VAPID key pair...${NC}"

VAPID_OUTPUT=$(python3 << 'PYTHON_SCRIPT'
import json
from py_vapid import Vapid

# Generate new VAPID keys
vapid = Vapid()
vapid.generate_keys()

# Get keys in the correct format
# public_key is in applicationServerKey format (base64url)
# private_key is PEM format but we need raw bytes in base64url
import base64

# Get raw key bytes
private_key_raw = vapid._private_key.private_bytes(
    encoding=__import__('cryptography.hazmat.primitives.serialization', fromlist=['Encoding']).Encoding.Raw,
    format=__import__('cryptography.hazmat.primitives.serialization', fromlist=['PrivateFormat']).PrivateFormat.Raw,
    encryption_algorithm=__import__('cryptography.hazmat.primitives.serialization', fromlist=['NoEncryption']).NoEncryption()
)

public_key_raw = vapid._private_key.public_key().public_bytes(
    encoding=__import__('cryptography.hazmat.primitives.serialization', fromlist=['Encoding']).Encoding.Raw,
    format=__import__('cryptography.hazmat.primitives.serialization', fromlist=['PublicFormat']).PublicFormat.Raw
)

# Encode to base64url (no padding, URL-safe)
def base64url_encode(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')

# Public key needs to be uncompressed point (0x04 prefix + x + y coordinates)
public_key_uncompressed = b'\x04' + public_key_raw
public_key_b64 = base64url_encode(public_key_uncompressed)
private_key_b64 = base64url_encode(private_key_raw)

print(json.dumps({
    "public_key": public_key_b64,
    "private_key": private_key_b64
}))
PYTHON_SCRIPT
)

if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Failed to generate VAPID keys${NC}"
    exit 1
fi

# Parse JSON output
PUBLIC_KEY=$(echo "$VAPID_OUTPUT" | python3 -c "import sys, json; print(json.load(sys.stdin)['public_key'])")
PRIVATE_KEY=$(echo "$VAPID_OUTPUT" | python3 -c "import sys, json; print(json.load(sys.stdin)['private_key'])")

echo ""
echo -e "${GREEN}[SUCCESS] VAPID keys generated successfully!${NC}"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}                           VAPID KEYS${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}VAPID_PUBLIC_KEY=${NC}${PUBLIC_KEY}"
echo ""
echo -e "${BLUE}VAPID_PRIVATE_KEY=${NC}${PRIVATE_KEY}"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Update .env file if requested
if [ "$1" == "--update-env" ]; then
    ENV_FILE="$PROJECT_ROOT/.env"

    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}[ERROR] .env file not found at $ENV_FILE${NC}"
        echo -e "${YELLOW}[INFO] Please copy .env.example to .env first${NC}"
        exit 1
    fi

    echo ""
    echo -e "${BLUE}[INFO] Updating .env file...${NC}"

    # Check if VAPID keys already exist
    if grep -q "^VAPID_PUBLIC_KEY=.\+" "$ENV_FILE"; then
        echo -e "${YELLOW}[WARNING] VAPID keys already exist in .env${NC}"
        read -p "Do you want to overwrite them? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}[INFO] Keeping existing keys${NC}"
            exit 0
        fi
    fi

    # Update or add keys
    if grep -q "^VAPID_PUBLIC_KEY=" "$ENV_FILE"; then
        # Update existing
        sed -i "s|^VAPID_PUBLIC_KEY=.*|VAPID_PUBLIC_KEY=${PUBLIC_KEY}|" "$ENV_FILE"
        sed -i "s|^VAPID_PRIVATE_KEY=.*|VAPID_PRIVATE_KEY=${PRIVATE_KEY}|" "$ENV_FILE"
    else
        # Add new
        echo "" >> "$ENV_FILE"
        echo "# VAPID Keys (auto-generated)" >> "$ENV_FILE"
        echo "VAPID_PUBLIC_KEY=${PUBLIC_KEY}" >> "$ENV_FILE"
        echo "VAPID_PRIVATE_KEY=${PRIVATE_KEY}" >> "$ENV_FILE"
    fi

    echo -e "${GREEN}[SUCCESS] .env file updated with VAPID keys${NC}"
fi

echo ""
echo -e "${BLUE}[INFO] Add these keys to your .env file:${NC}"
echo -e "  VAPID_PUBLIC_KEY=${PUBLIC_KEY}"
echo -e "  VAPID_PRIVATE_KEY=${PRIVATE_KEY}"
echo ""
echo -e "${YELLOW}[IMPORTANT] These keys are generated ONCE per server.${NC}"
echo -e "${YELLOW}            Keep them secure and never expose the private key!${NC}"
echo ""
