# Image SIGAP. Build dari ROOT repo:
#   docker compose -f deploy/docker/compose.yml build
# Target: `app` (PHP-FPM, juga dipakai queue/reverb/scheduler) dan `web` (nginx + aset publik).

ARG PHP_VERSION=8.4

FROM composer:2 AS composer-bin

# ---------- PHP dasar ----------
FROM php:${PHP_VERSION}-fpm-alpine AS php-base
# gd: foto lampiran chat di-encode ulang agar metadata (EXIF, termasuk lokasi GPS) terbuang.
RUN apk add --no-cache icu-libs libzip libpq fcgi libpng libjpeg-turbo libwebp freetype \
 && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS icu-dev libzip-dev postgresql-dev linux-headers libpng-dev libjpeg-turbo-dev libwebp-dev freetype-dev \
 && docker-php-ext-configure gd --with-jpeg --with-webp --with-freetype \
 && docker-php-ext-install -j"$(nproc)" pdo_pgsql intl zip bcmath pcntl opcache gd \
 && apk del .build-deps
COPY --from=composer-bin /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/html

# ---------- Dependensi PHP ----------
FROM php-base AS vendor
COPY sigap/composer.json sigap/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction --no-progress
COPY sigap/ ./
RUN composer dump-autoload --optimize --no-dev --no-scripts

# ---------- Aset frontend (Vite) ----------
FROM node:22-alpine AS assets
WORKDIR /app
COPY sigap/package.json sigap/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY sigap/ ./
# laravel-vite-plugin memetakan `ziggy-js` ke vendor/tightenco/ziggy
COPY --from=vendor /var/www/html/vendor ./vendor
# Variabel VITE_* DITANAM ke JavaScript saat build — harus nilai produksi.
ARG VITE_APP_NAME="Contact Center"
ARG VITE_REVERB_APP_KEY=
ARG VITE_REVERB_HOST=
ARG VITE_REVERB_PORT=443
ARG VITE_REVERB_SCHEME=https
ENV VITE_APP_NAME=$VITE_APP_NAME VITE_REVERB_APP_KEY=$VITE_REVERB_APP_KEY \
    VITE_REVERB_HOST=$VITE_REVERB_HOST VITE_REVERB_PORT=$VITE_REVERB_PORT \
    VITE_REVERB_SCHEME=$VITE_REVERB_SCHEME
RUN npm run build

# ---------- Aplikasi (PHP-FPM) ----------
FROM php-base AS app
COPY deploy/docker/php.ini "$PHP_INI_DIR/conf.d/99-sigap.ini"
COPY deploy/docker/php-fpm.conf /usr/local/etc/php-fpm.d/zz-sigap.conf
COPY sigap/ ./
COPY --from=vendor /var/www/html/vendor ./vendor
COPY --from=assets /app/public/build ./public/build
RUN rm -f .env && php artisan package:discover --ansi \
 && mkdir -p storage/app/private storage/framework/cache/data storage/framework/sessions \
             storage/framework/views storage/logs bootstrap/cache \
 && chown -R www-data:www-data storage bootstrap/cache \
 && rm /usr/bin/composer
COPY deploy/docker/entrypoint.sh /usr/local/bin/sigap-entrypoint
RUN chmod 755 /usr/local/bin/sigap-entrypoint
USER www-data
EXPOSE 9000
ENTRYPOINT ["sigap-entrypoint"]
CMD ["php-fpm"]

# ---------- Web (nginx) ----------
FROM nginx:1.27-alpine AS web
RUN rm -f /etc/nginx/conf.d/default.conf
COPY deploy/docker/nginx.conf /etc/nginx/conf.d/sigap.conf
COPY deploy/docker/security-headers.conf /etc/nginx/snippets/sigap-security-headers.conf
COPY --from=app /var/www/html/public /var/www/html/public
EXPOSE 80
