#!/bin/sh
# Entrypoint image SIGAP. Konfigurasi datang dari env (compose env_file), bukan berkas .env.
set -e
cd /var/www/html

# Volume storage bisa kosong/baru: pastikan struktur foldernya ada.
mkdir -p storage/app/private storage/framework/cache/data storage/framework/sessions \
         storage/framework/views storage/logs

# Hanya container web (php-fpm) yang membangun cache config/route/view/event.
if [ "$1" = "php-fpm" ]; then
  if [ -z "$APP_KEY" ]; then
    echo "APP_KEY kosong. Buat dengan: docker compose run --rm app php artisan key:generate --show" >&2
    exit 1
  fi
  php artisan optimize --no-interaction
fi

exec "$@"
