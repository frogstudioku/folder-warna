const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs'), path = require('path'), { execFile } = require('child_process');

const sh = (cmd, args) => new Promise(r => execFile(cmd, args, { windowsHide: true }, () => r()));
// Akses Windows langsung (cepat). Kalau gagal dimuat, otomatis pakai cara lama (attrib + PowerShell).
let K = null, SHN = null;
try {
  const koffi = require('koffi'), k32 = koffi.load('kernel32.dll'), s32 = koffi.load('shell32.dll');
  K = { get: k32.func('uint32 GetFileAttributesW(str16 p)'), set: k32.func('int SetFileAttributesW(str16 p, uint32 a)') };
  SHN = s32.func('void SHChangeNotify(int32 e, uint32 f, str16 a, str16 b)');
} catch { K = null; SHN = null; }

const A_R = 1, A_H = 2, A_S = 4;
async function attr(p, add = 0, remove = 0) {
  if (K) { const a = K.get(p); if (a !== 0xFFFFFFFF) K.set(p, ((a | add) & ~remove) >>> 0); return; }
  const args = [];
  for (const [bit, c] of [[A_R, 'r'], [A_H, 'h'], [A_S, 's']]) { if (add & bit) args.push('+' + c); if (remove & bit) args.push('-' + c); }
  await sh('attrib', [...args, p]);
}

// Beri tahu Explorer bahwa folder ini berubah, supaya ikon langsung diperbarui.
async function notify(dir) {
  const parent = path.dirname(dir), di = path.join(dir, 'desktop.ini');
  if (SHN) {
    const f = 0x5 | 0x1000;               // SHCNF_PATHW | SHCNF_FLUSH
    SHN(0x800, f, dir, null);             // SHCNE_ATTRIBUTES
    SHN(0x2000, f, di, null);             // SHCNE_UPDATEITEM (desktop.ini)
    SHN(0x2000, f, dir, null);            // SHCNE_UPDATEITEM (folder)
    SHN(0x1000, f, parent, null);         // SHCNE_UPDATEDIR (isi folder induk)
    return;
  }
  const q = x => x.replace(/'/g, "''");
  await sh('powershell', ['-NoProfile', '-Command',
    `Add-Type -MemberDefinition '[DllImport("shell32.dll",CharSet=CharSet.Unicode)] public static extern void SHChangeNotify(int e,int f,string a,string b);' -Name N -Namespace S; $f=0x1005; ` +
    `[S.N]::SHChangeNotify(0x800,$f,'${q(dir)}',$null); [S.N]::SHChangeNotify(0x2000,$f,'${q(di)}',$null); ` +
    `[S.N]::SHChangeNotify(0x2000,$f,'${q(dir)}',$null); [S.N]::SHChangeNotify(0x1000,$f,'${q(parent)}',$null)`]);
}

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
    await attr(path.join(dir, f), 0, A_H); fs.rmSync(path.join(dir, f), { force: true });
  }
}
// Ubah desktop.ini tanpa menghapus pengaturan lain. newName=null: hapus hanya ikon milik Folder Frog.
async function updateIni(dir, newName) {
  const di = path.join(dir, 'desktop.ini');
  let lines = [], bom = Buffer.alloc(0), enc = 'latin1';
  if (fs.existsSync(di)) {
    await attr(di, 0, A_S | A_H);
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
  await attr(di, A_S | A_H);
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
  await attr(path.join(dir, name), A_H);
  await updateIni(dir, name);
  await rmIcos(dir, name);
  await attr(dir, A_R);
  await notify(dir);
  return true;
}
async function resetIcon(dir) {
  if (!isDir(dir)) throw new Error('Folder tidak ditemukan');
  const kept = await updateIni(dir, null);
  await rmIcos(dir);
  if (!kept) await attr(dir, 0, A_R);
  await notify(dir);
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
    width: 1000, height: 720, useContentSize: true, resizable: false, maximizable: false, fullscreenable: false, autoHideMenuBar: true,
    backgroundColor: '#0d0a1f', icon: path.join(__dirname, 'icon.png'), title: 'Folder Frog',
    webPreferences: prefs()
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  const arg = process.argv.slice(1).find(a => !a.startsWith('-') && isDir(a) && path.resolve(a) !== app.getAppPath());
  if (arg) win.webContents.once('did-finish-load', () => win.webContents.send('open', path.resolve(arg)));
});
app.on('window-all-closed', () => app.quit());
