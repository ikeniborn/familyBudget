apt-get install locales

sudo nano /etc/default/locale

LANG=en_US.UTF-8
LC_NUMERIC=ru_RU.UTF-8
LC_TIME=ru_RU.UTF-8
LC_MONETARY=ru_RU.UTF-8
LC_PAPER=ru_RU.UTF-8
LC_NAME=ru_RU.UTF-8
LC_ADDRESS=ru_RU.UTF-8
LC_TELEPHONE=ru_RU.UTF-8
LC_MEASUREMENT=ru_RU.UTF-8
LC_IDENTIFICATION=ru_RU.UTF-8
LANGUAGE=en_US.UTF-8


sudo localedef -i en_US -f UTF-8 en_US.UTF-8

sudo dpkg-reconfigure locales