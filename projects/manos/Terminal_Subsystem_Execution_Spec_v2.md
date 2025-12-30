# iOS Terminal Subsystem (System VPN/Tailscale + SSH + tmux) — Architecture & Execution Spec (v2)

**Status:** Updated Draft (agent-executable)  
**Date:** 2025-12-27  
**Applies to:** iOS Agent Observability App  
**Source:** Built on `claude_terminal_architecture.md` (v1) and aligned with the iOS app architecture + PRDs.

---

## 0) What this subsystem is (and is not)

### Goal
Provide a **secure, resilient, mobile-friendly terminal viewer** that attaches to **persistent `tmux` sessions** on a remote machine (e.g., MacBook running Claude Code/OpenCode/Amp). The terminal experience must survive iOS backgrounding by relying on **server-side persistence**.

### Non-goals (v1)
- Not a VPN client: we rely on **system VPN / Tailscale already connected**.
- Not a full shell/SSH client: we implement the minimum needed for tmux attachment.
- Not RBAC-complete: **no role model** yet; local biometrics gate terminal access.

---

## 1) Hard constraints & decisions (locked)

### 1.1 Network / tunnel
- **System VPN only** (Tailscale app, WireGuard profile, etc.). The iOS app **does not embed a VPN SDK**.
- Terminal hosts are reachable only when the OS-level VPN is active.

### 1.2 Persistence strategy
- **tmux is the persistence layer**: sessions live on the remote machine even when iOS suspends the app.

### 1.3 SSH transport
- Preferred: **SwiftNIO SSH** with multiplexed channels over one TCP connection (as in v1).  
- We retain a transport abstraction so we can swap implementations if iOS edge cases appear.

### 1.4 Authorization
- **No server role model yet.**
- Interim security policy:
  - Terminal feature is gated by **local biometrics** (FaceID/TouchID).
  - SSH access is gated by possession of the private key + tailnet reachability.
  - Host key verification prevents MITM within the tailnet.

---

## 2) Key outcomes & acceptance gates

### 2.1 User outcomes
- **Attach fast:** tap a session → terminal renders within **< 3 seconds** on good Wi‑Fi.
- **Recover reliably:** background/foreground or transient network loss → user sees “Reconnecting…” and reattaches without losing remote work.
- **Stay safe:** host key mismatch blocks connection with a clear “host identity changed” message.

### 2.2 Acceptance gates (ship criteria)
A build is “terminal-v1 shippable” when all are true:

1) **Connect + attach**: Connect SSH → PTY → shell → `tmux attach` works for a known session.  
2) **Reattach after background**: Background for 30–120s → foreground → auto reconnect + rediscover sessions + reattach.  
3) **Host key TOFU**: First connect stores fingerprint; mismatch blocks subsequent connects unless user explicitly resets trust.  
4) **Key storage**: Private key stored in Keychain with `ThisDeviceOnly` accessibility; never logged.  
5) **Error UX**: User sees actionable messages for auth failure, host unreachable, host key mismatch.

---

## 3) External dependencies & environment requirements (agent can set up)

### 3.1 Remote host requirements
Remote machine must have:
- `sshd` enabled (key-only auth preferred)
- `tmux` installed
- A user account dedicated to the automation (recommended)

### 3.2 Local “dev harness” (required for automated testing)
Provide a deterministic target for integration tests:

**Dev Harness Setup (macOS):**
1) Create `obs-terminal` user
2) Enable SSH login for that user
3) Install tmux: `brew install tmux`
4) Add authorized_keys (public key from the iOS app)
5) Create 2 seed sessions:
   - `tmux new-session -d -s claude-seed1`
   - `tmux new-session -d -s claude-seed2`

**Acceptance:** integration test can list sessions and attach to `claude-seed1`.

---

## 4) Architecture overview

### 4.1 Core idea
- One persistent SSH connection
- Many logical channels multiplexed over that connection
- Each terminal session corresponds to one channel + one tmux attachment

### 4.2 Layered modules
- **Terminal UI**
  - SwiftUI containers
  - SwiftTerm `TerminalView`
- **Session Orchestration**
  - `TerminalOrchestrator` (main use-case façade)
  - `TerminalSessionStore` (local model + persistence)
- **Transport**
  - `SSHTransport` protocol
  - `NIOSSHTransport` implementation (SwiftNIO SSH)
- **Security**
  - `KeychainKeyStore` (private keys)
  - `HostKeyStore` (TOFU fingerprints)
  - `BiometricGate`
- **Diagnostics**
  - `TerminalLogger` (OSLog categories)
  - `ConnectionHealthMonitor` (optional app-level checks)

---

## 5) Data model

### 5.1 Terminal session model (local)
```swift
struct TerminalSession: Identifiable, Codable {
    let id: UUID
    var displayName: String              // user-facing name
    var tmuxSessionName: String          // remote tmux session name (e.g., "claude-abc123")
    var host: TerminalHostRef            // where to connect
    var createdAt: Date
    var lastActivity: Date

    // Local UI state
    var channelState: ChannelState
    var lastError: TerminalError?
}

struct TerminalHostRef: Codable {
    var hostnameOrIP: String             // tailnet IP/hostname
    var port: Int                        // usually 22
    var username: String
    var keyId: String                    // keychain identifier
    var hostKeyId: String                // TOFU fingerprint record id
}

enum ChannelState: String, Codable {
    case disconnected
    case connecting
    case attached
    case detached
    case reconnecting
}
```

### 5.2 Persistence rules
- Persist only **session metadata** (not scrollback)
- SwiftTerm scrollback kept in memory, trimmed under memory pressure

---

## 6) Security design

### 6.1 Private key storage (fixing v1 inconsistency)
**v2 requirement (MVP):**
- Store private key bytes as `kSecClassGenericPassword` data with:
  - `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`
  - optional `SecAccessControl` requiring biometrics for read

### 6.2 Host key verification (TOFU)
**TOFU policy:**
- On first connect to a host:
  - store host key fingerprint (Keychain, device-only)
- On subsequent connects:
  - if fingerprint differs: **block** and show `HostKeyMismatch`

**Reset trust flow:**
- Requires biometrics
- Deletes stored fingerprint
- Reconnect triggers TOFU again

### 6.3 Local biometrics gate
Terminal entry requires biometric unlock:
- On first open Terminal area after app launch
- And for “Reset host trust” action

---

## 7) Transport design (SwiftNIO SSH)

### 7.1 SSHTransport protocol (swap-friendly)
```swift
protocol SSHTransport {
    func connect(to host: TerminalHostRef) async throws
    func disconnect() async
    func openPTYShellChannel() async throws -> SSHChannelHandle
    func openExecChannel(command: String) async throws -> SSHChannelHandle
    func send(_ data: Data, on channel: SSHChannelHandle) async throws
    func close(_ channel: SSHChannelHandle) async
    func setWindowSize(cols: Int, rows: Int, on channel: SSHChannelHandle) async throws
}
```

### 7.2 Connection manager actor (no @MainActor networking)
```swift
actor SSHConnectionManager {
    private var state: ConnectionState = .disconnected
    private let transport: SSHTransport
}
```

Connection states:
- `disconnected`
- `connecting`
- `authenticating`
- `connected`
- `reconnecting(attempt: Int)`
- `failed(reason: TerminalError)`

### 7.3 Multiplexing semantics
- Each session uses one channel.
- If the underlying TCP connection drops:
  - all channels are invalid
  - orchestrator sets all sessions to `reconnecting`
  - orchestrator reconnects once then reattaches sessions sequentially (active first)

---

## 8) tmux integration

### 8.1 Command reference
- Create: `tmux new-session -d -s <name>`
- List: `tmux list-sessions -F "#{session_name}"`
- Attach: `tmux attach-session -t <name>`
- Kill: `tmux kill-session -t <name>`
- Send keys: `tmux send-keys -t <name> '<text>' Enter`

### 8.2 Attachment flow (PTY + shell + attach)
**Required order:**
1) Open channel
2) Request PTY
3) Request Shell
4) Send attach command
5) Begin streaming bytes to SwiftTerm

### 8.3 Session discovery on reconnect
On reconnect, discover sessions matching naming convention:
- `tmux list-sessions -F '#{session_name}' 2>/dev/null | grep '^claude-'`

---

## 9) Terminal UI integration (SwiftTerm + SwiftUI)

### 9.1 SwiftUI wrapper pattern
Use a `UIViewRepresentable` wrapper to host `TerminalView`, forwarding keystrokes to the active channel and writing received bytes to SwiftTerm.

### 9.2 Input modes (MVP vs later)
- MVP: allow input.
- Add a **read-only lock toggle** in settings if needed.

### 9.3 Terminal sizing
- Sync SwiftTerm terminal size to remote PTY via SSH window-change events.

---

## 10) Background / foreground lifecycle (explicit semantics)

### 10.1 On entering background
Best-effort:
1) Mark sessions `detached` locally
2) Close channels cleanly
3) Keep remote tmux sessions alive

### 10.2 On entering foreground
1) Reconnect SSH
2) Discover existing tmux sessions
3) Reattach the active session first
4) Reattach others lazily (on-demand)

---

## 11) Error taxonomy & recovery (complete mapping)

### 11.1 TerminalError (expanded)
```swift
enum TerminalError: Error, Equatable {
    // Network / transport
    case tailnetUnreachable
    case connectionFailed(underlying: String)
    case connectionTimeout
    case connectionLost

    // Auth / trust
    case authenticationFailed
    case hostKeyMissing
    case hostKeyMismatch(expected: String, got: String)

    // tmux / remote
    case tmuxSessionNotFound(name: String)
    case tmuxCommandFailed(output: String)

    // Local
    case invalidConfiguration
    case keyNotFound(keyId: String)
    case persistenceError
}
```

### 11.2 Recovery matrix
| Error | User message | App action | User action |
|---|---|---|---|
| `tailnetUnreachable` | “Remote host unreachable. Is Tailscale connected?” | Retry w/ backoff | Open Tailscale / enable VPN |
| `authenticationFailed` | “SSH key rejected by host.” | Stop retries | Reconfigure key / user |
| `hostKeyMismatch` | “Host identity changed. Connection blocked.” | Block | Reset trust (biometric) |
| `connectionLost` | “Connection lost. Reconnecting…” | Auto-reconnect | Wait / tap retry |
| `tmuxSessionNotFound` | “Session no longer exists.” | Remove/soft-delete | None |
| `tmuxCommandFailed` | “Remote command failed.” | Show output | Inspect remote host |

---

## 12) Performance budgets (terminal)

- Initial attach: **< 3s**
- Input latency: **< 80ms** p50 for echoing typed chars (good network)
- Memory: scrollback default ~10,000 lines; trim on memory warning
- CPU: rendering should not exceed 60fps

---

## 13) Integration with the main iOS Observability App

### 13.1 Terminal sessions as “just another feature”
Terminal must plug into:
- Agent Detail → “Open Terminal”
- A dedicated “Terminal Sessions” tab

### 13.2 Minimal backend contract for terminal discovery (since nothing exists yet)
Even if “backend is undefined,” iOS needs a canonical mapping for “which host/tmux session corresponds to an agent.”

**Proposed minimal endpoint:**
- `GET /v1/terminal/sessions`
  - returns `[{ sessionId, displayName, hostnameOrIP, port, username, tmuxSessionName, agentId?, swarmId? }]`

**If you want *zero backend* MVP:**
- Put terminal hosts + sessions in local Settings (manual config) and ship.
- Later swap to backend-driven mapping.

---

## 14) Task catalog (agent-executable)

### T1 — Define core abstractions (models + protocols)
**Deps:** none  
**Deliverables:** `TerminalSession`, `TerminalHostRef`, `TerminalError`, `SSHTransport`, `TerminalOrchestrator`  
**Acceptance:** Codable roundtrip tests, compile + run

### T2 — Implement KeychainKeyStore (generic password data)
**Deps:** T1  
**Acceptance:** key persists across relaunch; missing key returns `keyNotFound`

### T3 — Implement HostKeyStore (TOFU)
**Deps:** T2  
**Acceptance:** first connect stores fingerprint; mismatch blocks; reset trust requires biometrics

### T4 — Implement NIOSSHTransport (connect + channels + PTY + window change)
**Deps:** T1–T3  
**Acceptance:** connects to harness; exec channel can run `echo ping`

### T5 — Implement SSHConnectionManager actor (multiplex + reconnect)
**Deps:** T4  
**Acceptance:** network drop and restore triggers reconnect and reattach active session

### T6 — Implement tmux client (create/list/attach/kill/discover)
**Deps:** T4  
**Acceptance:** lists `claude-seed1`; attaches successfully

### T7 — SwiftTerm UI wrapper (TerminalView + delegate wiring)
**Deps:** T1  
**Acceptance:** typing echoes; hardware keyboard shortcuts supported

### T8 — Orchestrator glue (session lifecycle)
**Deps:** T5–T7  
**Acceptance:** create/detach/destroy sessions behave correctly and update UI

### T9 — Background/foreground behavior
**Deps:** T8  
**Acceptance:** background 60s → foreground reattach works

### T10 — Error UX mapping
**Deps:** T8  
**Acceptance:** each TerminalError shows correct CTA; host key mismatch UI blocks safely

### T11 — Test harness + integration tests
**Deps:** T4–T10  
**Acceptance:** end-to-end suite passes locally

---

## 15) Open items (explicitly tracked)

1) Backend mapping: local config MVP vs `/v1/terminal/sessions` API  
2) Read-only policy: allow typing in production? (default yes; add toggle)  
3) Key provisioning: import vs generate (implement import first)

---

## 16) Appendix — Recommended file/module layout

```
Services/Terminal/
  TerminalOrchestrator.swift
  Models/
    TerminalSession.swift
    TerminalError.swift
    TerminalHostRef.swift
  Transport/
    SSHTransport.swift
    NIOSSHTransport.swift
    SSHConnectionManager.swift
  Tmux/
    TmuxClient.swift
  Security/
    KeychainKeyStore.swift
    HostKeyStore.swift
    BiometricGate.swift
  UI/
    TerminalContainerView.swift
    TerminalSessionsListView.swift
  Testing/
    TerminalHarness.md
    TerminalIntegrationTests.swift
```
