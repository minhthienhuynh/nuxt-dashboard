ARG COMPOSER_VERSION=2
ARG NODE_VERSION=22
ARG PHP_TAG=8.3-cli

FROM composer:${COMPOSER_VERSION} AS composer

FROM mlocati/php-extension-installer:latest AS extension_installer

FROM node:${NODE_VERSION}-alpine AS node

FROM php:${PHP_TAG}-alpine

ARG WWWGROUP
ARG WORKDIR=/var/www/html
ARG INSTALL_BCMATH=false
ARG INSTALL_GD=false
ARG INSTALL_GRPC=false
ARG INSTALL_PCNTL=false
ARG INSTALL_PDO_MYSQL=false
ARG INSTALL_REDIS=false
ARG INSTALL_SOCKETS=false
ARG INSTALL_SWOOLE=false
ARG INSTALL_XDEBUG=false
ARG XDEBUG_VERSION=3
ARG INSTALL_ZIP=false
ARG INSTALL_IMAGICK=false
ARG INSTALL_MEMCACHED=false
ARG INSTALL_MONGODB=false
ARG INSTALL_PDO_PGSQL=false
ARG INSTALL_SQLSRV=false

WORKDIR ${WORKDIR}

ENV WORKDIR=${WORKDIR}
ENV SUPERVISOR_PHP_COMMAND="/usr/local/bin/php -d variables_order=EGPCS ${WORKDIR}/artisan serve --host=0.0.0.0"
ENV SUPERVISOR_PHP_USER="sail"

COPY --from=composer /usr/bin/composer /usr/bin/composer
COPY --from=extension_installer /usr/bin/install-php-extensions /usr/local/bin/
COPY --from=node /usr/lib /usr/lib
COPY --from=node /usr/local/share /usr/local/share
COPY --from=node /usr/local/lib /usr/local/lib
COPY --from=node /usr/local/include /usr/local/include
COPY --from=node /usr/local/bin /usr/local/bin/

RUN [ "$INSTALL_BCMATH" = "true" ] && install-php-extensions bcmath || true
RUN [ "$INSTALL_GD" = "true" ] && install-php-extensions gd || true
RUN [ "$INSTALL_GRPC" = "true" ] && install-php-extensions grpc || true
RUN [ "$INSTALL_PCNTL" = "true" ] && install-php-extensions pcntl || true
RUN [ "$INSTALL_PDO_MYSQL" = "true" ] && install-php-extensions pdo_mysql || true
RUN [ "$INSTALL_REDIS" = "true" ] && install-php-extensions redis || true
RUN [ "$INSTALL_SOCKETS" = "true" ] && install-php-extensions sockets || true
RUN [ "$INSTALL_SWOOLE" = "true" ] && install-php-extensions swoole || true
RUN [ "$INSTALL_XDEBUG" = "true" ] && install-php-extensions xdebug || true
RUN [ "$INSTALL_ZIP" = "true" ] && install-php-extensions zip || true
RUN [ "$INSTALL_IMAGICK" = "true" ] && install-php-extensions imagick || true
RUN [ "$INSTALL_MEMCACHED" = "true" ] && install-php-extensions memcached || true
RUN [ "$INSTALL_MONGODB" = "true" ] && install-php-extensions mongodb || true
RUN [ "$INSTALL_PDO_PGSQL" = "true" ] && install-php-extensions pdo_pgsql || true
RUN [ "$INSTALL_SQLSRV" = "true" ] && install-php-extensions sqlsrv || true

RUN apk add --no-cache \
    curl \
    git \
    shadow \
    su-exec \
    supervisor;

RUN addgroup -S -g ${WWWGROUP} sail
RUN adduser -D -S -s /bin/sh -G sail -u 1337 sail
RUN git config --global --add safe.directory ${WORKDIR}

COPY start-container /usr/local/bin/start-container
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY php.ini /usr/local/etc/php/conf.d/99-sail.ini
COPY xdebug2.ini /usr/local/etc/php/conf.d/99-xdebug2.ini.available
COPY xdebug3.ini /usr/local/etc/php/conf.d/99-xdebug3.ini.available
RUN if [ "$XDEBUG_VERSION" = "2" ]; then \
        mv /usr/local/etc/php/conf.d/99-xdebug2.ini.available /usr/local/etc/php/conf.d/99-xdebug.ini; \
        rm /usr/local/etc/php/conf.d/99-xdebug3.ini.available; \
    else \
        mv /usr/local/etc/php/conf.d/99-xdebug3.ini.available /usr/local/etc/php/conf.d/99-xdebug.ini; \
        rm /usr/local/etc/php/conf.d/99-xdebug2.ini.available; \
    fi
RUN chmod +x /usr/local/bin/start-container

ENTRYPOINT ["start-container"]
