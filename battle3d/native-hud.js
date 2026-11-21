export function connectNativeHud({ getState, handle }) {
  const frame = document.getElementById('game');
  let previous = '', lastPort;
  function sync() {
    const port = frame.contentWindow?.yjBattle;
    if (!port?.nativeHud || !frame.contentWindow.commandHudReady) return;
    const state = getState();
    if (!state) return;
    const payload = JSON.stringify(state);
    if (payload !== previous || port !== lastPort) {
      port.nativeHud(payload);
      previous = payload;
      lastPort = port;
    }
    const painted = Boolean(frame.contentWindow.commandHudPainted);
    document.documentElement.classList.toggle('native-hud', painted);
    if (painted && port !== paintedPort) {
      paintedPort = port;
      window.yjStageLoading.finish();
    }
  }
  let paintedPort;
  window.yjNativeHudInput = command => queueMicrotask(() => { handle(command); sync(); });
  setInterval(sync, 120);
}
