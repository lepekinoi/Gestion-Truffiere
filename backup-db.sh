# /opt/truffiere/backup-db.sh
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec truffiere_db pg_dump -U unstuffed1004 truffiere > /opt/backups/truffiere_$DATE.sql
# Garder seulement les 7 derniers backups
find /opt/backups/ -name "truffiere_*.sql" -mtime +7 -delete
