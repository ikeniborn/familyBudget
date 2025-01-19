ssh-keygen -t rsa -b 4096

sudo nano /etc/ssh/sshd_config
> PermitRootLogin no
> PasswordAuthentication no
> Port 55522
> PubkeyAuthentication yes
> AuthorizedKeysFile      .ssh/authorized_keys   

sudo nano /home/ikeniborn/.ssh/authorized_keys
sudo chmod 0600 /home/ikeniborn/.ssh/authorized_keys

sudo systemctl restart sshd