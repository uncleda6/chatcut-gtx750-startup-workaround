const test=require('node:test');
const assert=require('node:assert/strict');
const {sha256,target,needle,parseArchive,entryAt,packHeader,patchBuffers}=require('../lib/patch.cjs');
function fixture(){
  const before=Buffer.from('preserve-before'),code=Buffer.from(needle+'\n// synthetic fixture only\n'),after=Buffer.from('preserve-after');
  const blockSize=16;
  const entry={size:code.length,offset:String(before.length),integrity:{algorithm:'SHA256',hash:sha256(code),blockSize,blocks:[]}};
  const header={files:{before:{size:before.length,offset:'0'},node_modules:{files:{'@chatcut':{files:{flux:{files:{dist:{files:{'native-client.js':entry}}}}}}}},after:{size:after.length,offset:String(before.length+code.length)},loose:{size:7,unpacked:true,offset:'999'}}};
  const archive=Buffer.concat([packHeader(header),before,code,after]);
  const digest=sha256(parseArchive(archive).headerBytes);
  const exe=Buffer.from('synthetic-EXE-prefix:'+digest+':preserve-suffix');
  return {archive,exe,before,after};
}
test('patch preserves neighbors, updates offsets and every block hash',()=>{
  const original=fixture(),a=Buffer.from(original.archive),e=Buffer.from(original.exe);
  const result=patchBuffers(a,e);const parsed=parseArchive(result.archive);const entry=entryAt(parsed.header,target);
  const code=result.archive.subarray(parsed.start+Number(entry.offset),parsed.start+Number(entry.offset)+entry.size);
  assert.match(code.toString(),/--ignore-gpu-blocklist/);
  assert.equal(sha256(code),entry.integrity.hash);
  entry.integrity.blocks.forEach((hash,i)=>assert.equal(hash,sha256(code.subarray(i*16,(i+1)*16))));
  assert.deepEqual(result.archive.subarray(parsed.start,parsed.start+original.before.length),original.before);
  const afterOffset=Number(parsed.header.files.after.offset);
  assert.deepEqual(result.archive.subarray(parsed.start+afterOffset),original.after);
  assert.equal(parsed.header.files.loose.offset,'999');
  assert.equal(result.exe.length,e.length);
  assert.ok(result.exe.includes(Buffer.from(result.newHeaderHash)));
  assert.ok(!result.exe.includes(Buffer.from(result.oldHeaderHash)));
  assert.deepEqual(a,original.archive);assert.deepEqual(e,original.exe);
});
test('refuses already patched input',()=>{const f=fixture(),r=patchBuffers(f.archive,f.exe);assert.throws(()=>patchBuffers(r.archive,r.exe),/already patched/);});
test('refuses corrupt target content',()=>{const f=fixture(),p=parseArchive(f.archive),e=entryAt(p.header,target);f.archive[p.start+Number(e.offset)]^=1;assert.throws(()=>patchBuffers(f.archive,f.exe),/integrity mismatch/);});
test('refuses missing EXE digest',()=>{const f=fixture();assert.throws(()=>patchBuffers(f.archive,Buffer.from('unrelated')),/Missing/);});
test('refuses duplicate EXE digest',()=>{const f=fixture();assert.throws(()=>patchBuffers(f.archive,Buffer.concat([f.exe,f.exe])),/ambiguous/);});
test('refuses truncated archive',()=>assert.throws(()=>parseArchive(Buffer.alloc(4)),/Invalid/));
test('refuses header outside archive',()=>{const f=fixture();f.archive.writeUInt32LE(0xffffffff,4);assert.throws(()=>parseArchive(f.archive),/bounds/);});
