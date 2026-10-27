FROM php:8.2-fpm-alpine

# Install nginx + openssl for Web Push
RUN apk add --no-cache nginx

# Install mysqli + ensure openssl is available
RUN docker-php-ext-install mysqli \
    && php -r "exit(defined('MYSQLI_CLIENT_SSL_VERIFY_SERVER_CERT') ? 0 : 1);"

# Nginx config
RUN mkdir -p /run/nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Copy API files
COPY . /var/www/html/

# Permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

# Start script
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 80
CMD ["/start.sh"]