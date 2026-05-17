ARG COMPOSER_VERSION=2
ARG NODE_VERSION=22
ARG PHP_TAG=8.3-cli

FROM composer:${COMPOSER_VERSION} AS composer

FROM mlocati/php-extension-installer:2 AS extension_installer

FROM node:${NODE_VERSION}-alpine AS node

FROM php:${PHP_TAG}-alpine

ARG WWWGROUP
ARG WORKDIR=/var/www/html
ARG PHP_EXTENSIONS=""
ARG XDEBUG_VERSION=3

WORKDIR ${WORKDIR}

ENV WORKDIR=${WORKDIR}
ARG SUPERVISOR_PHP_COMMAND="/usr/local/bin/php -d variables_order=EGPCS ${WORKDIR}/artisan serve --host=0.0.0.0"
ENV SUPERVISOR_PHP_COMMAND=$SUPERVISOR_PHP_COMMAND
ARG SUPERVISOR_PHP_USER="sail"
ENV SUPERVISOR_PHP_USER=$SUPERVISOR_PHP_USER

COPY --from=composer /usr/bin/composer /usr/bin/composer
COPY --from=extension_installer /usr/bin/install-php-extensions /usr/local/bin/
COPY --from=node /usr/lib /usr/lib
COPY --from=node /usr/local/share /usr/local/share
COPY --from=node /usr/local/lib /usr/local/lib
COPY --from=node /usr/local/include /usr/local/include
COPY --from=node /usr/local/bin /usr/local/bin/

RUN if [ -n "$PHP_EXTENSIONS" ]; then install-php-extensions $PHP_EXTENSIONS; fi

RUN apk add --no-cache \
    git \
    shadow \
    su-exec \
    supervisor;

RUN groupadd -f -g ${WWWGROUP} sail
RUN adduser -D -s /bin/sh -G sail -u 1337 sail
RUN git config --global --add safe.directory ${WORKDIR}

COPY start-container /usr/local/bin/start-container
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY php.ini /usr/local/etc/php/conf.d/99-sail.ini
COPY xdebug3.ini /usr/local/etc/php/conf.d/99-xdebug.ini
RUN chmod +x /usr/local/bin/start-container

ENTRYPOINT ["start-container"]
