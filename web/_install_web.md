
sudo su 
apt install python3-pip python3-devel gcc gcc-c++ make jq

# Add Docker's official GPG key:
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Generate cert
sudo mkdir /etc/haproxy && \
sudo mkdir /etc/haproxy/certs

. /sync_web.sh

sudo crontab -e
0 0 1 * * /bin/sh /app/web/service/haproxy/renewLetsEncryptCertificates.sh

sudo apt-get -y install certbot

sudo certbot certonly --manual --preferred-challenges dns

sudo certbot certonly --standalone --debug-challenges -v --preferred-challenges http  --non-interactive --agree-tos --email ikeniborn@gmail.com --http-01-address 127.0.0.1 --http-01-port=8899 -d haproxy.ikeniborn.ru --post-hook "/app/web/service/haproxy/prepareLetsEncryptCertificates.sh && docker restart haproxy" --dry-run

sudo certbot certonly --standalone --debug-challenges -v --preferred-challenges http  --non-interactive --agree-tos --email ikeniborn@gmail.com --http-01-address 127.0.0.1 --http-01-port=8899 -d budget.ikeniborn.ru --post-hook "/app/web/service/haproxy/prepareLetsEncryptCertificates.sh && docker restart haproxy"

sudo certbot certonly --standalone --debug-challenges -v --preferred-challenges http  --non-interactive --agree-tos --email ikeniborn@gmail.com --http-01-address 127.0.0.1 --http-01-port=8899 -d haproxy.ikeniborn.ru --post-hook "/app/web/service/haproxy/prepareLetsEncryptCertificates.sh && docker restart haproxy"

# build Docker image in current directory
sudo mkdir /app

sudo docker compose -f ~/Documents/Git/familyBudget/web/docker-compose-dev.yaml up --build -d
sudo docker compose -f ~/Documents/Git/familyBudget/web/docker-compose-dev.yaml down --rmi all

sudo docker compose -f ~/Documents/Git/familyBudget/web/docker-compose-dev.yaml up -d
sudo docker compose -f ~/Documents/Git/familyBudget/web/docker-compose-dev.yaml down

sudo docker compose -f /app/web/docker-compose.yaml up --build -d
sudo docker compose -f /app/web/docker-compose.yaml down --rmi all

sudo docker compose -f /app/web/docker-compose.yaml up -d
sudo docker compose -f /app/web/docker-compose.yaml down



>> перезагрузка докера
sudo service docker stop
sudo systemctl stop docker.socket
sudo service docker status
sudo service docker restart

>> очистка не используемых контейнеров и образов
sudo docker image ls
sudo docker volume ls
sudo docker system prune -a 

sudo docker ps
sudo docker restart api
sudo docker restart budget-ui
sudo docker restart postgres
sudo docker restart haproxy

sudo docker logs -f api

ss -ntlp | more

sudo telnet localhost 443 
sudo telnet localhost 80
sudo telnet localhost 5432 
sudo telnet localhost 5050 

sudo docker exec -ti api bash
sudo docker exec -ti ui bash
sudo docker exec -ti postgres bash


<!-- sudo docker exec app-streamlit-1 python /usr/src/data/db_upload.py -->

<!-- curl --cacert /usr/src/app/cert/budget.ikeniborn.ru.pem --fail https://budget.ikeniborn.ru/_stcore/health -->

<!-- export GOOGLE_SPREADSHEET_ID=12zOV6GkjmT2eUAQalQCTDP1OXOBCfLOhcBQaXQ4gbUQ && \ -->
<!-- export GOOGLE_CREDENTIAL_PATH=/home/ikeni/Documents/Git/familyBudget/app/web/app/secrets/familybudget-317019-797cf157b1ff.json && \ -->
<!-- export GOOGLE_STORAGE_CREDENTIAL_PATH=/home/ikeni/Documents/Git/familyBudget/app/web/app/secrets/bagato-403919-f547cd93bfb2.json && \
export DATABASE_PATH=/home/ikeni/Documents/Git/familyBudget/app/web/data/budget.db && \
export BUDGET_POSTGRES_HOST=10.5.0.3 && \
export BUDGET_POSTGRES_PORT=5432 && \
export BUDGET_POSTGRES_DB=budgetdb && \
export BUDGET_POSTGRES_USER=budget && \
export BUDGET_POSTGRES_PASSWORD=4phDukPGF7sUWSEvfycX && \
printenv | grep 'GOOGLE'
printenv | grep 'BUDGET'
printenv | grep 'DATABASE' -->



# BACKUP
mkdir -p /app/database/postgresql/backup 
touch /app/database/postgresql/postgres-backup.log
<!-- sudo chmod +x /home/bagatocorp/web/data/postgres-backup.sh -->

<!-- tail -100 /home/bagatocorp/web/data/backup/postgres-backup.log -->

sudo crontab -e

0 * * * * . /app/web/service/postgresql/backup/postgres-backup.sh

<!-- streamlit run app.py --server.port=4443 --server.sslCertFile=cert/budget.ikeniborn.ru.pem --server.sslKeyFile=cert/budget.ikeniborn.ru.key -->

