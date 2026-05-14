import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from "electron"
import { autoUpdater } from "electron-updater"
import path from "path"
import axios from "axios"
import { processJob, detectClaudeCli, RunnerMode } from "./runner/index"

const SERVER_URL = process.env.VEXOLAB_SERVER_URL || "https://api.vexolab.com"
const TOKEN = process.env.VEXOLAB_TOKEN || ""
const POLL_INTERVAL = 5000
const headers = { Authorization: `Bearer ${TOKEN}` }

let tray: Tray | null = null
let win: BrowserWindow | null = null
let isRunning = false
let runnerMode: RunnerMode = "auto"
let claudeCliAvailable = false

function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 560,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
    titleBarStyle: "hiddenInset",
    resizable: false,
  })
  win.loadFile(path.join(__dirname, "../src/renderer/index.html"))
  win.on("close", (e) => { e.preventDefault(); win?.hide() })
}

function buildMenu() {
  const menu = Menu.buildFromTemplate([
    { label: "VexoLab Runner", enabled: false },
    { type: "separator" },
    { label: isRunning ? "● Running" : "○ Idle", enabled: false },
    { label: `Mode: ${runnerMode}`, enabled: false },
    { type: "separator" },
    {
      label: "Runner Mode",
      submenu: [
        {
          label: "Auto (recommended)",
          type: "radio",
          checked: runnerMode === "auto",
          click: () => { runnerMode = "auto"; buildMenu() },
        },
        {
          label: "Standard",
          type: "radio",
          checked: runnerMode === "standard",
          click: () => { runnerMode = "standard"; buildMenu() },
        },
        {
          label: `Claude CLI${claudeCliAvailable ? "" : " (not detected)"}`,
          type: "radio",
          checked: runnerMode === "claude-cli",
          enabled: claudeCliAvailable,
          click: () => { runnerMode = "claude-cli"; buildMenu() },
        },
      ],
    },
    { type: "separator" },
    { label: "Open", click: () => win?.show() },
    { label: "Quit", click: () => { app.exit(0) } },
  ])
  tray?.setContextMenu(menu)
}

async function pollForJobs() {
  if (!TOKEN || isRunning) return

  try {
    const { data } = await axios.get(`${SERVER_URL}/runner/next`, { headers })

    if (data.job) {
      isRunning = true
      tray?.setToolTip(`VexoLab — Running: "${data.job.command.slice(0, 30)}..."`)
      win?.webContents.send("job-started", { job: data.job, runnerMode })

      await processJob(data.job, runnerMode)

      isRunning = false
      tray?.setToolTip("VexoLab — Idle")
      win?.webContents.send("job-complete", data.job)
      buildMenu()
    }
  } catch {
    // silently retry on network error
  }
}

ipcMain.handle("get-status", () => ({
  isRunning,
  runnerMode,
  claudeCliAvailable,
  // never expose full token — first 8 chars only
  token: TOKEN ? `${TOKEN.slice(0, 8)}...` : null,
}))

ipcMain.handle("set-runner-mode", (_event, mode: RunnerMode) => {
  runnerMode = mode
  buildMenu()
})

app.whenReady().then(async () => {
  claudeCliAvailable = await detectClaudeCli()

  createWindow()

  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip("VexoLab — Idle")
  buildMenu()

  autoUpdater.checkForUpdatesAndNotify()
  setInterval(pollForJobs, POLL_INTERVAL)

  win?.webContents.on("did-finish-load", () => {
    win?.webContents.send("status-update", { isRunning, runnerMode, claudeCliAvailable })
  })
})

app.on("window-all-closed", () => { /* keep app alive when all windows close */ })
