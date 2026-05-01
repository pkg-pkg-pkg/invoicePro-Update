const path = require('path');

module.exports = {
  project: {
    android: {
      sourceDir: path.resolve(__dirname, '../mobile-native-shell/android'),
    },
    ios: {
      sourceDir: path.resolve(__dirname, '../mobile-native-shell/ios'),
      automaticPodsInstallation: true,
    },
  },
};

