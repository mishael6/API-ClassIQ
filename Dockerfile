FROM php:8.2-apache

# Enable mod_rewrite and mod_headers only
RUN a2enmod rewrite headers

# Copy all API files to Apache web root
COPY . /var/www/html/

# Set permissions
RUN chown -R www-data:www-data /var/www/html

# Apache config — allow .htaccess overrides and fix MPM issue
RUN echo '<Directory /var/www/html>\n\
    AllowOverride All\n\
    Require all granted\n\
</Directory>' > /etc/apache2/conf-available/classiq.conf \
    && a2enconf classiq

EXPOSE 80
CMD ["apache2-foreground"]