sudo adduser ikeniborn

sudo usermod -aG sudo ikeniborn

sudo visudo

Defaults timestamp_timeout=5

<!-- Use Fail2ban to Block Brute Force Attacks -->
sudo apt install fail2ban

nano /etc/fail2ban/jail.local
sudo fail2ban-client start
sudo fail2ban-client status


<!-- Set Up Log Monitoring -->
sudo apt install logwatch
sudo logwatch --detail high --mailto ikeniborn@gmail.com --service sshd --range today

<!-- Disable Unnecessary Services -->
systemctl list-units --type=service --state=running

sudo systemctl stop service_name
sudo systemctl disable service_name