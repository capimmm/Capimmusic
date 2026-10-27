// Teste de ponta a ponta (só com CAPIM_SMOKE=1|2): percorre login, busca, reprodução, perfis, responsivo
module.exports = win => {
  const wc = win.webContents, errs = [], out = {}, fs = require('fs'), ph = process.env.CAPIM_SMOKE;
  const wait = ms => new Promise(r => setTimeout(r, ms)), ex = s => wc.executeJavaScript(s).catch(e => (errs.push('EXEC ' + e.message), null));
  const shot = async n => fs.writeFileSync(`/tmp/${n}.png`, (await wc.capturePage()).toPNG());
  wc.on('console-message', (_, l, m, line, src) => { if (l >= 2 && !/Electron Security/.test(m)) errs.push(`${m.slice(0, 160)} (${String(src).split('/').pop()}:${line})`); });
  const done = () => { console.log('SMOKE_RESULT=' + JSON.stringify({ out, errs })); require('electron').app.exit(0); };
  wc.on('did-finish-load', async () => {
    const u = wc.getURL().split('/').pop().split('?')[0]; await wait(1600);
    if (u === 'login.html') {
      out.loginPage = true; await shot('L1');
      await ex(`document.querySelector('#em').value='teste@exemplo.com';document.querySelector('#nm').value='Teste';document.querySelector('#n0').click()`); await wait(1300); await shot('L2');
      await ex(`document.querySelector('#n1').click()`); await wait(1300); await shot('L3');
      await ex(`document.querySelector('#go').click()`); return;
    }
    out.indexPage = true; out.profile = await ex(`SES.meta.email`);
    if (ph === '2') { out.restoredLikes = await ex(`S.likes.length`); out.restoredPls = await ex(`Object.keys(S.pls).join()`); out.restoredTrack = await ex(`cur()?cur().title:null`); await shot('P2'); return done(); }
    await wait(2500); out.shelves = await ex(`document.querySelectorAll('#sh0 .card[data-i]').length`); await shot('H1');
    await ex(`nav('s');$('#qi').value='teste';search()`); await wait(2500); out.results = await ex(`document.querySelectorAll('#rs .r').length`); await shot('S1');
    await ex(`document.querySelector('#rs .r').click()`); await wait(3500);
    out.play = await ex(`({paused:A.paused,t:+A.currentTime.toFixed(2),d:+A.duration.toFixed(1),err:A.error&&A.error.message,title:$('#tt').textContent})`);
    out.viz = await ex(`(()=>{an.getByteFrequencyData(data);return data.reduce((a,b)=>a+b,0)})()`);
    await ex(`document.querySelector('#rs .r .h').click();S.pls={Favoritas:[cur()]};sav()`); await wait(900);
    await ex(`$('#npb').click()`); await wait(1800); await shot('N1'); await ex(`$('#cl').click()`);
    await ex(`nav('lib')`); await wait(1200); await shot('B1'); await ex(`nav('c')`); await wait(1200); await shot('C1'); await ex(`nav('h')`);
    win.setSize(900, 700); await wait(1200); await shot('R900');
    win.setSize(420, 820); await wait(1200); await ex(`nav('s')`); await wait(900); await shot('R420'); await ex(`$('#npb').click()`); await wait(1500); await shot('R420n');
    out.profileFile = fs.readdirSync(require('path').join(require('electron').app.getPath('userData'), 'profiles'));
    out.saved = JSON.parse(fs.readFileSync(require('path').join(require('electron').app.getPath('userData'), 'profiles', out.profileFile[0]), 'utf8')).data.likes;
    done();
  });
};
