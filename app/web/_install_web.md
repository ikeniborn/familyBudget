
sudo cat /etc/letsencrypt/live/budget.ikeniborn.ru/fullchain.pem > /home/bagatocorp/web/cert/budget.ikeniborn.ru.pem
sudo cat /etc/letsencrypt/live/budget.ikeniborn.ru/privkey.pem > /home/bagatocorp/web/cert/budget.ikeniborn.ru.key

mkdir /home/bagatocorp/cert

nano /home/bagatocorp/cert/budget.ikeniborn.ru.pem
nano /home/bagatocorp/cert/budget.ikeniborn.ru.key

sudo chown root:root /home/bagatocorp/web/cert/budget.ikeniborn.ru.pem
sudo chown root:root /home/bagatocorp/web/cert/budget.ikeniborn.ru.key

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

sudo apt-get -y install certbot

sudo certbot certonly --manual --preferred-challenges dns

# build Docker image in current directory

sudo docker compose -f ~/Documents/Git/familyBudget/app/web/docker-compose-dev.yaml up --build -d
sudo docker compose -f ~/Documents/Git/familyBudget/app/web/docker-compose-dev.yaml down --rmi all

sudo docker compose -f ~/web/app/docker-compose.yaml up --build -d
sudo docker compose -f ~/web/app/docker-compose.yaml down --rmi all

>> перезагрузка докера
sudo service docker stop
sudo service docker status
sudo service docker restart
sudo service docker status

>> очистка не используемых контейнеров и образов
sudo docker images ls
sudo docker volume ls
sudo docker system prune -a 

sudo docker ps
sudo docker restart api
sudo docker restart ui
sudo docker restart postgres

. sync_app.sh

ss -ntlp | more

sudo telnet localhost 443 
sudo telnet localhost 80
sudo telnet localhost 5432 
sudo telnet localhost 5050 

sudo docker exec -ti api bash
sudo docker exec -ti ui bash
sudo docker exec -ti postgres bash


<!-- sudo docker exec app-streamlit-1 python /usr/src/data/db_upload.py -->

curl --cacert /usr/src/app/cert/budget.ikeniborn.ru.pem --fail https://budget.ikeniborn.ru/_stcore/health

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
nano /home/bagatocorp/web/data/postgres-backup.sh
mkdir /home/bagatocorp/web/data/backup
touch /home/bagatocorp/web/data/backup/postgres-backup.log
sudo chmod +x /home/bagatocorp/web/data/postgres-backup.sh

tail -100 /home/bagatocorp/web/data/backup/postgres-backup.log

sudo crontab -u bagatocorp -e

0 * * * * . /home/bagatocorp/web/data/postgres-backup.sh

<!-- streamlit run app.py --server.port=4443 --server.sslCertFile=cert/budget.ikeniborn.ru.pem --server.sslKeyFile=cert/budget.ikeniborn.ru.key -->

