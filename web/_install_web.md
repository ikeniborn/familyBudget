
# install docker

###
# install minio client for root
###

sudo su
sudo curl https://dl.min.io/client/mc/release/linux-amd64/mc --create-dirs -o /opt/minio-binaries/mc
sudo chown -R root:root /opt/minio-binaries && \
sudo chmod +x /opt/minio-binaries/mc && \
sudo touch /etc/profile.d/mc.sh && \
export PATH=$PATH:/opt/minio-binaries/ && \
sudo tee /etc/profile.d/mc.sh <<EOF
export PATH=$PATH:/opt/minio-binaries/
EOF

mc --help

mc alias set yandex https://storage.yandexcloud.net YCAJEMDZzBncSAWDzx6KCPPVr YCPHePC8iLOVy0VCoCvSmrdwc-UPyg7mdzPWz_kA

# Generate cert
sudo mkdir /etc/haproxy && \
sudo mkdir /etc/haproxy/certs

nano /home/ikeniborn/sync_web.sh
chown ikeniborn:ikeniborn sync_web.sh
chmod +x sync_web.sh
. /home/ikeniborn/sync_web.sh


sudo apt-get -y install certbot

sudo certbot certonly --manual --preferred-challenges dns

sudo certbot certonly --standalone --debug-challenges -v --preferred-challenges http  --non-interactive --agree-tos --email ikeniborn@gmail.com --http-01-address 127.0.0.1 --http-01-port=8899 -d budget.ikeniborn.ru --dry-run

sudo certbot certonly --standalone --debug-challenges -v --preferred-challenges http  --non-interactive --agree-tos --email ikeniborn@gmail.com --http-01-address 127.0.0.1 --http-01-port=8899 -d budget.ikeniborn.ru --pre-hook "ufw allow http" --post-hook "$HOME/app/web/service/haproxy/prepareLetsEncryptCertificates.sh && docker restart haproxy && ufw deny http"

sudo certbot certonly --standalone --debug-challenges -v --preferred-challenges http  --non-interactive --agree-tos --email ikeniborn@gmail.com --http-01-address 127.0.0.1 --http-01-port=8899 -d haproxy.ikeniborn.ru --pre-hook "ufw allow http" --post-hook "$HOME/app/web/service/haproxy/prepareLetsEncryptCertificates.sh && docker restart haproxy && ufw deny http"

sudo certbot certonly --standalone --debug-challenges -v --preferred-challenges http  --non-interactive --agree-tos --email ikeniborn@gmail.com --http-01-address 127.0.0.1 --http-01-port=8899 -d crm.ikeniborn.ru --pre-hook "ufw allow http" --post-hook "$HOME/app/web/service/haproxy/prepareLetsEncryptCertificates.sh && docker restart haproxy && ufw deny http"

sudo certbot certonly --standalone --debug-challenges -v --preferred-challenges http  --non-interactive --agree-tos --email ikeniborn@gmail.com --http-01-address 127.0.0.1 --http-01-port=8899 -d notes.ikeniborn.ru --pre-hook "ufw allow http" --post-hook "$HOME/app/web/service/haproxy/prepareLetsEncryptCertificates.sh && docker restart haproxy && ufw deny http"

# build Docker image in current directory

/usr/bin/python3 -m venv venv
Запуск среды
source venv/bin/activate
выход 
deactivate

sudo docker-compose --env-file /home/ikeni/Documents/Git/familyBudget/web/web_dev.env -f /home/ikeni/Documents/Git/familyBudget/web/docker-compose-dev.yaml up --build -d
sudo docker-compose --env-file /home/ikeni/Documents/Git/familyBudget/web/web_dev.env -f /home/ikeni/Documents/Git/familyBudget/web/docker-compose-dev.yaml down --rmi all

sudo docker-compose --env-file /home/ikeni/Documents/Git/familyBudget/web/web_dev.env -f /home/ikeni/Documents/Git/familyBudget/web/docker-compose-dev.yaml up -d
sudo docker-compose --env-file /home/ikeni/Documents/Git/familyBudget/web/web_dev.env -f /home/ikeni/Documents/Git/familyBudget/web/docker-compose-dev.yaml down
sudo docker-compose --env-file /home/ikeni/Documents/Git/familyBudget/web/web_dev.env -f /home/ikeni/Documents/Git/familyBudget/web/docker-compose-dev.yaml restart budget-ui

sudo docker-compose --env-file /home/ikeniborn/app/web/web.env -f /home/ikeniborn/app/web/docker-compose.yaml up --build -d
sudo docker-compose --env-file /home/ikeniborn/app/web/web.env -f /home/ikenibornapp/web/docker-compose.yaml down --rmi all

sudo docker-compose --env-file /home/ikeniborn/app/web/web.env -f /home/ikeniborn/app/web/docker-compose.yaml up -d
sudo docker-compose --env-file /home/ikeniborn/app/web/web.env -f /home/ikeniborn/app/web/docker-compose.yaml down
sudo docker-compose --env-file /home/ikeniborn/app/web/web.env -f /home/ikeniborn/app/web/docker-compose.yaml restart budget-api budget-ui



>> перезагрузка докера
sudo systemctl stop docker.socket && \
sudo service docker stop && \
sudo service docker status && \
sudo service docker restart

sudo systemctl enable docker.service

>> очистка не используемых контейнеров и образов
sudo docker image ls
sudo docker volume ls
sudo docker system prune -a 

sudo docker ps
sudo docker restart budget-ui
sudo docker restart postgres
sudo docker restart haproxy

sudo docker logs -f budget-ui
sudo docker logs -f budget-api
sudo docker logs -f postgres

ss -ntlp | more

sudo telnet localhost 443 
sudo telnet localhost 80
sudo telnet localhost 5432 
sudo telnet localhost 5050 

sudo docker exec -ti api bash
sudo docker exec -ti ui bash
sudo docker exec -ti postgres bash



# BACKUP
sudo apt-get install postfix

sudo mkdir -p ~/app/database/postgresql/backup 
sudo touch ~/app/database/postgresql/postgres-backup.log
sudo touch /var/log/postgres-backup.log && \
sudo touch /var/log/couchdb-backup.log && \
sudo touch /var/log/certbot.log

sudo touch /etc/rsyslog.d/cron.log

sudo nano /etc/rsyslog.d/50-default.conf
> uncomment #cron
sudo service rsyslog restart

sudo crontab -e

0 0 1 * * . /home/ikeniborn/app/web/service/haproxy/renewLetsEncryptCertificates.sh >> /var/log/certbot.log 2>&1
0 0 * * * . /home/ikeniborn/app/web/db/postgresql/backup/postgres-backup.sh >> /var/log/postgres-backup.log 2>&1
0 1 * * * . /home/ikeniborn/app/web/db/couchdb/backup/couchdb-backup.sh >> /var/log/couchdb-backup.log 2>&1

sudo tail -100 /var/log/cron.log | grep backup
sudo tail -100 /var/mail/root

sudo tail -100 /var/log/certbot.log
sudo tail -f /var/log/postgres-backup.log
sudo tail -100 /var/log/couchdb-backup.log




