import os
from google.cloud import storage

def  init():
  try:
      client = storage.Client.from_service_account_json(json_credentials_path=os.getenv('GOOGLE_STORAGE_CREDENTIAL_PATH'))
      bucket = storage.Bucket(client, 'budget-ikeniborn-ru')
      blob = bucket.blob('budget.db')
      blob.download_to_filename(os.getenv('DATABASE_PATH'))
  except Exception as e:
      print(e)
    
if __name__ == '__main__':
  init()