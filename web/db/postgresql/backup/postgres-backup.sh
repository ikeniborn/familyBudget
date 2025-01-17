#!/bin/bash
BACKUP_NAME_OLD=postres-$(date -d "2 days ago" +%Y%m%d).gz
BACKUP_NAME=postres-$(date -u +%Y%m%d).gz

cd $HOME/app/web/db/postgresql/backup
if [[ -f $BACKUP_NAME ]]; then
sudo rm $BACKUP_NAME 
fi
sudo docker exec -t postgres pg_dumpall -c -U postres | gzip > $BACKUP_NAME

if [[ -f $BACKUP_NAME ]]; then
  /root/minio-binaries/mc cp $BACKUP_NAME yandex/ikeniborn-web-postgresql
  if [[ -f $BACKUP_NAME_OLD ]]; then
  sudo rm $BACKUP_NAME_OLD 
  /root/minio-binaries/mc rm yandex/ikeniborn-web-postgresql/$BACKUP_NAME_OLD
  fi
fi

cd ~/