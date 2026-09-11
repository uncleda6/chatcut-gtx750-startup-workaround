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

## Desktop retest (2026-09-11)

A locally imported 4K recording was sampled at source seconds 30–35 on a separate 1080p/30fps timeline. The actual Desktop frontend returned correct composed images at timeline frames 0 and 90. With that timeline selected in the UI, native local export produced 150 H.264 video frames and an AAC track. Independent FFmpeg decoding confirmed the expected pictures at frames 0 and 90, and a full-file blackdetect scan (minimum 0.1 seconds, pixel threshold 0.10, picture threshold 0.98) found no qualifying black intervals. Audio was non-silent; synchronization was not checked.

The first export attempt happened while the UI was still on the original empty timeline. Its one-frame file was excluded from the real-footage test. Tool working-timeline selection did not automatically select the UI preview/export timeline; the user selected the test tab before the valid run.

The standalone reproduction was rerun during the same session. Its source MP4 independently decoded to the expected colored image in FFmpeg, but its native capture and re-export still showed only text over black and logged `decode_failed / D3D11Status::6`. The successful Desktop sample does not resolve this isolated failure or explain the path difference. No installation or driver changes were made during this retest.

## Limits

The test suite validates patch construction, not native renderer compatibility. The real-archive round trip validates this specific build's transformation and recovery, not other builds. The synthetic video diagnostic is hand-authored against Flux 0.7.4 and needs further decoder/model investigation. Real user media was tested only as the 5-second excerpt above. No full one-hour export, audio synchronization, other GPU, or driver change has been tested.
