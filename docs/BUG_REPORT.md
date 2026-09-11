# Desktop 0.3.16: GTX 750 Graphite blocklist prevents startup; patched Desktop sample passes

## Environment

- ChatCut Desktop 0.3.16, official Windows installer; native Flux SDK 0.7.4.
- Windows 11 Pro, OS release 10.0.26200, x64.
- NVIDIA GeForce GTX 750, driver 32.0.15.8266.
- Active UI adapter was the GTX 750, ANGLE D3D11. A remote-display adapter was also installed; its causal role was not established.
- Single tested machine. No driver update, rollback, alternate GPU, or long-project benchmark was performed.

## Reproduction

1. Install the official Windows 0.3.16 build and launch Desktop normally.
2. Observe the graphics-verification dialog before the sign-in/editor workflow.
3. Inspect the `desktop.environment_check` diagnostic in the renderer log.
4. It reports `outcome: check-failed`, `native_error_code: graphite-blocklisted`, `native_error_source: gpu-blocklist`, with matched entries 38 and 40. Repeated retries returned the same result.
5. The installation-health check is `healthy`; changing the installation drive did not explain the failure.

Visible message: “ChatCut 无法验证图形支持” (ChatCut could not verify graphics support). The dialog says preview and export availability cannot be confirmed and offers Retry, Copy details, and Exit.

## Expected / actual

Expected: a supported graphics path when available, or an actionable explanation of the incompatible backend/adapter. If rendering skips a video layer because decoding fails, preview/export should surface that failure reliably.

Actual: startup was blocked. After a native-host blocklist override, Desktop reached login, but the subsequent synthetic video test produced a black video layer despite success responses from frame capture and MP4 export.

## Working startup-only workaround

Modify the Flux client host-launch arguments inside the installed archive to pass `--ignore-gpu-blocklist` on Windows. Update the modified archive's entry hashes and the executable's expected archive-header digest together. This does not modify the native probe's return value: it runs and reports `supported:true` under the overridden configuration.

The broader GPU blocklist override and modified executable are unsuitable as a general production recommendation. This repository provides an explicit, version-pinned experimental patcher and rollback, not a vendor-approved repair. Full-file original fingerprints are documented in the README.

## Separate standalone diagnostic anomaly

The local synthetic test creates red/blue frames, exports a two-second 1920×1080/30fps H.264 clip, then uses that clip as a video layer beneath Chinese text in another native render model.

This hand-authored diagnostic does not use Desktop's normal project/export workflow. Its anomaly is not a confirmed Desktop export defect; the real-footage Desktop export below passed.

- Frame capture and MP4 export returned `ok:true`, and export reported 60 frames.
- Visual inspection found the expected colored video background missing.
- A native warning reported a skipped pixel layer: `source=video-decoder`, `code=decode_failed`, `DecoderStatus::1`, `D3D11Status::6`, `VDA Error: 0`.
- The precise hardware/driver/decoder cause is **not established**. A later FFmpeg software decode displayed the generated source's expected blue frame, while the native re-export remained black beneath the text. The hand-authored render model and native decoder path still need investigation. Do not generalize this result to all media or all GTX 750 systems.

## Desktop real-footage retest (2026-09-11)

On the same patched installation, an imported 3840x2160 recording was placed on a separate 1920x1080/30fps timeline: source seconds 30–35, 150 timeline frames. After the user selected that timeline in Desktop, frontend preview frames 0 and 90 showed the expected source imagery. Desktop local export produced 150 H.264 frames (4.999933 seconds) and an AAC track (5.013312 seconds). FFmpeg independently decoded the exported frames, which passed visual review. A full-file `blackdetect=d=0.1:pix_th=0.10:pic_th=0.98` scan found no qualifying black intervals; the audio contained non-silent signal. Audio synchronization and the full recording were not verified.

The standalone synthetic test still failed in the same session. The difference between the Desktop media path and the hand-authored standalone test has not been isolated. Source footage, screenshots, filenames and private project identifiers are not distributed.

## Other attempts and their limits

- Selecting a D3D11 Graphite backend alone did not clear the startup block.
- Editing the loose native-host entry script caused `file_size_mismatch`. That attempt was reverted before creating the archive patch.
- A process-scoped NODE_OPTIONS launcher worked for an isolated host but did not clear Desktop's original check. The ineffective launcher was removed.
- Isolated attempts with `--disable-accelerated-video-decode`, `--disable-features=D3D11VideoDecoder`, and `--disable_d3d11_video_decoder` still logged the video failure. They are not included in the installed startup patch.
- A public CPU-only mode was not established by the documentation or these tests. This is not a claim that implementing one is impossible.

## Questions for maintainers

1. Are blocklist entries 38 and 40 intended to prohibit this entire Desktop workflow on the GTX 750, or only selected rendering paths?
2. Could Desktop expose a supported backend/fallback setting and pass it consistently to native probe, playback, and export hosts?
3. Why does this H.264 test reach a D3D11 decoder failure, and can an appropriate software decoder fallback be selected?
4. Should missing video layers set a failed/incomplete export result rather than a successful result?

Additional evidence: [sanitized diagnostics](../evidence/diagnostics.json). No report was automatically sent to vendor support or an upstream issue tracker by these scripts.
