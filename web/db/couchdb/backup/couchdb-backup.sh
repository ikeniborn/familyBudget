#!/bin/bash
BACKUP_COUCHDB_NAME_OLD=couchdb-$(date -d "2 days ago" +%Y%m%d).tar
BACKUP_COUCHDB_NAME=couchdb-$(date -u +%Y%m%d).tar
BACKUP_COUCHDB_CATALOG=/home/ikeniborn/app/web/db/couchdb/backup

cd $BACKUP_COUCHDB_CATALOG
if [[ -f $BACKUP_COUCHDB_NAME ]]; then
sudo rm $BACKUP_COUCHDB_NAME 
fi
sudo docker run --rm --volume web_couchdb-data:/data --volume $BACKUP_COUCHDB_CATALOG:/backup couchdb tar cvf /backup/$BACKUP_COUCHDB_NAME data

if [[ -f $BACKUP_NAME ]]; then
  sudo /opt/minio-binaries/mc cp $BACKUP_COUCHDB_NAME yandex/ikeniborn-obsidian-couchdb/
  if [[ -f $BACKUP_COUCHDB_NAME_OLD ]]; then
  sudo rm $BACKUP_COUCHDB_NAME_OLD 
  sudo /opt/minio-binaries/mc rm yandex/ikeniborn-obsidian-couchdb/$BACKUP_COUCHDB_NAME_OLD
  fi
fi

cd ~/