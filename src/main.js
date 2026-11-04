const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs'), path = require('path'), { execFile } = require('child_process');

const sh = (cmd, args) => new Promise(r => execFile(cmd, args, { windowsHide: true }, () => r()));
const refresh = () => sh('powershell', ['-NoProfile', '-Command',
  `Add-Type -MemberDefinition '[DllImport("shell32.dll")] public static extern void SHChangeNotify(int e,int f,IntPtr a,IntPtr b);' -Name N -Namespace S; [S.N]::SHChangeNotify(0x08000000,0,[IntPtr]::Zero,[IntPtr]::Zero)`]);

function toIco(png) {
  const h = Buffer.alloc(22);
  h.writeUInt16LE(1, 2); h.writeUInt16LE(1, 4);          // type=icon, 1 image
  h.writeUInt16LE(1, 10); h.writeUInt16LE(32, 12);       // planes, bpp (width/height 0 = 256)
  h.writeUInt32LE(png.length, 14); h.writeUInt32LE(22, 18);
  return Buffer.concat([h, png]);
}

const ICON = /^\s*(IconResource|IconFile|IconIndex)\s*=/i, OURS = /^\s*IconResource\s*=.*\.folderfrog-\d+\.ico/i;
async function rmIcos(dir, except) {
  for (const f of fs.readdirSync(dir)) if (/^\.folderfrog-\d+\.ico$/.test(f) && f !== except) {
    await sh('attrib', ['-h', path.join(dir, f)]); fs.rmSync(path.join(dir, f), { force: true });
  }
}
// Ubah desktop.ini tanpa menghapus pengaturan lain. newName=null: hapus hanya ikon milik Folder Frog.
async function updateIni(dir, newName) {
  const di = path.join(dir, 'desktop.ini');
  let lines = [], bom = Buffer.alloc(0), enc = 'latin1';
  if (fs.existsSync(di)) {
    await sh('attrib', ['-s', '-h', di]);
    const b = fs.readFileSync(di); let body = b;
    if (b[0] === 0xFF && b[1] === 0xFE) { bom = b.subarray(0, 2); enc = 'utf16le'; body = b.subarray(2); }
    else if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) { bom = b.subarray(0, 3); body = b.subarray(3); }
    lines = body.toString(enc).split(/\r?\n/);
  }
  lines = lines.filter(l => newName ? !ICON.test(l) : !OURS.test(l));
  if (newName) {
    let i = lines.findIndex(l => /^\s*\[\.ShellClassInfo\]\s*$/i.test(l));
    if (i < 0) { lines.unshift('[.ShellClassInfo]'); i = 0; }
    lines.splice(i + 1, 0, `IconResource=${newName},0`);
  }
  if (!lines.some(l => l.trim() && !/^\s*\[\.ShellClassInfo\]\s*$/i.test(l))) { fs.rmSync(di, { force: true }); return false; }
  fs.writeFileSync(di, Buffer.concat([bom, Buffer.from(lines.join('\r\n').replace(/\s*$/, '\r\n'), enc)]));
  await sh('attrib', ['+s', '+h', di]);
  return true;
}
const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

ipcMain.handle('pick', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
async function applyIcon(dir, b64) {
  if (!isDir(dir)) throw new Error('Folder tidak ditemukan');
  const name = `.folderfrog-${Date.now()}.ico`;
  fs.writeFileSync(path.join(dir, name), toIco(Buffer.from(b64, 'base64')));
  await sh('attrib', ['+h', path.join(dir, name)]);
  await updateIni(dir, name);
  await rmIcos(dir, name);
  await sh('attrib', ['+r', dir]);
  await refresh();
  return true;
}
async function resetIcon(dir) {
  if (!isDir(dir)) throw new Error('Folder tidak ditemukan');
  const kept = await updateIni(dir, null);
  await rmIcos(dir);
  if (!kept) await sh('attrib', ['-r', dir]);
  await refresh();
  return true;
}
ipcMain.handle('apply', (_, d, b) => applyIcon(d, b));
ipcMain.handle('reset', (_, d) => resetIcon(d));

const argv = process.argv.slice(1), qi = argv.indexOf('--quick'), ri = argv.indexOf('--reset');
const prefs = () => ({ preload: path.join(__dirname, 'preload.js'), contextIsolation: true });

app.whenReady().then(async () => {
  if (ri > -1) { try { await resetIcon(argv[ri + 1]); } catch {} return app.quit(); }
  if (qi > -1) {   // klik kanan: warnai tanpa membuka jendela
    const [dir, color, label] = argv.slice(qi + 1);
    const w = new BrowserWindow({ show: false, webPreferences: prefs() });
    try {
      await w.loadFile(path.join(__dirname, 'index.html'));
      const b64 = await w.webContents.executeJavaScript(
        `color=${JSON.stringify(color)};$('lab').value=${JSON.stringify(label)};png()`);
      await applyIcon(dir, b64);
    } catch {}
    return app.quit();
  }
  const win = new BrowserWindow({
    width: 1000, height: 760, minWidth: 900, minHeight: 720, autoHideMenuBar: true,
    backgroundColor: '#0d0a1f', icon: path.join(__dirname, 'icon.png'), title: 'Folder Frog',
    webPreferences: prefs()
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  const arg = process.argv.slice(1).find(a => !a.startsWith('-') && isDir(a) && path.resolve(a) !== app.getAppPath());
  if (arg) win.webContents.once('did-finish-load', () => win.webContents.send('open', path.resolve(arg)));
});
app.on('window-all-closed', () => app.quit());
