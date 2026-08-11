# Electron Application Automation Testing Research

> **Date:** 2026-08-10
> **Sources:** Official documentation, GitHub repositories, npm registries, and primary API references.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Electron Testing Frameworks](#electron-testing-frameworks)
3. [MCP Servers for Electron Testing](#mcp-servers-for-electron-testing)
4. [opencode Integration](#opencode-integration)
5. [Comparison Matrix](#comparison-matrix)
6. [Recommendations](#recommendations)

---

## Executive Summary

The Electron testing landscape has matured significantly since the deprecation of Spectron in February 2022. Two frameworks dominate the official recommendations: **Playwright** (experimental Electron support via CDP) and **WebdriverIO** (first-party `@wdio/electron-service`). Additionally, a growing ecosystem of **MCP servers** enables AI agents to automate Electron applications through the Model Context Protocol, making them directly usable with opencode and other AI coding assistants.

---

## Electron Testing Frameworks

### Playwright (Recommended)

**Status:** Actively maintained | **Electron Support:** Experimental | **Since:** v1.9

Playwright provides official experimental support for Electron automation through the `_electron` namespace. It connects to Electron apps via Chrome DevTools Protocol (CDP).

**Key API:**

```js
const { _electron: electron } = require('playwright');

// Launch Electron app
const electronApp = await electron.launch({ args: ['main.js'] });

// Evaluate in main process
const appPath = await electronApp.evaluate(async ({ app }) => {
  return app.getAppPath();
});

// Get first window as Playwright Page
const window = await electronApp.firstWindow();
await window.screenshot({ path: 'intro.png' });
await window.click('text=Click me');

// Close app
await electronApp.close();
```

**Capabilities:**
- Launch Electron apps with `electron.launch()`
- Access main process via `electronApp.evaluate()`
- Access BrowserWindow instances as Playwright `Page` objects
- Screenshot, click, type, assert via standard Playwright Page API
- Mock native dialogs via `electronApp.evaluate()`
- Listen to console events from renderer process

**Supported Electron versions:** v12.2.0+, v13.4.0+, v14+

**Sources:**
- [Playwright Electron API Docs](https://playwright.dev/docs/api/class-electron)
- [ElectronApplication API Docs](https://playwright.dev/docs/api/class-electronapplication)
- [Electron Automated Testing Guide](https://electronjs.org/docs/latest/tutorial/automated-testing)
- [Playwright GitHub - Electron docs](https://github.com/microsoft/playwright/blob/main/docs/src/api/class-electron.md)

---

### WebdriverIO + @wdio/electron-service

**Status:** Actively maintained | **Electron Support:** First-party | **Package:** `@wdio/electron-service` (v10)

WebdriverIO provides an official Electron testing service, now maintained under the `webdriverio/desktop-mobile` monorepo. This is the spiritual successor to Spectron.

**Key Configuration:**

```ts
// wdio.conf.ts
export const config: WebdriverIO.Config = {
  services: [['electron', {
    appEntryPoint: './path/to/bundled/electron/main.bundle.js',
    appArgs: [/** ... */],
  }]],
  capabilities: [{
    browserName: 'electron',
    'wdio:electronServiceOptions': {
      appBinaryPath: './path/to/bundled/application.exe',
    }
  }]
};
```

**Capabilities:**
- Auto-setup of Chromedriver (for Electron v26+)
- Automatic path detection for Electron Forge and Electron Builder
- Access Electron APIs within tests via `browser.electron.*`
- Mock Electron APIs with Vitest-like API: `browser.electron.mock('Tray')`
- Deeplink testing: `browser.electron.triggerDeeplink()`
- Console log capture from main and renderer processes
- Headless testing with automatic Xvfb integration (Linux)
- **Browser Mode:** Test renderer in plain Chrome against Vite dev server (no Electron binary needed)

**v10 Highlights:**
- Class mocking (`browser.electron.mock('Tray')`)
- Main/renderer console log capture
- Deeplink testing
- `electronBuilderConfig` option for multiple build configs
- `mode: 'browser'` for renderer-only testing

**Sources:**
- [@wdio/electron-service npm](https://www.npmjs.com/package/@wdio/electron-service)
- [WebdriverIO Electron Docs](https://webdriver.io/docs/desktop-testing/electron/)
- [WebdriverIO Desktop Mobile Monorepo](https://github.com/webdriverio/desktop-mobile)
- [Electron Automated Testing Guide (WDIO)](https://electronjs.org/docs/latest/tutorial/automated-testing)

---

### Spectron (Deprecated)

**Status:** Deprecated February 1, 2022 | **Do Not Use for New Projects**

Spectron was the official Electron testing framework built on ChromeDriver and WebdriverIO. It is incompatible with Electron 24+ and unmaintained.

**Migration Path:** The Electron team officially recommends migrating to Playwright or WebDriverIO.

**Sources:**
- [Spectron Deprecation Notice](https://electronjs.org/blog/spectron-deprecation-notice)
- [Spectron GitHub (DEPRECATED)](https://github.com/electron-userland/spectron)

---

### Selenium (Not Recommended)

**Status:** No Electron support

Selenium has deprecated its Electron support. The `selenium-webdriver` package cannot interact with Electron applications. The Electron team's documentation mentions Selenium only as a historical reference.

**Sources:**
- [Electron Automated Testing Guide](https://electronjs.org/docs/latest/tutorial/automated-testing)

---

### Appium (Limited Support)

**Status:** No direct Electron support

Appium does not have a dedicated Electron driver. The `appium-chromium-driver` targets Chromium-based desktop browsers (Chrome, Edge) but not Electron apps directly. Some projects use it with CEF-based runtimes (like Tauri with CEF), but this is not a general Electron testing solution.

**Workaround:** Electron supports Selenium WebDriver out of the box, so a custom Appium driver could theoretically be built (similar to what Spectron did), but none exists officially.

**Sources:**
- [Appium Chromium Driver](https://github.com/appium/appium-chromium-driver/)
- [Appium Discuss - Electron Support](https://discuss.appium.io/t/how-to-test-electron-application-using-appium/29232)
- [Electron Automated Testing Guide](https://electronjs.org/docs/latest/tutorial/automated-testing)

---

## MCP Servers for Electron Testing

Model Context Protocol (MCP) servers enable AI agents (including opencode) to automate Electron applications. These are the primary tools for AI-driven testing workflows.

### electron-mcp-server (amafjarkasi) — Most Popular CDP-Based

**Stars:** 81 | **Tools:** 36 | **Approach:** Chrome DevTools Protocol

The most widely-adopted MCP server for Electron debugging. Connects to running Electron apps via CDP (port 9222).

**Key Tools:**
- `start_app` — Launch Electron with remote debugging
- `attach` / `attach_by_pid` — Connect to running apps
- `screenshot` / `save_screenshot` — Full page or element clip
- `evaluate` / `evaluate_main` — JS in renderer or main process
- `get_console_messages` — Capture console errors
- `get_network_log` — Network request/response
- `click` / `type_text` / `press_key` — UI automation
- `start_tracing` / `stop_tracing` — Performance tracing
- `diagnose` — Health check

**Sources:**
- [GitHub: amafjarkasi/electron-mcp-server](https://github.com/amafjarkasi/electron-mcp-server)

---

### electron-driver (mesomya) — Playwright-Based

**Stars:** 2 | **Tools:** 38 | **Approach:** Playwright `_electron` API

Built on Playwright's experimental `_electron` namespace. Provides comprehensive automation with Playwright's selector engine.

**Key Tools:**
- `start_app` — Launch Electron app
- `eval_renderer` / `eval_main` — JS evaluation in both processes
- `accessibility_snapshot` — ARIA tree for a11y audits
- `console_logs` — Rolling 1000-entry buffer
- `drag` / `drop_file` — Real Chromium input events
- `switch_window` — Multi-window support

**Sources:**
- [GitHub: mesomya/electron-driver](https://github.com/mesomya/electron-driver)

---

### electron-mcp (kanishka-namdeo) — Full-Featured Playwright

**Stars:** 1 | **Tools:** 44 | **Approach:** Playwright + CDP

Most comprehensive tool count. Includes visual testing, accessibility, and code generation.

**Key Tools:**
- `launch_electron_app` / `connect_to_electron_cdp` — Dual connection modes
- `compare_screenshots` — Visual regression testing
- `get_accessibility_tree` / `find_accessible_node` — A11y testing
- `emulate_network_conditions` — Network mocking
- `export_recording_as_test` — Record and generate Playwright tests
- `focus_main_window` / `minimize_main_window` — Window control

**Sources:**
- [GitHub: kanishka-namdeo/electron-mcp](https://github.com/kanishka-namdeo/electron-mcp)

---

### playwright-electron-mcp (hotnsoursoup) — Official Fork

**Stars:** 5 | **Approach:** Fork of microsoft/playwright-mcp

Enhanced fork of the official Playwright MCP server with added Electron support. Runs in Electron mode by default.

**Electron-Specific Tools:**
- `electron_evaluate` — Execute JS in main process
- `electron_windows` — List all open windows
- `electron_first_window` — Get first window
- `electron_browser_window` — Advanced BrowserWindow control

**Sources:**
- [GitHub: hotnsoursoup/playwright-electron-mcp](https://github.com/hotnsoursoup/playwright-electron-mcp)

---

### electron-playwright-mcp (fracalo)

**Stars:** 1 | **Approach:** Playwright for Electron

Allows running Electron apps through Playwright while maintaining full user interactivity. The app operates normally for manual use while MCP clients drive it programmatically.

**Sources:**
- [GitHub: fracalo/electron-playwright-mcp](https://github.com/fracalo/electron-playwright-mcp)

---

### electron-mcp-server (laststance) — CDP with v2 Refactor

**Stars:** 21 | **Approach:** CDP via WebSocket

v2.0 splits a single command into ~40 individual `electron_*` tools for better LLM tool selection accuracy.

**Sources:**
- [GitHub: laststance/electron-mcp-server](https://github.com/laststance/electron-mcp-server/)

---

### electron-mcp-server (learn-automated-testing) — WebdriverIO-Based

**Stars:** 0 | **Approach:** WebdriverIO + wdio-electron-service

Uses WebdriverIO under the hood. Supports test generation in multiple formats (WebdriverIO JS/TS, Playwright JS/TS).

**Sources:**
- [GitHub: learn-automated-testing/electron-mcp-server](https://github.com/learn-automated-testing/electron-mcp-server)

---

### electron-test-mcp (npm)

**Approach:** Playwright with dual connection modes

- **CDP Mode:** Connect to running Electron app via `--remote-debugging-port=9222`
- **Launch Mode:** Launch fresh Electron app instance

**Sources:**
- [npm: electron-test-mcp](https://www.npmjs.com/package/electron-test-mcp)

---

### microsoft/playwright-mcp — Official (Web, Not Electron)

**Note:** The official Playwright MCP server from Microsoft is for **web browsers only** (Chromium, Firefox, WebKit). It does not support Electron directly, but the `hotnsoursoup` fork adds Electron support.

**Sources:**
- [GitHub: microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp/)
- [Playwright MCP Docs](https://playwright.dev/docs/getting-started-mcp)

---

## opencode Integration

### Current State of opencode Skills/Plugins

opencode does **not yet have a unified marketplace** (as of August 2026). There is an open feature request tracking this: [anomalyco/opencode#28696](https://github.com/anomalyco/opencode/issues/28696).

**How Skills Work in opencode:**
- Skills are loaded from local directories: `.opencode/skills/`, `.claude/skills/`, `.agents/skills/`
- Global: `~/.config/opencode/skills/`, `~/.claude/skills/`, `~/.agents/skills/`
- Each skill is a folder with a `SKILL.md` file
- Skills are discovered on-demand via the native `skill` tool

**Sources:**
- [opencode Skills Docs](https://opencode.ai/docs/skills/)
- [opencode Plugins Docs](https://opencode.ai/docs/plugins/)

---

### Existing Electron Testing Skills

#### desktop-testing-electron (agents-inc)

A comprehensive skill for Electron testing with Playwright. Includes:
- Playwright Electron API reference
- Spectron migration guide
- Test runner comparison
- Code examples for E2E, IPC testing, dialog mocking

**Source:** [GitHub: agents-inc/skills](https://github.com/agents-inc/skills/blob/main/dist/plugins/desktop-testing-electron/skills/desktop-testing-electron/SKILL.md)

#### dev-test-electron (mcpmarket.com)

Specialized framework for testing Electron apps via CDP. Features:
- Full CDP integration for deep Electron automation
- IPC (Inter-Process Communication) verification
- Native menu automation
- 6-gate verification workflow (build, launch, log verification)

**Source:** [mcpmarket.com](https://mcpmarket.com/tools/skills/electron-e2e-testing-automation)

#### Electron App Automation (kcchien/skills)

Uses `agent-browser` to connect to Electron apps via CDP. Workflow:
1. Launch Electron app with `--remote-debugging-port=9222`
2. Connect agent-browser to CDP port
3. Snapshot to discover elements
4. Interact using element refs

**Source:** [skills.sh](https://www.skills.sh/kcchien/skills/electron)

#### daytona-electron-den (openwork)

Electron + cloud two-sandbox e2e testing. Validates Electron against a Daytona Den server with unified proof.

**Source:** [GitHub: different-ai/openwork](https://github.com/different-ai/openwork/blob/e8ab197c/.opencode/skills/daytona-electron-den/SKILL.md)

#### run-evals (openwork)

Launches OpenWork on Daytona or local Electron and runs coded eval flows via CDP.

**Source:** [GitHub: different-ai/openwork](https://github.com/different-ai/openwork/blob/e8ab197c/.opencode/skills/run-evals/SKILL.md)

---

### Using MCP Servers with opencode

opencode supports MCP servers through its plugin system. Any MCP server listed above can be configured in `opencode.json`:

```json
{
  "mcpServers": {
    "electron-debug": {
      "command": "npx",
      "args": ["-y", "@amafjarkasi/electron-mcp-server"]
    }
  }
}
```

This enables opencode to directly automate Electron applications during development and testing.

---

## Comparison Matrix

| Solution | Type | Maintenance | Electron Support | Main Process Access | CI-Friendly | AI Agent Ready |
|----------|------|-------------|------------------|---------------------|-------------|----------------|
| **Playwright** | Framework | Active | Experimental (CDP) | Yes (`evaluate()`) | Yes (xvfb) | Via MCP |
| **@wdio/electron-service** | Framework | Active | First-party | Yes (`browser.electron.*`) | Yes (autoXvfb) | Via MCP |
| **Spectron** | Framework | Deprecated | Dead | Yes | No | No |
| **Selenium** | Framework | Active | None | No | Yes | No |
| **Appium** | Framework | Active | None | No | Yes | No |
| **electron-mcp-server (amafjarkasi)** | MCP | Active | CDP (attach) | Yes (`evaluate_main`) | Yes | Yes |
| **electron-driver (mesomya)** | MCP | Active | Playwright | Yes (`eval_main`) | Yes | Yes |
| **electron-mcp (kanishka-namdeo)** | MCP | Active | Playwright + CDP | Yes | Yes | Yes |
| **playwright-electron-mcp** | MCP | Active | Playwright fork | Yes | Yes | Yes |
| **electron-test-mcp** | MCP | Active | Playwright | Yes | Yes | Yes |

---

## Recommendations

### For Traditional Test Automation (CI/CD)

1. **Playwright** — Best for new projects. Official Electron docs recommend it. Use `@playwright/test` runner with `_electron.launch()`.
2. **@wdio/electron-service** — Best for teams already using WebdriverIO. First-party support, browser mode for fast renderer-only tests.

### For AI-Agent-Driven Testing (opencode)

1. **electron-mcp-server (amafjarkasi)** — Most mature CDP-based MCP server. 36 tools, 81 GitHub stars. Best for connecting to already-running apps.
2. **electron-driver (mesomya)** — Best Playwright-based MCP. Full selector engine, accessibility snapshots, multi-window support.
3. **electron-mcp (kanishka-namdeo)** — Most comprehensive (44 tools). Includes visual regression, network emulation, code generation.

### For opencode Skills

1. **desktop-testing-electron (agents-inc)** — Most complete skill with migration guides and examples.
2. **dev-test-electron** — Best for deep CDP-based automation with verification workflows.

### Quick Start: Playwright + Electron

```bash
npm install --save-dev @playwright/test
```

```js
// example.spec.js
import { test, expect, _electron as electron } from '@playwright/test';

test('launch app', async () => {
  const electronApp = await electron.launch({ args: ['.'] });
  const window = await electronApp.firstWindow();
  await window.screenshot({ path: 'intro.png' });
  await electronApp.close();
});
```

```bash
npx playwright test
```

### Quick Start: MCP Server with opencode

```json
// opencode.json
{
  "mcpServers": {
    "electron": {
      "command": "npx",
      "args": ["-y", "electron-driver"]
    }
  }
}
```

Then in opencode: "Launch my Electron app and verify the main window title."

---

## References

- [Playwright Electron API](https://playwright.dev/docs/api/class-electron)
- [Electron Automated Testing Official Guide](https://electronjs.org/docs/latest/tutorial/automated-testing)
- [WebdriverIO Electron Service](https://webdriver.io/docs/desktop-testing/electron/)
- [@wdio/electron-service npm](https://www.npmjs.com/package/@wdio/electron-service)
- [WebdriverIO Desktop Mobile Monorepo](https://github.com/webdriverio/desktop-mobile)
- [Spectron Deprecation Notice](https://electronjs.org/blog/spectron-deprecation-notice)
- [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp/)
- [amafjarkasi/electron-mcp-server](https://github.com/amafjarkasi/electron-mcp-server)
- [mesomya/electron-driver](https://github.com/mesomya/electron-driver)
- [kanishka-namdeo/electron-mcp](https://github.com/kanishka-namdeo/electron-mcp)
- [hotnsoursoup/playwright-electron-mcp](https://github.com/hotnsoursoup/playwright-electron-mcp)
- [fracalo/electron-playwright-mcp](https://github.com/fracalo/electron-playwright-mcp)
- [laststance/electron-mcp-server](https://github.com/laststance/electron-mcp-server/)
- [learn-automated-testing/electron-mcp-server](https://github.com/learn-automated-testing/electron-mcp-server)
- [agents-inc/skills (desktop-testing-electron)](https://github.com/agents-inc/skills)
- [opencode Skills Documentation](https://opencode.ai/docs/skills/)
- [opencode Plugins Documentation](https://opencode.ai/docs/plugins/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
