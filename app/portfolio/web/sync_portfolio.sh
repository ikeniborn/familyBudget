#!/bin/bash

git_folder="/home/bagatocorp/git"
git_branch="master"
app_folder="/home/bagatocorp/portfolio"

if [ -d "$app_folder" ]; then
  exit
else
  mkdir /home/bagatocorp/portfolio
fi

# Проверить, существует ли директория "$git_folder"
if [ -d "$git_folder" ]; then
    # Если директория существует, выполнить git pull
    cd "$git_folder" || exit
    git pull
else
    # Если директория не существует, клонировать репозиторий
    git clone https://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@github.com//ikeniborn/familyBudget.git "$git_folder"
    git config --global --add safe.directory $git_folder
    cd "$git_folder" || exit
fi

# Переключиться на ветку "dev"
git checkout "$git_branch"

sudo rsync -av --delete "$git_folder/app/portfolio/web/app/" "$app_folder/"

sudo chown root:root /home/bagatocorp/portfolio/cert/portfolio.ikeniborn.ru.pem
sudo chown root:root /home/bagatocorp/portfolio/cert/portfolio.ikeniborn.ru.key

cd ~/