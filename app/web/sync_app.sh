#!/bin/bash

git_folder="/home/bagatocorp/git"
git_branch="master"
app_folder="/home/bagatocorp/web"

# Проверить, существует ли директория "$git_folder"
if [ -d "$git_folder" ]; then
    # Если директория существует, выполнить git pull
    cd "$git_folder" || exit
    git pull
else
    # Если директория не существует, клонировать репозиторий
    git clone https://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@github.com/Web-3Space/ai.git "$git_folder"
    git config --global --add safe.directory $git_folder
    cd "$git_folder" || exit
fi

# Переключиться на ветку "dev"
git checkout "$git_branch"

sudo rsync -av --delete "$git_folder/chat-ai/" "$app_folder/"

sudo chmod +x /home/rocky/chat-ai/project/app.py

cd ~/