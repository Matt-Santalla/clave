import { ipcMain, BrowserWindow } from 'electron'
import { openclawClient } from '../openclaw-client'
import { locationManager } from '../location-manager'
import { randomUUID } from 'crypto'
import type { ChatMessage } from '../../shared/remote-types'

export function registerAgentHandlers(): void {
  // Set up message forwarding to renderer
  openclawClient.onMessage((_locationId, message) => {
    const win = BrowserWindow.getAllWindows()[0]
    win?.webContents.send(`agent:on-message:${message.agentId}`, message)
  })

  openclawClient.onAgentsUpdate((locationId, agents) => {
    const win = BrowserWindow.getAllWindows()[0]
    win?.webContents.send('agent:agents-updated', locationId, agents)
  })

  ipcMain.handle('agent:list', async (_event, locationId: string) => {
    const loc = locationManager.getLocations().find((l) => l.id === locationId)
    if (!loc?.openclawPort || !loc.host) return []
    openclawClient.requestAgents(locationId)
    // Return will come via agent:agents-updated event
    return []
  })

  ipcMain.handle('agent:connect', async (_event, locationId: string) => {
    const loc = locationManager.getLocations().find((l) => l.id === locationId)
    if (!loc?.host || !loc.openclawPort) throw new Error('Location not configured for agents')
    const wsUrl = `ws://${loc.host}:${loc.openclawPort}`
    await openclawClient.connect(locationId, wsUrl)
  })

  ipcMain.handle('agent:disconnect', (_event, locationId: string) => {
    openclawClient.disconnect(locationId)
  })

  ipcMain.handle('agent:send', (_event, agentId: string, locationId: string, content: string) => {
    openclawClient.send(locationId, agentId, content)
    // Return optimistic message
    const msg: ChatMessage = {
      id: randomUUID(),
      agentId,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'sending'
    }
    return msg
  })
}
