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

async function clean(dir) {
  const di = path.join(dir, 'desktop.ini');
  if (fs.existsSync(di)) { await sh('attrib', ['-s', '-h', di]); fs.rmSync(di, { force: true }); }
  for (const f of fs.readdirSync(dir)) if (/^\.folderfrog-\d+\.ico$/.test(f)) {
    await sh('attrib', ['-h', path.join(dir, f)]); fs.rmSync(path.join(dir, f), { force: true });
  }
}
const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

ipcMain.handle('pick', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('apply', async (_, dir, b64) => {
  if (!isDir(dir)) throw new Error('Folder tidak ditemukan');
  await clean(dir);
  const name = `.folderfrog-${Date.now()}.ico`, di = path.join(dir, 'desktop.ini');
  fs.writeFileSync(path.join(dir, name), toIco(Buffer.from(b64, 'base64')));
  fs.writeFileSync(di, `[.ShellClassInfo]\r\nIconResource=${name},0\r\n`);
  await sh('attrib', ['+h', path.join(dir, name)]);
  await sh('attrib', ['+s', '+h', di]);
  await sh('attrib', ['+r', dir]);
  await refresh();
  return true;
});
ipcMain.handle('reset', async (_, dir) => {
  if (!isDir(dir)) throw new Error('Folder tidak ditemukan');
  await clean(dir); await sh('attrib', ['-r', dir]); await refresh(); return true;
});

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 980, height: 660, minWidth: 860, minHeight: 600, autoHideMenuBar: true,
    backgroundColor: '#0d0a1f', title: 'Folder Frog',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  const arg = process.argv.slice(1).find(a => !a.startsWith('-') && isDir(a) && path.resolve(a) !== app.getAppPath());
  if (arg) win.webContents.once('did-finish-load', () => win.webContents.send('open', path.resolve(arg)));
});
app.on('window-all-closed', () => app.quit());
