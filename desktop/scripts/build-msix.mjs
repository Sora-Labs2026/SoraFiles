// Build the Microsoft Store (MSIX) package from the verified Windows release
// staging (the same files NSIS installs). The Store signs the package, so the
// output is unsigned. Explorer command, startup task and identifiers are read
// from the Rust sources so the manifest cannot drift from the app.
//
// node desktop/scripts/build-msix.mjs [releaseDir]
// Identity comes from Partner Center (Product identity):
//   MSIX_IDENTITY_NAME, MSIX_PUBLISHER, MSIX_PUBLISHER_DISPLAY_NAME
import {readFile, writeFile, mkdir, rm, cp, readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const root = resolve(import.meta.dirname, '../..');
const read = path => readFile(join(root, path), 'utf8');

export async function appFacts() {
  const [registration, shell, store, config] = await Promise.all([
    read('desktop/native/src/explorer_registration.rs'), read('desktop/native/src/shell_entry.rs'),
    read('desktop/native/src/store_package.rs'), read('desktop/native/tauri.conf.json')]);
  const clsid = registration.match(/const CLSID: &str = "\{([0-9A-F-]{36})\}"/)?.[1];
  const extensions = [...(shell.match(/const EXTENSIONS: &\[&str\] = &\[([^\]]+)\]/)?.[1] ?? '').matchAll(/"(\.[a-z0-9]+)"/g)].map(m => m[1]);
  const startupTask = store.match(/pub const STARTUP_TASK_ID: &str = "([A-Za-z0-9]+)"/)?.[1];
  const version = JSON.parse(config).version;
  if (!clsid || !extensions.length || !startupTask || !/^\d+\.\d+\.\d+$/.test(version)) throw Error('Could not read app identifiers from source');
  return {clsid, extensions, startupTask, version};
}

// Store packages need a four-part version whose last part is 0.
export const msixVersion = version => `${version}.0`;

const xml = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[c]));

export function manifest({clsid, extensions, startupTask, version}, identity) {
  const types = extensions.map(ext => `            <desktop5:ItemType Type="${ext}"><desktop5:Verb Id="SoraFilesDesktop" Clsid="${clsid}"/></desktop5:ItemType>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:desktop="http://schemas.microsoft.com/appx/manifest/desktop/windows10"
  xmlns:desktop4="http://schemas.microsoft.com/appx/manifest/desktop/windows10/4"
  xmlns:desktop5="http://schemas.microsoft.com/appx/manifest/desktop/windows10/5"
  xmlns:com="http://schemas.microsoft.com/appx/manifest/com/windows10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  IgnorableNamespaces="uap desktop desktop4 desktop5 com rescap">
  <Identity Name="${xml(identity.name)}" Publisher="${xml(identity.publisher)}" Version="${msixVersion(version)}" ProcessorArchitecture="x64"/>
  <Properties>
    <DisplayName>SoraFiles Desktop</DisplayName>
    <PublisherDisplayName>${xml(identity.publisherDisplayName)}</PublisherDisplayName>
    <Logo>Assets\\StoreLogo.png</Logo>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.17763.0" MaxVersionTested="10.0.26100.0"/>
  </Dependencies>
  <Resources>
    <Resource Language="en-us"/>
  </Resources>
  <Applications>
    <Application Id="SoraFilesDesktop" Executable="sorafiles-desktop.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements DisplayName="SoraFiles Desktop" Description="PDF and image tools that work on your computer."
        BackgroundColor="transparent" Square150x150Logo="Assets\\Square150x150Logo.png" Square44x44Logo="Assets\\Square44x44Logo.png">
        <uap:DefaultTile Wide310x150Logo="Assets\\Wide310x150Logo.png"/>
      </uap:VisualElements>
      <Extensions>
        <desktop:Extension Category="windows.startupTask" Executable="sorafiles-desktop.exe" EntryPoint="Windows.FullTrustApplication">
          <desktop:StartupTask TaskId="${startupTask}" Enabled="false" DisplayName="SoraFiles Desktop"/>
        </desktop:Extension>
        <desktop4:Extension Category="windows.fileExplorerContextMenus">
          <desktop4:FileExplorerContextMenus>
${types}
          </desktop4:FileExplorerContextMenus>
        </desktop4:Extension>
        <com:Extension Category="windows.comServer">
          <com:ComServer>
            <com:SurrogateServer DisplayName="SoraFiles Explorer command">
              <com:Class Id="${clsid}" Path="sorafiles-explorer.dll" ThreadingModel="STA"/>
            </com:SurrogateServer>
          </com:ComServer>
        </com:Extension>
      </Extensions>
    </Application>
  </Applications>
  <Capabilities>
    <rescap:Capability Name="runFullTrust"/>
  </Capabilities>
</Package>
`;
}

// Store tiles generated from the real app icon.
async function assets(dir) {
  const {default: sharp} = await import('sharp');
  const icon = join(root, 'public/brand/sorafiles-app-icon-1024.png');
  await mkdir(dir, {recursive: true});
  for (const [name, w, h, pad] of [['Square44x44Logo', 44, 44, 0], ['Square150x150Logo', 150, 150, .12], ['Wide310x150Logo', 310, 150, .12], ['StoreLogo', 50, 50, 0]]) {
    const size = Math.round(Math.min(w, h) * (1 - 2 * pad));
    const tile = await sharp(icon).resize(size, size).png().toBuffer();
    await sharp({create: {width: w, height: h, channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}}})
      .composite([{input: tile, left: Math.round((w - size) / 2), top: Math.round((h - size) / 2)}]).png().toFile(join(dir, `${name}.png`));
  }
}

function makeappx() {
  if (process.env.MAKEAPPX) return process.env.MAKEAPPX;
  const kits = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin';
  const versions = existsSync(kits) ? execFileSync('cmd', ['/c', 'dir', '/b', '/ad', kits], {encoding: 'utf8'}).split(/\r?\n/).filter(v => /^10\./.test(v)) : [];
  for (const version of versions.sort((a, b) => b.localeCompare(a, undefined, {numeric: true}))) {
    const tool = join(kits, version, 'x64', 'makeappx.exe'); if (existsSync(tool)) return tool;
  }
  throw Error('makeappx.exe not found: install the Windows SDK or set MAKEAPPX');
}

async function main() {
  const release = resolve(process.argv[2] || join(root, 'desktop/native/target/x86_64-pc-windows-msvc/release'));
  const facts = await appFacts();
  const identity = {
    name: process.env.MSIX_IDENTITY_NAME || 'SoraLabs.SoraFilesDesktop',
    publisher: process.env.MSIX_PUBLISHER || 'CN=SoraLabsPlaceholder',
    publisherDisplayName: process.env.MSIX_PUBLISHER_DISPLAY_NAME || 'Sora Labs',
  };
  const out = join(root, '.artifacts/msix'), layout = join(out, 'layout');
  await rm(layout, {recursive: true, force: true}); await mkdir(layout, {recursive: true});
  for (const item of ['sorafiles-desktop.exe', 'sorafiles-explorer.dll', 'license-host']) {
    const from = join(release, item);
    if (!existsSync(from)) throw Error(`Missing release payload: ${item}`);
    await cp(from, join(layout, item), {recursive: true});
  }
  await assets(join(layout, 'Assets'));
  await writeFile(join(layout, 'AppxManifest.xml'), manifest(facts, identity));
  const name = `SoraFiles-Desktop-${facts.version}-windows-x64.msix`, pkg = join(out, name);
  execFileSync(makeappx(), ['pack', '/d', layout, '/p', pkg, '/o'], {stdio: 'inherit'});
  const bytes = await readFile(pkg);
  const receipt = {file: name, version: msixVersion(facts.version), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    identity, placeholderIdentity: !process.env.MSIX_IDENTITY_NAME, files: (await readdir(layout, {recursive: true})).length};
  await writeFile(join(out, 'msix-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
