FROM postgres:15-alpine

# Install cron and bash
RUN apk add --no-cache bash dcron libcap

# Create backup directory
RUN mkdir -p /backups /scripts /var/log

# Copy backup scripts
COPY postgresql/backup/backup.sh /scripts/backup-postgres.sh
COPY postgresql/backup/restore.sh /scripts/restore-postgres.sh
COPY couchdb/backup/backup.sh /scripts/backup-couchdb.sh
COPY entrypoint.sh /scripts/entrypoint.sh

# Make scripts executable
RUN chmod +x /scripts/*.sh

# Create cron job file
RUN echo "# PostgreSQL backup every day at 2 AM" > /etc/crontabs/root && \
    echo "0 2 * * * /scripts/backup-postgres.sh >> /var/log/backup.log 2>&1" >> /etc/crontabs/root && \
    echo "# CouchDB backup every day at 3 AM" >> /etc/crontabs/root && \
    echo "0 3 * * * /scripts/backup-couchdb.sh >> /var/log/backup.log 2>&1" >> /etc/crontabs/root

# Set up log rotation
RUN echo "/var/log/backup.log {" > /etc/logrotate.d/backup && \
    echo "    daily" >> /etc/logrotate.d/backup && \
    echo "    rotate 7" >> /etc/logrotate.d/backup && \
    echo "    compress" >> /etc/logrotate.d/backup && \
    echo "    missingok" >> /etc/logrotate.d/backup && \
    echo "    notifempty" >> /etc/logrotate.d/backup && \
    echo "}" >> /etc/logrotate.d/backup

VOLUME ["/backups"]

ENTRYPOINT ["/scripts/entrypoint.sh"]