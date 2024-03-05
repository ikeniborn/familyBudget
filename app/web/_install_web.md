
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

# build Docker image in current directory
sudo docker build -t 'chat-ai-latest' /home/rocky/chat-ai
<!-- # Run docker image with port 8501 and volumes -->
sudo docker run -it --rm -p '8501:8501' -v '/home/rocky/models:/usr/src/app/models' -v '/home/rocky/chat-ai/project:/usr/src/app/project' latest

sudo docker run -it -p 8501:8501/tcp --expose 8080/tcp  --restart always -v '/home/rocky/models:/usr/src/app/models' -v '/home/rocky/chat-ai/project:/usr/src/app/project' chat-ai-latest

sudo docker compose -f /home/bagatocorp/web/docker-compose.yaml up -d

sudo docker compose -f /home/bagatocorp/web/docker-compose.yaml up --build -d

sudo docker compose -f /home/bagatocorp/web/docker-compose.yaml down --rmi all

>> очистка не используемых коонтейнеров и образов
sudo docker system prune -a 

sudo docker ps

. sync_app.sh

ss -ntlp | more

sudo telnet budget.ikeniborn.ru 443 

sudo docker exec -ti web-streamlit-1 ping -c 4 5.161.50.136 4001

export GOOGLE_SPREADSHEET_ID=12zOV6GkjmT2eUAQalQCTDP1OXOBCfLOhcBQaXQ4gbUQ && \
export GOOGLE_CREDENTIAL_PATH=/home/ikeni/Documents/Git/familyBudget/app/web/app/secrets/familybudget-317019-797cf157b1ff.json && \
printenv | grep 'GOOGLE'