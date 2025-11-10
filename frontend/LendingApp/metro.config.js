const { getDefaultConfig } = require('@react-native/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [];
config.projectRoot = __dirname;

module.exports = config;
