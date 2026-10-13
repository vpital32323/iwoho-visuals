const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path'); const fs = require('fs'); const { execFile } = require('child_process');
const root = path.join(app.getPath('appData'), '.iwoho');
let splash, win; const msAuth = {};

function createSplash() {
  splash = new BrowserWindow({ width: 420, height: 420, frame: false, transparent: true, resizable: false, alwaysOnTop: true, center: true });
  splash.loadFile(path.join(__dirname, 'splash.html'));
}
function createMain() {
  win = new BrowserWindow({ width: 1120, height: 700, minWidth: 940, minHeight: 620, frame: false, show: false, backgroundColor: '#0a0714', webPreferences: { preload: path.join(__dirname, 'preload.js') } });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.once('ready-to-show', () => { splash && splash.close(); win.show(); });
}
app.whenReady().then(() => { createSplash(); setTimeout(createMain, 3600); });
app.on('window-all-closed', () => app.quit());

ipcMain.on('win', (e, a) => { const w = BrowserWindow.fromWebContents(e.sender); if (a === 'min') w.minimize(); if (a === 'max') w.isMaximized() ? w.unmaximize() : w.maximize(); if (a === 'close') w.close(); });
ipcMain.on('fs', (e, v) => BrowserWindow.fromWebContents(e.sender).setFullScreen(!!v));
ipcMain.handle('pick', async () => { const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Фото или видео', extensions: ['mp4', 'webm', 'png', 'jpg', 'jpeg', 'gif', 'webp'] }], properties: ['openFile'] }); return r.canceled ? null : r.filePaths[0]; });
ipcMain.on('mods', () => { const d = path.join(root, 'mods'); fs.mkdirSync(d, { recursive: true }); shell.openPath(d); });
ipcMain.handle('mods:list', () => { try { const d = path.join(root, 'mods'); return fs.readdirSync(d).filter(f => f.endsWith('.jar')).map(f => ({ name: f.replace(/\.jar$/, ''), size: (fs.statSync(path.join(d, f)).size / 1048576).toFixed(1) })); } catch { return []; } });

ipcMain.handle('ms-login', async () => {
  try {
    const { Auth } = require('msmc');
    const xbox = await new Auth('select_account').launch('electron');
    const t = await xbox.getMinecraft();
    msAuth[t.profile.name] = t.mclc();
    return { ok: true, name: t.profile.name };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});

// Автоустановка Fabric API + ViaFabricPlus (вход на серверы разных версий)
ipcMain.handle('install-mods', async (e, { version }) => {
  try {
    const dir = path.join(root, 'mods'); fs.mkdirSync(dir, { recursive: true }); const res = [];
    for (const slug of ['fabric-api', 'viafabricplus']) {
      const u = `https://api.modrinth.com/v2/project/${slug}/version?game_versions=${encodeURIComponent(JSON.stringify([version]))}&loaders=${encodeURIComponent('["fabric"]')}`;
      const vs = await (await fetch(u, { headers: { 'User-Agent': 'IwohoLauncher/1.0' } })).json();
      const f = vs[0] && (vs[0].files.find(x => x.primary) || vs[0].files[0]);
      if (!f) { res.push(`${slug}: нет версии для ${version}`); continue; }
      fs.writeFileSync(path.join(dir, f.filename), Buffer.from(await (await fetch(f.url)).arrayBuffer()));
      res.push(`${slug} ✔`);
    }
    return { ok: true, res };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});

const javaMajor = (v) => { const [, mi, pa] = v.split('.').map(Number); if (mi >= 21 || (mi === 20 && (pa || 0) >= 5)) return 21; return mi <= 16 ? 8 : 17; };
async function ensureJava(major, send) {
  if (process.platform !== 'win32') return 'java';
  const base = path.join(root, 'runtime', String(major));
  const find = () => { try { return fs.readdirSync(base).map(n => path.join(base, n, 'bin', 'java.exe')).find(p => fs.existsSync(p)); } catch { return null; } };
  let j = find(); if (j) return j;
  fs.mkdirSync(base, { recursive: true });
  send('progress', { text: `Загрузка Java ${major} (один раз)…`, pct: 5 });
  const r = await fetch(`https://api.adoptium.net/v3/binary/latest/${major}/ga/windows/x64/jre/hotspot/normal/eclipse`);
  if (!r.ok) throw new Error('Не удалось скачать Java');
  const zip = path.join(base, 'jre.zip'); fs.writeFileSync(zip, Buffer.from(await r.arrayBuffer()));
  send('progress', { text: 'Распаковка Java…', pct: 60 });
  await new Promise((res, rej) => execFile('powershell', ['-NoProfile', '-Command', `Expand-Archive -Force -LiteralPath '${zip}' -DestinationPath '${base}'`], e => e ? rej(e) : res()));
  fs.unlinkSync(zip); j = find(); if (!j) throw new Error('Java не найдена после распаковки'); return j;
}

ipcMain.handle('launch', async (e, o) => {
  const send = (ch, d) => win.webContents.send(ch, d);
  try {
    const { Client, Authenticator } = require('minecraft-launcher-core');
    const a = o.account || {};
    let auth;
    if (a.type === 'ms') { auth = msAuth[a.name]; if (!auth) throw new Error('Войди в Microsoft-аккаунт заново (Accounts)'); }
    else auth = Authenticator.getAuth(a.name || o.nick || 'Player');
    const javaPath = await ensureJava(javaMajor(o.version), send);
    const opts = { authorization: auth, root, javaPath, version: { number: o.version, type: 'release' }, memory: { max: o.ram || '4G', min: '1G' } };
    if (o.server) {
      const [host, port] = o.server.split(':'); const mi = Number(o.version.split('.')[1]);
      if (mi >= 20) opts.quickPlay = { type: 'multiplayer', identifier: o.server }; else opts.server = { host, port: port || '25565' };
    }
    if (o.loader === 'Fabric') {
      const l = await (await fetch(`https://meta.fabricmc.net/v2/versions/loader/${o.version}`)).json();
      const id = `fabric-loader-${l[0].loader.version}-${o.version}`;
      const dir = path.join(root, 'versions', id); fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, id + '.json'), await (await fetch(`https://meta.fabricmc.net/v2/versions/loader/${o.version}/${l[0].loader.version}/profile/json`)).text());
      opts.version.custom = id;
    }
    const l = new Client();
    l.on('progress', (p) => send('progress', { text: `Загрузка: ${p.type}`, pct: Math.round((p.task / p.total) * 100) }));
    l.on('package-extract', () => send('progress', { text: 'Распаковка файлов…', pct: 100 }));
    l.on('data', () => send('started'));
    l.on('close', () => send('closed'));
    if (!(await l.launch(opts))) throw new Error('Не удалось запустить игру');
    return { ok: true };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});
