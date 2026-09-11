# ChatCut 0.3.16 + GTX 750: startup workaround and Desktop retest

[中文说明](README.zh-CN.md)

**Experimental community report. Startup works on one tested machine, and a 5-second real-footage Desktop preview/export test passed. The isolated synthetic decoder failure still reproduces. This is not a complete repair or a CPU-only mode.**

ChatCut Desktop 0.3.16 stopped at “ChatCut 无法验证图形支持” on Windows 11 with an NVIDIA GeForce GTX 750. Its native graphics probe reported `graphite-blocklisted`, matching Chromium GPU blocklist entries **38 and 40**. Adding `--ignore-gpu-blocklist` to the native rendering host's launch arguments allowed the unmodified graphics probe to return `supported:true` and Desktop to reach its login screen.

Separately, a hand-authored standalone native-host diagnostic produced a black video layer and `video-decoder / decode_failed / D3D11Status::6`. Its successful API responses did **not** prove correct pictures. This is an unresolved diagnostic result, not evidence that Desktop's normal export workflow fails.

**Retest, 2026-09-11:** a 5-second excerpt from a locally imported 4K recording displayed correctly in Desktop and exported as 1080p H.264 with 150 video frames and an AAC audio track. Exported frames were visually checked, and an FFmpeg black-frame scan found no qualifying black intervals. In the same session, the standalone synthetic test still produced a black video layer. These are different test paths; the result does not establish why they differ or validate the full recording.

## Scope and evidence

| Check | Observed result |
| --- | --- |
| Original installation integrity check | Healthy |
| Original native graphics probe | `graphite-blocklisted`, entries 38, 40 |
| Patched native graphics probe | `supported:true` |
| Patched Desktop startup | Normal Chinese Welcome/login page |
| Solid-color frame rendering and Chinese text | Observed in diagnostic PNGs |
| 2-second, 60-frame, 1920×1080 H.264 export | API returned success |
| Isolated synthetic video-layer correctness | **Failed again: black layer with hardware decoder error** |
| Real 4K footage, 5-second Desktop timeline sample | **Preview and 1080p export passed visual checks** |
| Full one-hour training video, audio sync, other GPUs | **Not tested** |

See [the bug report](docs/BUG_REPORT.md), [sanitized diagnostic evidence](evidence/diagnostics.json), and [the native reproduction script](scripts/reproduce.cjs).

Only community-authored scripts, documentation, and selected diagnostic fields are distributed. There are no ChatCut executables, ASAR archives, native modules, private project files, full telemetry logs, credentials, or original vendor backups in this repository. This is not an official ChatCut release or a claim that its desktop application's source is open-source.

## Why this is experimental

- `--ignore-gpu-blocklist` overrides native-host GPU blocklist restrictions more broadly than just the observed Graphite entry. Driver instability or incorrect rendering is possible; this is a debugging workaround, not a recommended production setting.
- The patch rewrites the application's ASAR and its executable's expected ASAR-header digest. The resulting EXE **no longer has a valid original publisher Authenticode signature**.
- Archive checksums and runtime checks still execute against the modified build, but that does not make the modified files vendor-authenticated.
- Authentication, paid features, and account permissions are not changed. The native renderer and probe binaries are not changed.
- Official updates can replace the patch. Keep the original backups. Prefer a vendor-supported fix when available.

## Requirements

Windows, Node.js 18 or newer, an existing legitimate ChatCut installation, and write access to that installation. Obtain ChatCut from its [official Desktop guide](https://chatcut.io/docs/desktop-app). No dependencies or package installation are needed for these scripts.

The public patcher supports only the **exact tested Windows 0.3.16 build**, verified by full-file SHA-256 hashes of both original files:

| Original file | SHA-256 |
| --- | --- |
| `resources/app.asar` | `125f54eec60cf512bdc56d0fcce1c395a6484c2e242538c0503fbcfcde4dd475` |
| `ChatCut.exe` | `d7240ec67ab1ab81406735d10418722b42422f72f95f5c49ac504c84759cc527` |

Another download with the same version label may still differ. The patcher will refuse it; do not remove those checks to try another build.

## Inspect, apply, restore

Inspect is read-only and is the default. It never patches anything:

```powershell
node scripts/chatcut-compat.cjs inspect --install-dir "D:\ChatCut"
```

Close ChatCut completely before applying or restoring. Review the limitations above before explicitly running:

```powershell
node scripts/chatcut-compat.cjs apply --install-dir "D:\ChatCut"
```

The default backup directory is next to the installation, e.g. `D:\ChatCut.backup-0.3.16`. `--backup-dir PATH` selects another separate, non-nested directory. Existing backups are never overwritten. The tool verifies originals, creates and verifies backups, writes a recovery record, then changes the two installed files. It attempts rollback on a write failure. A power loss between writes is not atomic; keep the backups and recovery record.

Restore with the same installation and backup paths:

```powershell
node scripts/chatcut-compat.cjs restore --install-dir "D:\ChatCut"
```

Restore checks backup fingerprints and refuses unrelated updated files. It also restores the original startup limitation. The tool does not launch or kill ChatCut automatically, change drivers, or create persistent environment variables.

## Reproduce the standalone diagnostic anomaly

This diagnostic calls the native host from your local installation without signing in, importing user footage, or uploading anything. It generates synthetic footage in a new output directory. It does not modify the installation:

```powershell
node scripts/reproduce.cjs "D:\ChatCut" ".\output\baseline"
node scripts/reproduce.cjs "D:\ChatCut" ".\output\override" --ignore-gpu-blocklist
```

The generated files and raw local logs are ignored by Git. **Review the actual PNGs/video and `events.jsonl`; an `ok:true` response is insufficient.** The diagnostic is tied to the bundled Flux 0.7.4 API and its hand-authored synthetic project; it is not proof that every user clip fails. Inspect/sanitize local paths and identifiers before sharing additional logs.

## Maintainer direction

An upstream repair should provide a supported compatibility path, identify the failing decoder path, and propagate missing-layer/decoder errors to preview/export results. Simply treating the probe as successful or suppressing the warning is not a correctness fix. [Suggested investigation](docs/BUG_REPORT.md#questions-for-maintainers).

Run the synthetic archive/checksum regression tests with `npm test`. These tests require no ChatCut files and do not certify GPU compatibility. See [validation details](docs/VALIDATION.md).

## License

The original scripts and documentation in this repository are MIT licensed. That license does not apply to ChatCut or any third-party binaries/source. ChatCut remains the property of its respective owners. No affiliation or endorsement is implied.
