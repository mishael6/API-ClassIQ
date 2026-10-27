#!/bin/sh
# Start php-fpm in background
php-fpm &

# Start nginx in foreground
nginx -g "daemon off;"
