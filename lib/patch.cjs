const crypto = require('node:crypto');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const target = 'node_modules/@chatcut/flux/dist/native-client.js';
const needle = 'const hostArgs = [options.hostScriptPath];';
const replacement = needle + '\n        if (process.platform === "win32") hostArgs.push("--ignore-gpu-blocklist");';

function parseArchive(bytes) {
  if (bytes.length < 16 || bytes.readUInt32LE(0) !== 4) throw new Error('Invalid ASAR prefix');
  const start = 8 + bytes.readUInt32LE(4);
  const end = 16 + bytes.readUInt32LE(12);
  if (end > start || start > bytes.length) throw new Error('Invalid ASAR header bounds');
  const headerBytes = bytes.subarray(16, end);
  return { start, headerBytes, header: JSON.parse(headerBytes.toString('utf8')) };
}
function entryAt(header, path) {
  return path.split('/').reduce((value, key) => value?.files?.[key], header);
}
function packHeader(header) {
  const bytes = Buffer.from(JSON.stringify(header));
  const payloadLength = (4 + bytes.length + 3) & ~3;
  const prefix = Buffer.alloc(12 + payloadLength);
  prefix.writeUInt32LE(4, 0);
  prefix.writeUInt32LE(4 + payloadLength, 4);
  prefix.writeUInt32LE(payloadLength, 8);
  prefix.writeUInt32LE(bytes.length, 12);
  bytes.copy(prefix, 16);
  return prefix;
}
function patchBuffers(archive, originalExe) {
  const { start, headerBytes, header } = parseArchive(archive);
  const entry = entryAt(header, target);
  if (!entry || entry.unpacked || entry.integrity?.algorithm !== 'SHA256') throw new Error('Unexpected target entry');
  const offset = Number(entry.offset), size = entry.size;
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(size) || size < 0 || start+offset+size > archive.length) throw new Error('Invalid target bounds');
  const oldCode = archive.subarray(start+offset, start+offset+size);
  if (sha256(oldCode) !== entry.integrity.hash) throw new Error('Target integrity mismatch');
  const text = oldCode.toString('utf8');
  if (text.includes('--ignore-gpu-blocklist') || text.split(needle).length !== 2) throw new Error('Unexpected or already patched source');
  const newCode = Buffer.from(text.replace(needle, replacement));
  const oldHeaderHash = sha256(headerBytes);
  const oldHashBytes = Buffer.from(oldHeaderHash);
  const digestOffset = originalExe.indexOf(oldHashBytes);
  if (digestOffset < 0 || originalExe.indexOf(oldHashBytes, digestOffset+1) >= 0) throw new Error('Missing or ambiguous EXE integrity digest');
  const blockSize = entry.integrity.blockSize;
  if (!Number.isSafeInteger(blockSize) || blockSize <= 0) throw new Error('Invalid integrity block size');
  function shiftOffsets(tree) {
    for (const value of Object.values(tree.files || {})) {
      if (value.files) shiftOffsets(value);
      else if (!value.unpacked && value.offset !== undefined && Number(value.offset) > offset) value.offset = String(Number(value.offset) + newCode.length-size);
    }
  }
  shiftOffsets(header);
  entry.size = newCode.length;
  entry.integrity.hash = sha256(newCode);
  entry.integrity.blocks = [];
  for (let i=0; i<newCode.length; i+=blockSize) entry.integrity.blocks.push(sha256(newCode.subarray(i,i+blockSize)));
  const prefix = packHeader(header);
  const newArchive = Buffer.concat([prefix, archive.subarray(start,start+offset),newCode,archive.subarray(start+offset+size)]);
  const newHeaderHash = sha256(parseArchive(newArchive).headerBytes);
  const newExe = Buffer.from(originalExe);
  Buffer.from(newHeaderHash).copy(newExe,digestOffset);
  return { archive:newArchive, exe:newExe, oldHeaderHash, newHeaderHash };
}
module.exports = { sha256, target, needle, parseArchive, entryAt, packHeader, patchBuffers };
