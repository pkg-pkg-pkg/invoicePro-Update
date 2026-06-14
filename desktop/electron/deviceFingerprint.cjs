const os = require('os');
const crypto = require('crypto');

function getMachineIdSync() {
  try {
    const { machineIdSync } = require('node-machine-id');
    return machineIdSync(true);
  } catch {
    return '';
  }
}

function hashDeviceKey(deviceId) {
  return crypto.createHash('sha256').update(String(deviceId ?? ''), 'utf8').digest('hex').slice(0, 32);
}

function getDeviceFingerprintPayload() {
  const deviceId = getMachineIdSync() || `fallback-${os.hostname()}-${os.userInfo().username}`;
  return {
    device_id: deviceId,
    device_fingerprint: hashDeviceKey(deviceId),
    device_name: os.hostname(),
    os_info: `${os.platform()} ${os.release()}`,
  };
}

module.exports = { getDeviceFingerprintPayload };
