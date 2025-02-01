#!/bin/bash

source_folder=/home/ikeni/Documents/Notes
target_folder=/home/ikeni/hdd/file

sudo rsync -av --delete "$source_folder" "$target_folder"