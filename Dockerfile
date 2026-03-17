FROM php:8.2-apache

# Force only mpm_prefork — do it in one step to avoid conflicts
RUN set -e; \
    cd /etc/apache2/mods-enabled; \
    rm -f mpm_event.load mpm_event.conf mpm_worker.load mpm_worker.conf 2>/dev/null; \
    ln -sf ../mods-available/mpm_prefork.load mpm_prefork.load; \
    ln -sf ../mods-available/mpm_prefork.conf mpm_prefork.conf; \
    ln -sf ../mods-available/rewrite.load rewrite.load; \
    ln -sf ../mods-available/headers.load headers.load

# Allow .htaccess
RUN sed -i 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf

# Copy files
COPY . /var/www/html/

RUN chown -R www-data:www-data /var/www/html

EXPOSE 80
CMD ["apache2-foreground"]