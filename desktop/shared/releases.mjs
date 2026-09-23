const versionParts=v=>{if(typeof v!=='string'||v.length>48||!/^\d+\.\d+(?:\.\d+){0,2}$/.test(v))throw Error('Invalid version');const parts=v.split('.').map(Number);if(parts.some(p=>!Number.isSafeInteger(p)))throw Error('Invalid version');return parts;};
export const compareVersions=(a,b)=>{const x=versionParts(a),y=versionParts(b);for(let i=0;i<Math.max(x.length,y.length);i++){const d=(x[i]||0)-(y[i]||0);if(d)return Math.sign(d);}return 0;};
export function validateManifest(manifest){
 if(manifest?.schema!==1||!Array.isArray(manifest.releases))throw Error('Invalid release manifest');const seen=new Set();
 for(const r of manifest.releases){const id=[r.version,r.platform,r.arch,r.package,r.distro].join(':');if(seen.has(id))throw Error('Duplicate artifact');seen.add(id);versionParts(r.version);versionParts(r.minOS);if(r.maxOS){versionParts(r.maxOS);if(compareVersions(r.maxOS,r.minOS)<0)throw Error('Invalid OS range');}
  if(!['windows','macos','linux'].includes(r.platform)||!['x64','arm64'].includes(r.arch)||!['active','maintenance','unsupported','blocked'].includes(r.status)||!['clear','blocked'].includes(r.security))throw Error('Invalid release scope');
  const u=new URL(r.url);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||!Number.isSafeInteger(r.bytes)||r.bytes<=0||!/^[a-f0-9]{64}$/.test(r.sha256)||!r.releaseDate||!r.notes||r.tested!==true)throw Error('Incomplete artifact evidence');
  if(r.platform==='macos'){
   const notarized=r.signing==='signed'&&r.notarized===true&&r.installation!=='gatekeeper-approval';
   const manual=r.signing==='ad-hoc'&&r.notarized===false&&r.installation==='gatekeeper-approval'&&r.updaterEligible===false&&r.approvalInstructions==='https://sorafiles.com/desktop/help#macos-open-anyway';
   if(!notarized&&!manual)throw Error('Mac release requires notarization or explicit manual approval instructions');
  }
  if(r.platform==='windows'&&r.signing!=='signed')throw Error('Windows release not signed');
  if(r.updaterEligible&&(!r.updateSignature||r.signing!=='signed'))throw Error('Unsigned update');
  const packages={windows:['msi','exe','msix'],macos:['dmg','pkg'],linux:['deb','rpm','AppImage','tar.gz']};if(!packages[r.platform].includes(r.package)||!['stable','beta'].includes(r.channel))throw Error('Invalid package or release channel');
  if(r.platform==='linux'){if(!/^[a-z][a-z0-9-]{1,30}$/.test(r.distro||'')||r.distro==='universal'||!['glibc','musl'].includes(r.libc))throw Error('Tested Linux distribution/runtime required');versionParts(r.minLibc);}
 }return manifest;
}
export function recommendRelease(manifest,{platform,arch,osVersion,currentVersion,channel='stable',packageType,distro,libc,libcVersion}){
 validateManifest(manifest);if(!platform)return {reason:'choose-platform',release:null};if(!arch)return {reason:'choose-architecture',release:null};
 if(platform==='linux'&&!distro)return {reason:'choose-distribution',release:null};
 if(platform==='linux'&&(!libc||!libcVersion))return {reason:'confirm-linux-runtime',release:null};
 const candidates=manifest.releases.filter(r=>r.platform===platform&&r.arch===arch&&r.channel===channel&&(!packageType||r.package===packageType)&&(platform!=='linux'||r.distro===distro&&r.libc===libc&&compareVersions(libcVersion,r.minLibc)>=0)&&['active','maintenance'].includes(r.status)&&r.security==='clear'&&(!currentVersion||compareVersions(r.version,currentVersion)>0)).sort((a,b)=>compareVersions(b.version,a.version));
 if(!osVersion)return {reason:'confirm-os-version',release:null,candidates};
 const release=candidates.find(r=>compareVersions(osVersion,r.minOS)>=0&&(!r.maxOS||compareVersions(osVersion,r.maxOS)<=0));return {reason:release?(release.installation==='gatekeeper-approval'?'manual-approval-required':'compatible'):'no-safe-compatible-release',release:release||null};
}
