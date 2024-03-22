#!/bin/bash

folder="/home/bagatocorp/web/data"

export GOOGLE_STORAGE_CREDENTIAL_PATH=/home/bagatocorp/web/app/secrets/bagato-403919-f547cd93bfb2.json
export DATABASE_PATH=/home/bagatocorp/web/data/budget.db

sudo python3 $git_folder/db_upload.py