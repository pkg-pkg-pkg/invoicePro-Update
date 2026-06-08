const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const rootPath = __dirname;
const appPath = path.resolve(__dirname, '../mobile');
const appNodeModulesPath = path.resolve(appPath, 'node_modules');
const escapeForRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const config = {
  watchFolders: [appPath],
  resolver: {
    disableHierarchicalLookup: true,
    nodeModulesPaths: [
      path.resolve(rootPath, 'node_modules'),
    ],
    extraNodeModules: {
      react: path.resolve(rootPath, 'node_modules/react'),
      'react-native': path.resolve(rootPath, 'node_modules/react-native'),
    },
    blockList: exclusionList([new RegExp(`^${escapeForRegex(appNodeModulesPath)}\\/.*$`)]),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
