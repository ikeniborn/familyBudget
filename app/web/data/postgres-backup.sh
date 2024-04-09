#!/bin/bash
BACKUP_NAME_OLD=postgres-$(date -d "2 days ago" +%Y%m%d).gz
BACKUP_NAME=postgres-$(date -u +%Y%m%d).gz

cd $HOME/web/data/backup/
if [[ -f $BACKUP_NAME ]]; then
sudo rm $BACKUP_NAME 
fi
sudo docker exec -t postgres pg_dumpall -c -U budget | gzip > $BACKUP_NAME
if [[ -f $BACKUP_NAME ]]; then
  if [[ -f $BACKUP_NAME_OLD ]]; then
  sudo rm $BACKUP_NAME_OLD 
  fi
fi