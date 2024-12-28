sudo apt update && sudo apt -y full-upgrade
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common git

sudo apt install -y docker.io python3-pip docker-compose

sudo systemctl enable docker

sudo systemctl stop docker.socket && \
sudo systemctl stop docker && \
sudo systemctl start docker && \
sudo systemctl status docker
