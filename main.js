const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path'); const fs = require('fs');
const root = path.join(app.getPath('appData'), '.iwoho');
let splash, win;

function createSplash() {
  splash = new BrowserWindow({ width: 420, height: 420, frame: false, transparent: true, resizable: false, alwaysOnTop: true, center: true, webPreferences: { preload: path.join(__dirname, 'preload.js') } });
  splash.loadFile(path.join(__dirname, 'splash.html'));
}
function createMain() {
  win = new BrowserWindow({ width: 1100, height: 680, minWidth: 900, minHeight: 600, frame: false, show: false, backgroundColor: '#0a0714', webPreferences: { preload: path.join(__dirname, 'preload.js') } });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.once('ready-to-show', () => { splash && splash.close(); win.show(); });
}
app.whenReady().then(() => { createSplash(); setTimeout(createMain, 3600); });
app.on('window-all-closed', () => app.quit());

ipcMain.on('win', (e, a) => { const w = BrowserWindow.fromWebContents(e.sender); if (a === 'min') w.minimize(); if (a === 'max') w.isMaximized() ? w.unmaximize() : w.maximize(); if (a === 'close') w.close(); });
ipcMain.on('fs', (e, v) => BrowserWindow.fromWebContents(e.sender).setFullScreen(!!v));
ipcMain.handle('pick', async () => { const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Фон', extensions: ['mp4', 'webm', 'png', 'jpg', 'jpeg', 'gif'] }], properties: ['openFile'] }); return r.canceled ? null : r.filePaths[0]; });

ipcMain.handle('launch', async (e, o) => {
  const send = (ch, d) => win.webContents.send(ch, d);
  try {
    const { Client, Authenticator } = require('minecraft-launcher-core');
    const opts = { authorization: Authenticator.getAuth(o.nick || 'Player'), root, version: { number: o.version, type: 'release' }, memory: { max: o.ram || '4G', min: '1G' } };
    if (o.server) { const [host, port] = o.server.split(':'); opts.server = { host, port: port || '25565' }; }
    if (o.loader === 'Fabric') {
      const l = await (await fetch(`https://meta.fabricmc.net/v2/versions/loader/${o.version}`)).json();
      const id = `fabric-loader-${l[0].loader.version}-${o.version}`;
      const dir = path.join(root, 'versions', id); fs.mkdirSync(dir, { recursive: true });
      const j = await (await fetch(`https://meta.fabricmc.net/v2/versions/loader/${o.version}/${l[0].loader.version}/profile/json`)).text();
      fs.writeFileSync(path.join(dir, id + '.json'), j);
      opts.version.custom = id;
    }
    const l = new Client();
    l.on('progress', (p) => send('progress', { text: `Загрузка: ${p.type}`, pct: Math.round((p.task / p.total) * 100) }));
    l.on('package-extract', () => send('progress', { text: 'Распаковка файлов…', pct: 100 }));
    l.on('data', () => send('started'));
    l.on('close', () => send('closed'));
    const proc = await l.launch(opts);
    if (!proc) throw new Error('Не удалось запустить игру (проверь Java 17+)');
    return { ok: true };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});
ipcMain.on('mods', () => { const d = path.join(root, 'mods'); fs.mkdirSync(d, { recursive: true }); shell.openPath(d); });
