import { isElectronRuntime } from './runtime';

export const APP_QUIT_REQUEST_EVENT = 'pve-app-quit-request';

/** Ask the shell to show the exit confirmation dialog. */
export function requestAppQuit(): void {
  window.dispatchEvent(new CustomEvent(APP_QUIT_REQUEST_EVENT));
}

/** Close the desktop window (Electron) or browser tab when permitted. */
export function quitApplication(): void {
  if (isElectronRuntime() && window.electronAPI?.windowClose) {
    void window.electronAPI.windowClose();
    return;
  }
  window.close();
}
