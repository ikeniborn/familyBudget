
sudo cat /etc/letsencrypt/live/budget.ikeniborn.ru/fullchain.pem > /home/bagatocorp/cert/budget.ikeniborn.ru.pem
sudo cat /etc/letsencrypt/live/budget.ikeniborn.ru/privkey.pem > /home/bagatocorp/cert/budget.ikeniborn.ru.key

mkdir /home/bagatocorp/cert

nano /home/bagatocorp/cert/budget.ikeniborn.ru.pem
nano /home/bagatocorp/cert/budget.ikeniborn.ru.key


sudo chown root:root /home/bagatocorp/cert/budget.ikeniborn.ru.pem
sudo chown root:root /home/bagatocorp/cert/budget.ikeniborn.ru.key

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