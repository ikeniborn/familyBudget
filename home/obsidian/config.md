sudo su

mkdir -p /opt/obsidian && \
touch /opt/obsidian/backup_obsidian.sh && \
chmod +x /opt/obsidian/backup_obsidian.sh && \
touch /var/log/obsidian-backup.log

nano /opt/obsidian/backup_obsidian.sh

crontab -e 

0 0 * * * . /opt/obsidian/backup_obsidian.sh >> /var/log/obsidian-backup.log 2>&1

sudo tail -100 /var/log/obsidian-backup.log