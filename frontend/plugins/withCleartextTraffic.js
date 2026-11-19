const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Разрешает cleartext HTTP для self-hosted сервера по LAN.
 *
 * Android 9+ блокирует HTTP по умолчанию, а бэкенд работает без TLS.
 * Без этого флага приложение молча не подключается к `http://<host>:8000`.
 */
module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, config => {
    const application = config.modResults.manifest.application?.[0];
    if (application) {
      application.$['android:usesCleartextTraffic'] = 'true';
    }
    return config;
  });
};
