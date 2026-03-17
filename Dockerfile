FROM php:8.2-fpm-alpine

# Install nginx
RUN apk add --no-cache nginx

# Install mysqli extension
RUN docker-php-ext-install mysqli

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