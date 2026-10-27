const https = require('https'), fs = require('fs'); fs.mkdirSync('bin', { recursive: true });
const B = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/';
const get = (u, f) => new Promise(res => https.get(u, { headers: { 'User-Agent': 'capimmusic' } }, r => {
  if (r.statusCode >= 300 && r.statusCode < 400) return get(r.headers.location, f).then(res);
  r.pipe(fs.createWriteStream(f)).on('finish', res); }));
Promise.all([get(B + 'yt-dlp.exe', 'bin/yt-dlp.exe'), get(B + 'yt-dlp_linux', 'bin/yt-dlp_linux')])
  .then(() => { try { fs.chmodSync('bin/yt-dlp_linux', 0o755) } catch {} console.log('yt-dlp ok'); process.exit(0); });
