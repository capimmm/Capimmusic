// Embute o ícone e os metadados no .exe sem precisar de Wine (roda em qualquer sistema)
const fs = require('fs'), path = require('path'), R = require('resedit');
exports.default = async ctx => {
  if (ctx.electronPlatformName !== 'win32') return;
  const p = path.join(ctx.appOutDir, ctx.packager.appInfo.productFilename + '.exe');
  const exe = R.NtExecutable.from(fs.readFileSync(p)), res = R.NtExecutableResource.from(exe);
  const icons = R.Data.IconFile.from(fs.readFileSync(path.join(ctx.packager.projectDir, 'icon.ico'))).icons.map(i => i.data);
  const g = R.Resource.IconGroupEntry.fromEntries(res.entries)[0];
  R.Resource.IconGroupEntry.replaceIconsForResource(res.entries, g ? g.id : 101, g ? g.lang : 1033, icons);
  try { const vi = R.Resource.VersionInfo.fromEntries(res.entries)[0], l = vi.getAvailableLanguages()[0];
    vi.setStringValues(l, { FileDescription: 'CapimMusic', ProductName: 'CapimMusic', CompanyName: 'CapimMusic', LegalCopyright: '© 2026 CapimMusic', OriginalFilename: 'CapimMusic.exe', InternalName: 'CapimMusic' });
    vi.outputToResourceEntries(res.entries); } catch {}
  res.outputResource(exe); fs.writeFileSync(p, Buffer.from(exe.generate()));
};
