FROM php:8.2-apache

# Disable conflicting MPM modules, enable only prefork
RUN a2dismod mpm_event mpm_worker 2>/dev/null || true \
    && a2enmod mpm_prefork \
    && a2enmod rewrite \
    && a2enmod headers

# Allow .htaccess overrides
RUN sed -i 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf

# Copy API files
COPY . /var/www/html/

# Permissions
RUN chown -R www-data:www-data /var/www/html \
    && find /var/www/html -type f -name "*.php" -exec chmod 644 {} \;

EXPOSE 80
CMD ["apache2-foreground"]