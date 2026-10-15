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
    openLive: call('open:live'),
    checkSite: call('site:check'),
    // the title bar's account menu (plan stage 7C)
    account: {
      signIn: call('account:sign-in'),
      signOut: call('account:sign-out'),
      switchSite: call('site:switch'),
    },
    resolveSync: call('sync:resolve'),
    privatePages: {
      state: call('private:state'),
      setUp: call('private:setup'),
      finish: call('private:finish'),
    },
    setup: {
      start: call('setup:start'),
      signIn: call('setup:sign-in'),
      copyCode: call('setup:copy-code'),
      openGitHub: call('setup:open-github'),
      checkEmail: call('setup:check-email'),
      edit: call('setup:edit'),
      chooseFolder: call('setup:choose-folder'),
      create: call('setup:create'),
      chooseSite: call('setup:choose-site'),
      retry: call('setup:retry'),
      back: call('setup:back'),
      retryPublish: call('publish:retry'),
    },
    onState(cb) {
      const listener = (_e, s) => cb(s);
      ipcRenderer.on('app:state', listener);
      return () => ipcRenderer.removeListener('app:state', listener);
    },
    // the window the app draws itself (plan stage 7A): the main process answers the frame's page alone
    window: {
      state: () => ipcRenderer.invoke('window:state'),
      onState(cb) {
        const listener = (_e, s) => cb(s);
        ipcRenderer.on('window:state', listener);
        return () => ipcRenderer.removeListener('window:state', listener);
      },
      minimize: () => ipcRenderer.send('window:minimize'),
      maximize: () => ipcRenderer.send('window:maximize'),
      restore: () => ipcRenderer.send('window:restore'),
      close: () => ipcRenderer.send('window:close'),
      toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
      snap: (zone) => ipcRenderer.send('window:snap', zone),
      drag: (phase, kind, x, y, shift) => ipcRenderer.send('window:drag', phase, kind, x, y, shift),
      pointer: () => ipcRenderer.send('window:pointer'),
      accent: (color) => ipcRenderer.send('window:accent', color),
      raise: (up) => ipcRenderer.send('frame:raise', up),
      menu: (x, y) => ipcRenderer.send('app:menu', x, y),
    },
    // edit mode's header, as the row draws it (plan stage 7B): what edit mode described, and pressing it
    onHeader(cb) {
      const listener = (_e, h) => cb(h);
      ipcRenderer.on('studio:header', listener);
      return () => ipcRenderer.removeListener('studio:header', listener);
    },
    header: () => ipcRenderer.invoke('studio:header'),
    command: (c) => ipcRenderer.send('studio:command', c),
  });
}

// Edit mode in the app's own view gets one thing: describing its header to the app's one title bar row, and
// hearing the row's commands (plan stage 7B, src/site/editor/scripts/studio.ts). The main process checks both.
if (location.protocol === 'http:' && location.hostname === 'localhost' && location.pathname.startsWith('/_edit/')) {
  contextBridge.exposeInMainWorld('atiyaStudio', {
    publish: (header) => ipcRenderer.send('studio:header', header),
    onCommand(cb) {
      const listener = (_e, c) => cb(c);
      ipcRenderer.on('studio:command', listener);
      return () => ipcRenderer.removeListener('studio:command', listener);
    },
  });
}
