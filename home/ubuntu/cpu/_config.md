sudo apt-get install cpufrequtils

sudo /etc/init.d/loadcpufreq restart
sudo /etc/init.d/cpufrequtils restart

sudo nano /etc/default/loadcpufreq
sudo nano /etc/default/cpufrequtils
/usr/bin/cpufreq-info

sudo /usr/bin/cpufreq-set -g performance


<!-- sudo cpufreq-set -c 0 -g performance && \
sudo cpufreq-set -c 1 -g performance && \
sudo cpufreq-set -c 2 -g performance && \
sudo cpufreq-set -c 3 -g performance && \
sudo cpufreq-set -c 4 -g performance && \
sudo cpufreq-set -c 5 -g performance && \
sudo cpufreq-set -c 6 -g performance && \
sudo cpufreq-set -c 7 -g performance

sudo cpufreq-set -c 0 --min 1.2GHz && \
sudo cpufreq-set -c 1 --min 1.2GHz && \
sudo cpufreq-set -c 2 --min 1.2GHz && \
sudo cpufreq-set -c 3 --min 1.2GHz && \
sudo cpufreq-set -c 4 --min 1.2GHz && \
sudo cpufreq-set -c 5 --min 1.2GHz && \
sudo cpufreq-set -c 6 --min 1.2GHz && \
sudo cpufreq-set -c 7 --min 1.2GHz

sudo cpufreq-set -c 0 -f 2.4GHz && \
sudo cpufreq-set -c 1 -f 2.4GHz && \
sudo cpufreq-set -c 2 -f 2.4GHz && \
sudo cpufreq-set -c 3 -f 2.4GHz && \
sudo cpufreq-set -c 4 -f 2.4GHz && \
sudo cpufreq-set -c 5 -f 2.4GHz && \
sudo cpufreq-set -c 6 -f 2.4GHz && \
sudo cpufreq-set -c 7 -f 2.4GHz -->

grep . /sys/devices/system/cpu/cpu*/cpufreq/scaling_driver
grep . /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
grep . /sys/devices/system/cpu/cpu*/cpufreq/cpuinfo_min_freq
grep . /sys/devices/system/cpu/cpu*/cpufreq/cpuinfo_max_freq
grep . /sys/devices/system/cpu/cpu*/cpufreq/scaling_min_freq
grep . /sys/devices/system/cpu/cpu*/cpufreq/scaling_max_freq
grep . /sys/devices/system/cpu/cpu0/cpufreq/*

watch -n.1 "grep \"^[c]pu MHz\" /proc/cpuinfo"

echo 2501000 | sudo tee /sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
echo ondemand | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

echo 1200000 | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_min_freq
echo 2500000 | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_max_freq

echo "1200000" | sudo tee /sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_min_freq
echo "2500000" | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/cpuinfo_max_freq

watch -n.1 sensors

stress --cpu 8

chmod 0774 root:root -R /sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_min_freq