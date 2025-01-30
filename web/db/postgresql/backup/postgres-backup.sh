#!/bin/bash
BACKUP_POSTGRES_NAME_OLD=postres-$(date -d "2 days ago" +%Y%m%d).gz
BACKUP_POSTGRES_NAME=postres-$(date -u +%Y%m%d).gz
BACKUP_POSTGRES_CATALOG=/home/ikeniborn/app/web/db/postgresql/backup

cd $BACKUP_POSTGRES_CATALOG
if [ -f $BACKUP_POSTGRES_NAME ]; then
  sudo rm $BACKUP_POSTGRES_NAME
fi

sudo docker exec -t postgres pg_dumpall -c -U postres | gzip > $BACKUP_POSTGRES_NAME

if [ -f $BACKUP_POSTGRES_NAME ]; then
  sudo /opt/minio-binaries/mc cp $BACKUP_POSTGRES_NAME yandex/ikeniborn-web-postgresql/
  if [ -f $BACKUP_POSTGRES_NAME_OLD ]; then
    sudo rm $BACKUP_POSTGRES_NAME_OLD

  fi
fi

sudo /opt/minio-binaries/mc rm yandex/ikeniborn-web-postgresql/$BACKUP_POSTGRES_NAME_OLD

cd ~/
