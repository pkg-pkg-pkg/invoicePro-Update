const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const rootPath = __dirname;
const appPath = path.resolve(__dirname, '../mobile');

const config = {
  watchFolders: [appPath],
  resolver: {
    nodeModulesPaths: [
      path.resolve(rootPath, 'node_modules'),
      path.resolve(appPath, 'node_modules'),
      path.resolve(rootPath, '../node_modules'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
