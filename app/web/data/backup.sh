
#!/bin/bash

export GOOGLE_STORAGE_CREDENTIAL_PATH=/home/bagatocorp/web/app/secrets/bagato-403919-f547cd93bfb2.json
export DATABASE_PATH=/home/bagatocorp/web/data/budget.db
python '/home/bagatocorp/web/data/db_upload.py'
