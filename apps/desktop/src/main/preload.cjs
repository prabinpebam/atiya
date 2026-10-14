// The bridge the app's own pages use (documentation/desktop/spec.md §7.4). Sandboxed preloads are
// CommonJS. Only pages from app:// get it: edit mode and the site, from the dev server, never do.
const { contextBridge, ipcRenderer } = require('electron');

if (location.protocol === 'app:') {
  const call = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);
  contextBridge.exposeInMainWorld('atiya', {
    state: call('app:state'),
    openWorkspace: call('workspace:open'),
    chooseWorkspace: call('workspace:choose'),
    restart: call('server:restart'),
    useExisting: call('server:use-existing'),
    show: call('view:show'),
    openExternal: call('open:external'),
    openInBrowser: call('open:browser'),
    onState(cb) {
      const listener = (_e, s) => cb(s);
      ipcRenderer.on('app:state', listener);
      return () => ipcRenderer.removeListener('app:state', listener);
    },
  });
}
