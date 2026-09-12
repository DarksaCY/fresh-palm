# fresh-palm

Веб-мост для Palm m505: HotSync/файлы, позже — проброс интернета, трансляция экрана, чат с Claude через устройство.

## Требования

- Node.js 20+ (в системе может быть 18 — используйте `nvm`: `nvm install 20 && nvm use 20`)
- Linux: устройство должно быть доступно без sudo — модуль `visor` заблокирован, вместо него udev-правила от `palm-sync` (см. `docs/connecting-palm-os-devices.md` в `vendor/palm-sync`).

## Установка

```
git clone --depth 1 https://github.com/jichu4n/palm-sync.git vendor/palm-sync
cd vendor/palm-sync && npm install && npm run build && cd ../..
npm install
```

## Запуск

```
npm start
```

Дашборд: http://localhost:7373
