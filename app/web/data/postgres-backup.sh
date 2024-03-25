#!/bin/bash
BACKUP_NAME_OLD=postgres-$(date -d "2 days ago" +%Y%m%d).bak
BACKUP_NAME=postgres-$(date -u +%Y%m%d).tar.gz
CATALOG_LOCAL=~/$BACKUP_NAME 
CATALOG_REMOTE_OLD=c-minio-s1-r1/c-superset-dev/$BACKUP_NAME_OLD

sudo docker exec -t postres pg_dumpall -c -U budget | gzip > ~/postgres-$(date -u +%Y%m%d).sql.gz  2>&1

docker exec -t postres -d budgetdb ~/postgres-20240324.sql.gz
exit_code=$?
if [[ $exit_code != 0 ]]; then
  echo "sudo docker exec -t superset_db pg_dumpall -c -U superset > $CATALOG_LOCAL"
  exit $exit_code
fi

# ~/minio-binaries/mc cp $CATALOG_LOCAL c-minio-s1-r1/c-superset-dev >> /var/log/superset_db-backup.log 2>&1
# exit_code=$?
# if [[ $exit_code != 0 ]]; then
#   echo "mc cp $CATALOG_LOCAL c-minio-s1-r1/c-superset-dev FAILED and return $exit_code exit code"
#   exit $exit_code
# fi

# rm $CATALOG_LOCAL >> /var/log/superset_db-backup.log 2>&1
# exit_code=$?
# if [[ $exit_code != 0 ]]; then
#   echo "rm $BACKUP_NAME FAILED and return $exit_code exit code"
# fi

# ~/minio-binaries/mc rm $CATALOG_REMOTE_OLD >> /var/log/superset_db-backup.log 2>&1
# exit_code=$?
# if [[ $exit_code != 0 ]]; then
#   echo "mc rm $CATALOG_REMOTE_OLD FAILED and return $exit_code exit code"
# fi

