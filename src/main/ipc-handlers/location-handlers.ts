import { ipcMain } from 'electron'
import { locationManager } from '../location-manager'
import { sshManager } from '../ssh-manager'
import { openclawClient } from '../openclaw-client'
import type { Location } from '../../shared/remote-types'

export function registerLocationHandlers(): void {
  ipcMain.handle('location:list', () => locationManager.getLocations())

  ipcMain.handle('location:add', (_event, loc: Omit<Location, 'id' | 'status'>, password?: string) => {
    return locationManager.addLocation(loc, password)
  })

  ipcMain.handle('location:update', (_event, id: string, updates: Partial<Location>) => {
    return locationManager.updateLocation(id, updates)
  })

  ipcMain.handle('location:remove', (_event, id: string) => {
    sshManager.disconnect(id)
    openclawClient.disconnect(id)
    locationManager.removeLocation(id)
  })

  ipcMain.handle('location:test-connection', async (_event, id: string) => {
    const config = locationManager.getCredentials(id)
    if (!config) return { success: false, error: 'No credentials found' }
    try {
      await sshManager.connect(id, config)
      // Check for OpenClaw
      let openclawVersion: string | undefined
      let openclawPort: number | undefined
      try {
        const result = await sshManager.exec(id, 'openclaw --version 2>/dev/null || echo ""')
        if (result.stdout.trim()) {
          openclawVersion = result.stdout.trim()
          // Try to detect port from config
          const portResult = await sshManager.exec(id, 'cat ~/.openclaw/config.json 2>/dev/null || echo "{}"')
          try {
            const cfg = JSON.parse(portResult.stdout)
            openclawPort = cfg.claveChannelPort || 3100
          } catch { openclawPort = 3100 }
        }
      } catch { /* no openclaw */ }
      sshManager.disconnect(id)
      return { success: true, openclawVersion, openclawPort }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('location:install-plugin', async (_event, id: string) => {
    try {
      const result = await sshManager.exec(id, 'npm install -g @codika-io/clave-channel && clave-channel install')
      return { success: result.code === 0, output: result.stdout + result.stderr }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
