const {getDefaultConfig} = require('@react-native/metro-config');
const config = getDefaultConfig(__dirname);

// Reduce how many folders Metro watches (helps on Windows)
config.watchFolders = [];
config.resolver = {...config.resolver};
config.server = {...config.server};
config.projectRoot = __dirname;

module.exports = config;
