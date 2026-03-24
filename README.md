<div align="center">
  <h1>🦋 LumeMoth</h1>
  <p><strong>Multi-Layer Static Analysis Engine — Zero Setup</strong></p>
  <p>
    <a href="#features"><img alt="Status" src="https://img.shields.io/badge/status-active-10B981?style=for-the-badge" /></a>
    <a href="#usage"><img alt="CLI" src="https://img.shields.io/badge/CLI-moth_fly-00F0FF?style=for-the-badge" /></a>
    <a href="#license"><img alt="License" src="https://img.shields.io/badge/license-MIT-B624FF?style=for-the-badge" /></a>
  </p>
</div>

---

**LumeMoth** is a zero-setup tool that autonomously scans your codebase across **4 distinct analysis layers**, auto-heals critical issues and generates GitHub tickets — with no cloud APIs, no AI keys, and no external services.

No install. No config. Just `moth fly`.

---

## ✨ Features

### 🎯 Layer 1 — Syntax Analysis
Uses the **TypeScript Compiler AST** to detect real syntactic errors before they reach the runtime.

### 🧠 Layer 2 — Semantic Analysis
Detects logical anti-patterns that compilers miss:
- Silent `catch {}` blocks that swallow exceptions
- Unresolved `TODO` / `FIXME` markers
- Potential infinite loops without exit conditions
- Callback hell patterns (deeply nested arrow functions)

### 🔒 Layer 3 — Security Audit
- Hardcoded secrets, tokens & passwords
- `eval()` / `new Function()` — Remote Code Execution vectors
- `innerHTML` — XSS injection points
- Unencrypted HTTP connections
- `Math.random()` used for security-sensitive values

### ⚡ Layer 4 — Performance Review
- `console.log` left in production code
- Sequential `await` inside loops (should use `Promise.all`)
- `JSON.parse(JSON.stringify())` deep clone anti-pattern
- `forEach + .push()` instead of `.map()`

### 🛠 Three Scan Modes
| Mode | Behaviour |
|---|---|
| **⚡ Auto-Fix** | Fixes all auto-fixable issues silently. Saves tickets for the rest. |
| **🔍 Interactive** | Prompts per-issue: Fix / Ticket / Skip. Full control. |
| **📋 Report Only** | Scan without writing any code. Saves issue templates only. |

### ✅ Dry-Run Validation
Every fix is validated internally by the TypeScript Compiler API before a single byte is written to disk. Fixes that introduce new errors are automatically rejected.

### 📓 Developer Logbook
Every healed issue is documented in `.lumemoth/logs/` with the bug, the developer's intent, and a technical refactoring explanation.

### 🎫 Smart Ticket Generation
Issues that need manual review generate tailored Markdown templates in `.github/ISSUES/`. If the `gh` CLI is present, LumeMoth can open tickets on GitHub automatically.

---

## 🚀 Installation

```bash
# 1. Clone the repository
git clone https://github.com/YourUsername/lumemoth.git
cd lumemoth/LumeMoth

# 2. Install dependencies
npm install

# 3. Link globally
npm link
```

## 🦋 Usage

Navigate to **any project folder** and run:

```bash
moth fly
```

LumeMoth recursively scans all `.ts`, `.js`, `.tsx`, `.jsx` files, skips `node_modules` / `.git` / `dist`, presents a mode selector, then scans and acts on findings.

> **No API key, no Ollama, no internet connection required.**

---

## 📁 Project Structure

```
LumeMoth/
├── index.ts                     # CLI entry point & orchestration
├── bin.js                       # Global binary wrapper
├── src/
│   ├── AIEngine.ts              # 4-layer static analysis (AST + regex)
│   ├── DeepRecursionEngine.ts   # Import-graph cross-file context builder
│   ├── RefactorEngine.ts        # Dry-run TypeScript validation
│   ├── Logbook.ts               # Developer learning log writer
│   └── TicketManager.ts         # GitHub issue template generator
└── .lumemoth/
    └── logs/                    # Auto-generated fix logs (local only, gitignored)
```

---

## 🤝 Contributing
Contributions, new detection rules and custom auto-fixes are always welcome!

## 📄 License
**MIT** — Free and Open Source. Use, modify, and distribute however you like. 🦋

---
<p align="center">
  <small><em>Initiated by Gr33do</em></small>
</p>
