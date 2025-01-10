https://selectel.ru/blog/tutorials/how-to-configure-firewall-with-ufw-on-ubuntu-20/

sudo apt-get install ufw
sudo ufw status verbose

sudo ufw default deny incoming

sudo ufw default allow outgoing

sudo ufw allow 443/tcp

sudo ufw allow 5984/tcp

sudo ufw allow from 78.107.114.37



sudo ufw enable

sudo ufw status numbered

# icmp blocks
sudo cp /etc/ufw/before.rules /etc/ufw/before.rules_backup

nano /etc/ufw/before.rules
# ok icmp codes for INPUT change to DROP

sudo ufw reload

<!-- sudo ufw allow ssh -->

<!-- sudo ufw allow from 123.45.67.89 to any port 22 -->

