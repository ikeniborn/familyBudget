Для Linux существует замечательный легкий BitTorrent-клиент, который называется transmission-daemon. Работает он совершенно безотказно, но вот произвести его первоначальную настройку для многих новичков является нетривиальной задачей. Самое интересное, что некоторые моменты в настройках меняются от версии к версии как самого transmission-daemon, так и дистрибутива. В данном мануале приведу пример настройки transmission-daemon под Debian 9.

Устанавливаем transmission-daemon, если он у вас еще не установлен
apt-get install transmission-daemon
Копируем конфигурационные файлы в директорию пользователя, от имени которого будет запускаться transmission-daemon
cp -r /etc/transmission-daemon /home/anykey/.config/
Меняем права доступа
chown -R anykey:anykey /home/anykey/.config/transmission-daemon

В /etc/init.d/transmission-daemon меняем USER=anykey

В /etc/default/transmission-daemon меняем CONFIG_DIR="/home/anykey/.config/transmission-daemon"

Выполняем команду
systemctl edit transmission-daemon.service
В открывшемся окне вписываем
[Service]
User=anykey
Сохраняем изменения и выходим.
Если у вас редактор по умолчанию Nano, то для того чтобы сохранить и выйти необходимо нажать Ctrl+O, затем Ctrl+X, если же Vi, то жмем Esc, затем набираем :wq! и жмем Enter.

Перезагружаемся.

В /home/anykey/.config/transmission-daemon/settings.json меняем:
если компьютер, на котором будет запускаться transmission-daemon имеет статический ip, то прописываем этот ip в строку
"bind-address-ipv4": "192.168.0.2",
сюда вписываем директорию, в которую будут загружаться торренты
"download-dir": "/mnt/distrib",

если хотим указать отдельную директорию для незавершенных загрузок, то меняем значение на true
"incomplete-dir-enabled": true,
и указываем директорию для незавершенных загрузок
"incomplete-dir": "/mnt/temp",

устанавливаем количество информации, выдаваемой в /var/log/syslog, значение можно менять от 0 до 9, где 0 - отсутствие записей в логи
"message-level": 1,

чтобы обращаться к transmission-daemon через web-интерфейс, прописываем true, иначе оставляем false
"rpc-enabled": true,
сюда прописываем ip-адрес, который указали в поле "bind-address-ipv4"
"rpc-bind-address": "192.168.0.2",
если хотим, чтобы запрашивался пароль для доступа через web-интерфейс, то меняем на true, иначе оставляем false
"rpc-authentication-required": true,
если в предыдущем пункте выбрали true, то устанавливаем имя для подключения к web-интерфейсу
"rpc-username": "any",
в кавычки вписываем свой пароль, после перезагрузки конфигурации его значение будет хэшированно
"rpc-password": "63e518bf450175974b02403e657357326a76452f3Io4VSG2a",
можно поменять порт, по которому будет доступен web-интерфейс
"rpc-port": 1419,
чтоб web-интерфейс был доступен только с определенных ip и/или подсетей, то меняем на true
"rpc-whitelist-enabled": true,
в этой строке указываем необходимые ip и подсети через запятую и без пробела
"rpc-whitelist": "127.0.0.1,192.168.0.*",

Основные настройки на этом закончены. Но можно настроить еще всякие дополнительные функции, например, чтоб transmission-daemon подбирал .torrent-файлы из определенной директории и ставил их на закачку, для этого в конец конфигурационного файла дописываем строки
"watch-dir": "/mnt/torrents",
"watch-dir-enabled": true
причем не забываем поставить запятую в конец строки, после которой мы добавили эти строки.
Так же владельцем директории /mnt/torrents должен быть anykey - юзер, от имени которого запускается transmission-daemon
chown -R anykey:anykey /mnt/torrents
Права на директорию /mnt/torrents и файлы в ней должны быть 775
chmod -R 775 /mnt/torrents

Если Вы настроили автодобавление .torrent-файлов из определенной директории на закачку, то по умолчанию, после того, как это автодобавление произошло, файл автоматически переименовывается из foobar.torrent в foobar.torrent.added. Чтоб файлы .torrent.added автоматически удалялись, то можно добавить соответствующую задачу в cron, а можно в /home/anykey/.config/transmission-daemon/settings.json изменить строки на
"script-torrent-done-enabled": true,
"script-torrent-done-filename": "/usr/sbin/transmission-rm-added.sh",
затем создать файл /usr/sbin/transmission-rm-added.sh
touch /usr/sbin/transmission-rm-added.sh
со следующим содержимым
#!/bin/bash
rm /mnt/torrents/*.added

после чего владельцем файла /usr/sbin/transmission-rm-added.sh делаем юзера anykey
chown anykey:anykey /usr/sbin/transmission-rm-added.sh

После изменения настроек ОБЯЗАТЕЛЬНО выполняем команду
invoke-rc.d transmission-daemon reload
и только после этого
service transmission-daemon restart

Все, можно пользоваться transmission-daemon-ом через web-интерфейс по адресу http://127.0.0.1:1419 с компьютера на котором установлен transmission-daemon или по адресу http://192.168.0.2:1419 с любого компьютера в вашей локальной сети.

transmission-daemon web-интерфейс

В левом нижнем углу можно поменять настройки transmission-daemon.