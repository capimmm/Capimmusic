const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, screen, shell } = require('electron');
const path = require('path'), fs = require('fs'), https = require('https'), crypto = require('crypto'), { pathToFileURL } = require('url');
const { execFile } = require('child_process');
const WIN = process.platform === 'win32';
app.commandLine.appendSwitch('enable-features', 'HardwareMediaKeyHandling,MediaSessionService');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
if (!app.requestSingleInstanceLock()) app.quit();
let yt, win, dl, tray, trayOK = false, toTray = true, quitting = false, isMax = false, prevB; const cache = new Map(), shelves = new Map();

// ---------- yt-dlp (embutido no app; renova a cada 7 dias) ----------
const EXE = WIN ? 'yt-dlp.exe' : 'yt-dlp';
const BIN = () => process.env.CAPIM_YTDLP || path.join(app.getPath('userData'), EXE);
const BUNDLED = () => path.join(process.resourcesPath, EXE);
function download(url, dest, cb) {
  https.get(url, { headers: { 'User-Agent': 'capimmusic' } }, r => {
    if (r.statusCode >= 300 && r.statusCode < 400) return download(r.headers.location, dest, cb);
    const f = fs.createWriteStream(dest); r.pipe(f); f.on('finish', () => f.close(cb));
  }).on('error', cb);
}
const ensureDlp = () => dl ||= new Promise(res => {
  if (process.env.CAPIM_YTDLP) return res();
  const b = BIN(); if (!fs.existsSync(b) && fs.existsSync(BUNDLED())) { try { fs.copyFileSync(BUNDLED(), b); fs.chmodSync(b, 0o755) } catch {} }
  if (fs.existsSync(b) && Date.now() - fs.statSync(b).mtimeMs < 6048e5) return res();
  download('https://github.com/yt-dlp/yt-dlp/releases/latest/download/' + (WIN ? 'yt-dlp.exe' : 'yt-dlp_linux'), b + '.tmp', err => {
    try { if (!err && fs.statSync(b + '.tmp').size > 1e6) { fs.renameSync(b + '.tmp', b); fs.chmodSync(b, 0o755) } } catch {} res(); });
});
const run = a => new Promise((res, rej) => execFile(BIN(), a, { maxBuffer: 1 << 26, windowsHide: true }, (e, o, se) => e ? rej(new Error((se || '').trim().split('\n').pop() || e.message)) : res(o)));

// ---------- fontes de música ----------
const ent = e => ({ u: e.url || e.webpage_url || e.original_url, title: e.title, artist: e.channel || e.uploader || e.artist || '',
  thumb: e.thumbnail || e.thumbnails?.at(-1)?.url || (/^[\w-]{11}$/.test(e.id || '') ? `https://i.ytimg.com/vi/${e.id}/mqdefault.jpg` : undefined), dur: e.duration || 0 });
const flat = async t => { await ensureDlp(); const j = JSON.parse(await run([t, '--flat-playlist', '-J', '--no-warnings']));
  return (j.entries || [j]).filter(Boolean).map(ent).filter(x => x.u); };
ipcMain.handle('yt', (_, q) => flat('ytsearch20:' + q));
ipcMain.handle('sc', (_, q) => flat('scsearch20:' + q));
ipcMain.handle('url', (_, u) => flat(u));
ipcMain.handle('shelf', async (_, q) => { const c = shelves.get(q); if (c && Date.now() - c.at < 36e5) return c.v; const v = await flat(q); shelves.set(q, { v, at: Date.now() }); return v; });
ipcMain.handle('ytm', async (_, q) => {
  try {
    yt ||= await (await import('youtubei.js')).Innertube.create();
    const r = await yt.music.search(q, { type: 'song' });
    const l = (r.contents?.[0]?.contents || []).filter(i => i.id).map(i => ({ u: 'https://music.youtube.com/watch?v=' + i.id, title: i.title,
      artist: (i.artists || []).map(a => a.name).join(', ') || i.author?.name || '', thumb: i.thumbnails?.at(-1)?.url, dur: i.duration?.seconds || 0 }));
    if (l.length) return l;
  } catch {}
  return flat('ytsearch20:' + q + ' audio');          // plano B se o YT Music mudar o formato
});
ipcMain.handle('au', async (_, q) => {
  const r = await (await fetch('https://api.audius.co/v1/tracks/search?app_name=capimmusic&limit=20&query=' + encodeURIComponent(q))).json();
  return (r.data || []).map(t => ({ u: `https://api.audius.co/v1/tracks/${t.id}/stream?app_name=capimmusic`, direct: 1, title: t.title, artist: t.user?.name, thumb: t.artwork?.['480x480'], dur: t.duration }));
});
ipcMain.handle('stream', async (_, t) => {
  if (t.direct) return t.u;
  const k = t.u || t.q, c = cache.get(k);
  if (c && Date.now() - c.at < 108e5) return c.v;
  await ensureDlp();
  const get = x => run(['-g', '-f', 'bestaudio[ext=m4a][protocol=https]/bestaudio[protocol=https]/bestaudio[protocol=http]/bestaudio/best', '--no-playlist', '--no-warnings', x]).then(o => o.split('\n')[0].trim());
  let v; try { v = await get(t.u || 'ytsearch1:' + t.q); }
  catch (e) { if (!t.title) throw e; v = await get(`ytsearch1:${t.artist || ''} ${t.title} audio`); }
  if (!v) throw new Error('sem áudio'); cache.set(k, { v, at: Date.now() }); return v;
});
ipcMain.handle('lyr', async (_, { title, artist }) => {
  const cl = s => (s || '').replace(/\(.*?\)|\[.*?\]|official.*|lyrics?|video.*|- topic/gi, '').trim();
  for (const q of [`${cl(artist)} ${cl(title)}`, cl(title)]) {
    try { const r = await (await fetch('https://lrclib.net/api/search?q=' + encodeURIComponent(q))).json();
      const b = r.find(x => x.syncedLyrics) || r.find(x => x.plainLyrics); if (b) return { synced: b.syncedLyrics, plain: b.plainLyrics }; } catch {}
  } return null;
});
const spToken = async (id, secret) => (await (await fetch('https://accounts.spotify.com/api/token', { method: 'POST',
  headers: { Authorization: 'Basic ' + Buffer.from(id + ':' + secret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' })).json()).access_token;
ipcMain.handle('sptest', async (_, { id, secret }) => { try { return !!(id && secret && await spToken(id, secret)) } catch { return false } });
const spApi = async (type, sid, id, secret) => {
  const tk = await spToken(id, secret); if (!tk) throw new Error('Credenciais inválidas');
  const g = async u => (await fetch(u.startsWith('http') ? u : 'https://api.spotify.com/v1' + u, { headers: { Authorization: 'Bearer ' + tk } })).json();
  const n = (x, img) => { const im = x.album?.images || img || [];
    return { title: x.name, artist: x.artists.map(a => a.name).join(', '), thumb: im[1]?.url || im[0]?.url, dur: x.duration_ms / 1e3, q: `${x.artists[0].name} ${x.name} audio` }; };
  let out = [];
  if (type === 'track') out = [n(await g('/tracks/' + sid))];
  else if (type === 'album') { const a = await g('/albums/' + sid); out = a.tracks.items.map(x => n(x, a.images)); }
  else { let u = `/playlists/${sid}/tracks?limit=100`; while (u) { const p = await g(u); out.push(...(p.items || []).filter(i => i.track).map(i => n(i.track))); u = p.next; } }
  if (!out.length) throw new Error('vazio'); return out;
};
const spEmbed = async (type, sid) => {
  const h = await (await fetch(`https://open.spotify.com/embed/${type}/${sid}`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
  const m = h.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/); if (!m) throw new Error('Não consegui ler esse link do Spotify');
  const e = JSON.parse(m[1]).props.pageProps.state.data.entity, img = e.coverArt?.sources || e.visualIdentity?.image || [], th = img.at(-1)?.url || img[0]?.url;
  return (e.trackList || [{ title: e.name || e.title, subtitle: (e.artists || []).map(a => a.name).join(', '), duration: e.duration }])
    .map(x => ({ title: x.title, artist: x.subtitle, thumb: th, dur: (x.duration || 0) / 1e3, q: `${x.subtitle} ${x.title} audio` }));
};
ipcMain.handle('sp', async (_, { url, id, secret }) => {
  const m = url.match(/(track|album|playlist)\/([A-Za-z0-9]+)/); if (!m) throw new Error('Link do Spotify inválido');
  if (id && secret) { try { return await spApi(m[1], m[2], id, secret) } catch {} }
  return spEmbed(m[1], m[2]);
});
ipcMain.handle('files', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Áudio', extensions: ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'opus', 'aac'] }] });
  return r.filePaths.map(p => ({ u: pathToFileURL(p).href, direct: 1, title: path.parse(p).name, artist: 'Arquivo local', dur: 0 }));
});

// ---------- perfis salvos no PC (login por e-mail ou "só neste PC") ----------
const PD = () => { const d = path.join(app.getPath('userData'), 'profiles'); fs.mkdirSync(d, { recursive: true }); return d; };
const SF = () => path.join(app.getPath('userData'), 'session.json'), pf = id => path.join(PD(), id + '.json');
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return d } };
const wr = (f, o) => { fs.writeFileSync(f + '.tmp', JSON.stringify(o)); fs.renameSync(f + '.tmp', f); };
const active = () => { const s = rd(SF(), null); return s && rd(pf(s.id), null); };
ipcMain.on('sess:get', e => { e.returnValue = active(); });
ipcMain.handle('sess:login', (_, { email, name }) => {
  const em = (email || '').trim().toLowerCase(), id = em ? crypto.createHash('sha1').update(em).digest('hex').slice(0, 12) : 'local';
  const p = rd(pf(id), null) || { meta: { id, email: em || null, name: (name || '').trim() || (em ? em.split('@')[0] : 'Este PC'), created: Date.now() }, data: {} };
  if (name && name.trim() && em) p.meta.name = name.trim();
  wr(pf(id), p); wr(SF(), { id }); return p.meta;
});
ipcMain.handle('sess:save', (_, d) => { const s = rd(SF(), null), p = s && rd(pf(s.id), null); if (!p) return false; p.data = { ...p.data, ...d }; wr(pf(s.id), p); return true; });
ipcMain.handle('sess:logout', () => { try { fs.unlinkSync(SF()) } catch {} return true; });
ipcMain.handle('sess:list', () => fs.readdirSync(PD()).filter(f => f.endsWith('.json')).map(f => rd(path.join(PD(), f), null)?.meta).filter(Boolean));
ipcMain.handle('sess:dir', () => PD());

// ---------- janela sem borda, arredondada ----------
ipcMain.handle('ext', (_, u) => /^https:\/\//.test(u) && shell.openExternal(u));
ipcMain.handle('top', () => (win.setAlwaysOnTop(!win.isAlwaysOnTop()), win.isAlwaysOnTop()));
ipcMain.handle('tray', (_, v) => (toTray = !!v));
ipcMain.handle('win', (_, o) => {
  switch (o.c) {
    case 'min': win.minimize(); break;
    case 'close': win.close(); break;
    case 'state': return isMax;
    case 'max': if (isMax) { win.setBounds(prevB); isMax = false; } else { prevB = win.getBounds(); win.setBounds(screen.getDisplayMatching(prevB).workArea); isMax = true; } win.webContents.send('max', isMax); break;
    case 'bounds': { const [mw, mh] = win.getMinimumSize(); win.setBounds({ x: Math.round(o.x), y: Math.round(o.y), width: Math.max(mw, Math.round(o.w)), height: Math.max(mh, Math.round(o.h)) });
      if (isMax) { isMax = false; win.webContents.send('max', false); } break; }
  }
});
function mkTray() {
  let img = nativeImage.createFromPath(path.join(__dirname, WIN ? 'icon.ico' : 'icon.png')); if (!WIN) img = img.resize({ width: 22, height: 22 });
  tray = new Tray(img); tray.setToolTip('CapimMusic'); const send = c => win.webContents.send('cmd', c);
  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Abrir', click: () => { win.show(); win.focus(); } }, { label: 'Play / Pause', click: () => send('toggle') },
    { label: 'Próxima', click: () => send('next') }, { label: 'Anterior', click: () => send('prev') }, { type: 'separator' }, { label: 'Sair', click: () => { quitting = true; app.quit(); } }]));
  tray.on('click', () => { win.show(); win.focus(); }); trayOK = true;
}
app.whenReady().then(() => {
  Menu.setApplicationMenu(null); ensureDlp();
  win = new BrowserWindow({ width: 1280, height: 820, minWidth: 380, minHeight: 560, frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false,
    icon: path.join(__dirname, WIN ? 'icon.ico' : 'icon.png'), title: 'CapimMusic',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false, webSecurity: false } });
  win.loadFile(active() ? 'index.html' : 'login.html');
  win.on('close', e => { if (trayOK && toTray && !quitting) { e.preventDefault(); win.hide(); } });
  try { mkTray(); } catch {}
  if (process.env.CAPIM_SMOKE) try { require('./smoke')(win); } catch (e) { console.log('smoke', e); }
  if (app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR) try { require('electron-updater').autoUpdater.checkForUpdatesAndNotify().catch(() => {}); } catch {}
});
app.on('second-instance', () => win && (win.show(), win.isMinimized() && win.restore(), win.focus()));
app.on('before-quit', () => quitting = true);
app.on('window-all-closed', () => app.quit());
