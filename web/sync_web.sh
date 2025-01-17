#!/bin/bash

git_folder="$HOME/git"
git_branch="master"
app_folder="$HOME/app"

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

# Переключиться на ветку "git_branch"
git checkout "$git_branch"

if [ ! -d "$app_folder/web" ]; then
    # Если директория не существует
    mkdir -p $app_folder/web
else 
    rsync -av --delete "$git_folder/web" "$app_folder"
    chmod +x "$app_folder/web/db/postgresql/backup/postgres-backup.sh"
    chmod +x "$app_folder/web/db/couchdb/backup/couchdb-backup.sh"
    chmod +x "$app_folder/web/service/haproxy/prepareLetsEncryptCertificates.sh"
    chmod +x "$app_folder/web/service/haproxy/renewLetsEncryptCertificates.sh"
    chown -R ikeniborn:ikeniborn $app_folder
    # rm -rdf $git_folder
fi

cd $HOME