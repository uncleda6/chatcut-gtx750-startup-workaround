#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { sha256, patchBuffers } = require('../lib/patch.cjs');
const ORIGINAL = {
  archive: '125f54eec60cf512bdc56d0fcce1c395a6484c2e242538c0503fbcfcde4dd475',
  exe: 'd7240ec67ab1ab81406735d10418722b42422f72f95f5c49ac504c84759cc527',
};
const args = process.argv.slice(2);
const command = args.shift() || 'inspect';
const options = {};
for (let i=0; i<args.length; i+=2) {
  if (!['--install-dir','--backup-dir'].includes(args[i]) || !args[i+1]) throw new Error('Use --install-dir PATH and optionally --backup-dir PATH');
  options[args[i]] = args[i+1];
}
const install = path.resolve(options['--install-dir'] || 'D:/ChatCut');
const backup = path.resolve(options['--backup-dir'] || path.join(path.dirname(install),path.basename(install)+'.backup-0.3.16'));
const installedPaths = {archive:path.join(install,'resources','app.asar'),exe:path.join(install,'ChatCut.exe')};
const backupPaths = {archive:path.join(backup,'app.asar'),exe:path.join(backup,'ChatCut.exe')};
const recordPath = path.join(backup,'patch-state.json');
const hashes = buffers => Object.fromEntries(Object.entries(buffers).map(([key,value])=>[key,sha256(value)]));
const readPair = paths => Object.fromEntries(Object.entries(paths).map(([key,value])=>[key,fs.readFileSync(value)]));
function isInside(child,parent) {
  const relative=path.relative(parent,child);
  return relative === '' || (!relative.startsWith('..'+path.sep) && relative !== '..' && !path.isAbsolute(relative));
}
function requireClosed() {
  if (process.platform !== 'win32') throw new Error('Applying/restoring this Windows patch requires Windows');
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"Get-Process -Name ChatCut -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path; exit 0"],{encoding:'utf8',windowsHide:true});
  if (result.error || result.status !== 0) throw new Error('Could not check running ChatCut processes');
  const paths=(result.stdout || '').split(/\r?\n/).filter(Boolean);
  if (paths.some(p=>path.resolve(p).toLowerCase()===installedPaths.exe.toLowerCase())) throw new Error('Close ChatCut at the selected installation before proceeding');
}
function verifyExpected(actual,expected,label) {
  for (const key of ['archive','exe']) if (actual[key]!==expected[key]) throw new Error(label+': unexpected '+key+' SHA256; no files changed');
}
function writePair(buffers) {
  // Originals and the recovery record already exist before either installed file is written.
  // If interrupted between writes, restore accepts each file in either recorded state.
  for (const key of ['archive','exe']) {
    fs.writeFileSync(installedPaths[key],buffers[key]);
    if (sha256(fs.readFileSync(installedPaths[key]))!==sha256(buffers[key])) throw new Error('Write verification failed: '+key+'; run restore');
  }
}
function main() {
  if (!['inspect','apply','restore'].includes(command)) throw new Error('Commands: inspect (default, read-only), apply, restore');
  if (isInside(backup,install) || isInside(install,backup)) throw new Error('Backup and installation must be separate, non-nested directories');
  const current=readPair(installedPaths);
  const currentHashes=hashes(current);
  if (command==='inspect') {
    const exactOriginal=currentHashes.archive===ORIGINAL.archive && currentHashes.exe===ORIGINAL.exe;
    console.log(JSON.stringify({install,backup,exactSupportedOriginal:exactOriginal,sha256:currentHashes,changed:false},null,2));
    return;
  }
  requireClosed();
  if (command==='restore') {
    const state=JSON.parse(fs.readFileSync(recordPath,'utf8'));
    if (state.schemaVersion!==1 || state.install.toLowerCase()!==install.toLowerCase()) throw new Error('Recovery record does not match installation');
    const originals=readPair(backupPaths);
    verifyExpected(hashes(originals),ORIGINAL,'Backup');
    for (const key of ['archive','exe']) if (![ORIGINAL[key],state.patched[key]].includes(currentHashes[key])) throw new Error('Installed file was updated or changed; refusing to replace '+key);
    writePair(originals);
    console.log('Original files restored. The original GPU startup block also returns.');
    return;
  }
  verifyExpected(currentHashes,ORIGINAL,'Only the exact tested ChatCut 0.3.16 Windows build is supported');
  const modified=patchBuffers(current.archive,current.exe);
  const output={archive:modified.archive,exe:modified.exe};
  if (fs.existsSync(backup) && fs.readdirSync(backup).length) throw new Error('Use a new empty backup directory; existing backups are never replaced');
  fs.mkdirSync(backup,{recursive:true});
  for (const key of ['archive','exe']) fs.writeFileSync(backupPaths[key],current[key],{flag:'wx'});
  verifyExpected(hashes(readPair(backupPaths)),ORIGINAL,'Written backup');
  const state={schemaVersion:1,version:'0.3.16',install,original:ORIGINAL,patched:hashes(output),flags:['--ignore-gpu-blocklist']};
  fs.writeFileSync(recordPath,JSON.stringify(state,null,2)+'\n',{flag:'wx'});
  try { writePair(output); }
  catch (error) {
    try { writePair(current); } catch { throw new Error('Patch failed and automatic rollback failed. Retain backups and run restore.'); }
    throw new Error('Patch failed; originals restored: '+error.message);
  }
  console.log('Experimental startup patch applied. Publisher signature is no longer valid. Video decoding remains unresolved.');
  console.log('Verified originals and recovery record: '+backup);
}
try { main(); } catch(error) { console.error(error.message); process.exitCode=1; }
