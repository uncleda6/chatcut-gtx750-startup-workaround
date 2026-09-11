# Validation record

## Observed on the affected machine

The original one-machine diagnostic established a failing native graphics check. After a version-specific local host-argument patch, two ordinary Desktop launches reported `installationHealth: healthy` and `graphicsCheck: supported`. The actual rendered page was the Chinese Welcome/login screen.

Synthetic PNGs confirmed basic solid-color and Chinese-text rendering. MP4 export reported 1920×1080, 30 fps, 60 frames. A subsequent video-layer render failed visual review and logged a hardware decoder error. These are separate outcomes; the repository does not claim fully working editing, correct video export, or a CPU fallback.

## Public patcher verification

The packaged CLI was run on a separate copy of the exact original EXE and ASAR, not on the active installation:

1. Read-only inspect recognized both pinned original hashes.
2. Apply created verified backups and applied the patch.
3. The resulting ASAR hash exactly matched the locally tested startup patch: `555c42f09c4d1978d0635cc2d371157e0b59ab9b6a009978ac208b5a3fe57502`.
4. A simulated interrupted state was prepared: patched ASAR plus original EXE.
5. Restore recovered both original files, verified against their pinned SHA-256 hashes.

No vendor files used in that local test are distributed.

The packaged `scripts/reproduce.cjs` was also run locally in baseline and blocklist-override modes. Baseline reproduced entries 38/40. Override returned successful capture/export responses but reproduced a visually black video layer and the same decoder warning. Generated outputs and raw logs were excluded from the publication.

## Automated tests

Seven dependency-free tests use synthetic archive/EXE buffers. They cover:

- neighboring file content, shifted offsets, unchanged unpacked metadata, updated entry/block hashes, updated executable digest, and unmodified input buffers;
- rejection of already patched source;
- rejection of corrupt target content;
- rejection of missing and duplicate executable archive digests;
- rejection of truncated archives and invalid header bounds.

Run `node --test test/patch.test.cjs` or `npm test`. All seven passed locally. GitHub Actions runs the same synthetic tests and does not download or execute ChatCut.

## Limits

The test suite validates patch construction, not native renderer compatibility. The real-archive round trip validates this specific build's transformation and recovery, not other builds. The synthetic video diagnostic is hand-authored against Flux 0.7.4 and needs independent media/decoder validation. No one-hour footage, real user media, audio synchronization, other GPU, or driver change has been tested.
