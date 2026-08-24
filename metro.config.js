const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.watcher = {
  ...config.watcher,
  usePolling: true,
  interval: 1000,
};

module.exports = config;
