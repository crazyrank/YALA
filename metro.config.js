const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.watcher = {
  ...config.watcher};

module.exports = config;
