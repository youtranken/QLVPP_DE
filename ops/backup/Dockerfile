# openssl bake sẵn để offline vẫn backup được
FROM postgres:18-alpine
RUN apk add --no-cache openssl
COPY backup.sh /backup.sh
COPY cron-loop.sh /cron-loop.sh
ENTRYPOINT ["sh", "/backup.sh"]
