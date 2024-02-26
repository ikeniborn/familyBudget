sudo cat /etc/letsencrypt/live/budget.ikeniborn.ru/fullchain.pem > /home/bagatocorp/cert/budget.ikeniborn.ru.pem
sudo cat /etc/letsencrypt/live/budget.ikeniborn.ru/privkey.pem > /home/bagatocorp/cert/budget.ikeniborn.ru.key

sudo chown root:root /home/bagatocorp/cert/budget.ikeniborn.ru.pem
sudo chown root:root /home/bagatocorp/cert/budget.ikeniborn.ru.key