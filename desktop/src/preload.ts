import { contextBridge, ipcRenderer } from "electron"

// expose a safe subset of ipc to the renderer — contextIsolation keeps main process secure
contextBridge.exposeInMainWorld("electron", {
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    on: (channel: string, listener: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (_event, ...args) => listener(...args))
    },
  },
})
