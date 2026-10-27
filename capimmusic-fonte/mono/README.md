# CapimMusic
Player de música em preto e branco para Windows e Linux (Electron). YouTube, YouTube Music, SoundCloud, Audius, Spotify (importação), links de +1000 sites e arquivos locais.

## Rodar e gerar os instaladores
    npm install
    node fetch-ytdlp.js        # baixa o yt-dlp (Windows e Linux) para ./bin
    npm start                  # abre o app
    npm run dist               # gera os instaladores da plataforma atual (dist/)

Windows: `CapimMusic-Setup.exe` e `CapimMusic-Portable.exe` (compile no Windows). Linux: `CapimMusic-Linux.AppImage` e `.deb`.

## Dados
Perfis ficam em arquivos JSON na pasta de dados do app (`profiles/`). Login por e-mail ou "só neste PC"; nada vai para servidores.

## Publicar
1. Suba em github.com/capimmm/CapimMusic (ou ajuste `build.publish` no package.json e `REPO` no site).
2. `git tag v2.0.0 && git push --tags` — o GitHub Actions compila Windows e Linux e cria a release.
3. O instalador (e o AppImage) se atualizam sozinhos a cada nova release.

## Testes
`CAPIM_SMOKE=1 xvfb-run -a npx electron . --no-sandbox` roda um teste de ponta a ponta da interface (veja smoke.js).
