ssh-keygen -t rsa -b 4096

sudo nano /etc/ssh/sshd_config
> PermitRootLogin no
> PasswordAuthentication no

sudo systemctl restart sshd

> Port 2222

sudo systemctl restart sshd