# /opt/truffiere/backup-db.sh
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker compose exec -T db pg_dump -U postgres truffiere_db > /opt/backups/truffiere_$DATE.sql
# Garder seulement les 7 derniers backups
find /opt/backups/ -name "truffiere_*.sql" -mtime +7 -delete
