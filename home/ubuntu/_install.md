sudo nano /etc/rc.local

sudo chmod +x /etc/rc.local

nano /etc/default/grub
sudo update-grub

systemctl list-units --type=service --state=running