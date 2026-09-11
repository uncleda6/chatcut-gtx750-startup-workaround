# ChatCut 0.3.16 / GTX 750 启动兼容问题

**这是社区诊断与实验性启动补丁，不是完整修复，也不是纯 CPU 版。**

在一台 Windows 11、GTX 750 的电脑上，ChatCut 启动时提示“无法验证图形支持”。日志为 `graphite-blocklisted`，命中 Chromium GPU 黑名单条目 38、40。

给本地渲染进程添加 `--ignore-gpu-blocklist` 后，真实图形检查通过，桌面程序进入登录页面。但后续测试视频仍然出现黑色视频层，记录了 `decode_failed` / `D3D11Status::6`。导出接口返回成功，不等于导出的画面正确。

## 发布的内容

- [英文缺陷报告](docs/BUG_REPORT.md)：复现步骤、环境、已知失败、建议调查方向。
- [脱敏诊断信息](evidence/diagnostics.json)：仅保留版本、显卡、错误和验证结论。
- `scripts/chatcut-compat.cjs`：只适用于已验证原始文件哈希的 0.3.16 Windows 构建；默认只读检查。
- `scripts/reproduce.cjs`：生成合成测试素材，复现原始检查及解码问题。
- 自动备份、恢复命令和合成测试。

没有上传软件本体、修改后的 EXE、ASAR、原版备份、账号信息或私人视频。本仓库是社区自编的工具和报告，不代表 ChatCut 桌面核心已经开源。

## 使用前须知

该参数会放开渲染进程的 GPU 黑名单限制，可能导致不稳定或错误画面。补丁会修改 EXE 中的归档校验摘要，因此修改后的 EXE 原厂数字签名不再有效；保留的校验只验证本机修改版的一致性，并不能证明它是官方原版。官方更新可能覆盖补丁。

这里只验证了启动、简单色块/文字渲染和短视频导出接口。**视频画面验证未通过，一小时培训视频尚未测试，不建议据此用于正式制作。**

需要 Windows 和 Node.js 18+，不需要安装 npm 依赖。先关闭 ChatCut：

```powershell
# 只读检查
node scripts/chatcut-compat.cjs inspect --install-dir "D:\ChatCut"

# 明确应用实验补丁；默认将备份放到 D:\ChatCut.backup-0.3.16
node scripts/chatcut-compat.cjs apply --install-dir "D:\ChatCut"

# 恢复原版（也会恢复原来的显卡启动限制）
node scripts/chatcut-compat.cjs restore --install-dir "D:\ChatCut"
```

可用 `--backup-dir PATH` 指定独立备份目录。非匹配版本、不同构建、已修改文件或已有非空备份目录会被拒绝，不要删掉保护检查强行使用。更详细的限制、哈希与复现命令见 [English README](README.md)。
