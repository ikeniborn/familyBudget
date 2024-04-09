#!/bin/bash

git_folder="/home/bagatocorp/git"
git_branch="master"
app_folder="/home/bagatocorp"

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

if [ ! -d "$app_folder" ]; then
    # Если директория не существует
    sudo mkdir $app_folder
fi

sudo rsync -av --delete "$git_folder/app/web" "$app_folder"

sudo chmod +x "$app_folder/web/data/postgres-backup.sh"

sudo chown -R 1000:1000 $app_folder


cd ~/