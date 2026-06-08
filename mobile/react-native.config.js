const path = require('path');

module.exports = {
  project: {
    android: {
      sourceDir: path.resolve(__dirname, '../mns/android'),
    },
    ios: {
      sourceDir: path.resolve(__dirname, '../mns/ios'),
      automaticPodsInstallation: true,
    },
  },
};

