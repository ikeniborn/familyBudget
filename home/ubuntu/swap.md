# отключение свапа
==проверка наличия свава==
```bash
swapon --show
```

==отклбчение свапа== 
```bash
swapoff -v /dev/dm-0
```

==удаление монтирования== 
```bash
nano /etc/fstab
```
==delete row== 
> ```bash
/dev/pve/swap none swap sw 0 0
```

==удалите файл== 
```bash
rm /dev/pve/swap
```
# создание свапа
```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
sudo swapon --show
sudo nano /etc/fstab
```
> /swapfile none swap sw 0 0
```bash
sudo nano /etc/sysctl.conf
```
==Swappiness. Определяет, как часто система будет использовать swap пространство.== 
> vm.swappiness=10
==Vfs_cache_pressure. Этот параметр контролирует, как часто ядро будет освобождать память, которая используется для кэширования директорий и узлов. Чтобы настроить, нужно ввести команду== 
Параметры vm.vfs_cache_pressure:

0 — не кэшировать ничего.
100 — значение по-умолчанию.
\>100 — агрессивно кэшировать дисковые операции.

Знатоки рекомендуют устанавливать значение 1000 и больше для обычных винчестеров и около 50 для SSD дисков

> vm.vfs_cache_pressure=50
== Применить параметры
```bash
sudo sysctl -p
```

== Очистка свапа 
```bash
swapoff -a
swapon -a
```
