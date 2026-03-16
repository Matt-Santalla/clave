import WebSocket from 'ws'
import { Agent, ChatMessage } from '../shared/remote-types'

const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 30000
const HEARTBEAT_INTERVAL_MS = 30000
const HEARTBEAT_TIMEOUT_MS = 10000

interface ConnectionEntry {
  ws: WebSocket
  wsUrl: string
  apiKey?: string
  reconnectAttempts: number
  reconnectTimer: ReturnType<typeof setTimeout> | null
  heartbeatTimer: ReturnType<typeof setInterval> | null
  pongTimer: ReturnType<typeof setTimeout> | null
  intentionalClose: boolean
}

type MessageCallback = (locationId: string, message: ChatMessage) => void
type AgentsCallback = (locationId: string, agents: Agent[]) => void

class OpenClawClient {
  private connections = new Map<string, ConnectionEntry>()
  private messageCallbacks = new Set<MessageCallback>()
  private agentCallbacks = new Set<AgentsCallback>()

  async connect(locationId: string, wsUrl: string, apiKey?: string): Promise<void> {
    // Disconnect existing connection if any
    this.disconnect(locationId)

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl, apiKey ? { headers: { authorization: `Bearer ${apiKey}` } } : undefined)

      const entry: ConnectionEntry = {
        ws,
        wsUrl,
        apiKey,
        reconnectAttempts: 0,
        reconnectTimer: null,
        heartbeatTimer: null,
        pongTimer: null,
        intentionalClose: false
      }

      this.connections.set(locationId, entry)

      ws.on('open', () => {
        entry.reconnectAttempts = 0
        this.startHeartbeat(locationId, entry)
        this.requestAgents(locationId)
        resolve()
      })

      ws.on('message', (data) => {
        this.handleMessage(locationId, data)
      })

      ws.on('pong', () => {
        if (entry.pongTimer) {
          clearTimeout(entry.pongTimer)
          entry.pongTimer = null
        }
      })

      ws.on('close', () => {
        this.stopHeartbeat(entry)
        if (!entry.intentionalClose) {
          this.scheduleReconnect(locationId, entry)
        }
      })

      ws.on('error', (err) => {
        // If we haven't resolved yet (initial connect), reject
        if (ws.readyState === WebSocket.CONNECTING) {
          this.connections.delete(locationId)
          reject(err)
        }
      })
    })
  }

  disconnect(locationId: string): void {
    const entry = this.connections.get(locationId)
    if (!entry) return

    entry.intentionalClose = true
    this.stopHeartbeat(entry)

    if (entry.reconnectTimer) {
      clearTimeout(entry.reconnectTimer)
      entry.reconnectTimer = null
    }

    if (entry.ws.readyState === WebSocket.OPEN || entry.ws.readyState === WebSocket.CONNECTING) {
      entry.ws.close()
    }

    this.connections.delete(locationId)
  }

  disconnectAll(): void {
    for (const locationId of [...this.connections.keys()]) {
      this.disconnect(locationId)
    }
  }

  send(locationId: string, agentId: string, content: string): void {
    const entry = this.connections.get(locationId)
    if (!entry || entry.ws.readyState !== WebSocket.OPEN) return

    entry.ws.send(JSON.stringify({ type: 'chat', agentId, content }))
  }

  requestAgents(locationId: string): void {
    const entry = this.connections.get(locationId)
    if (!entry || entry.ws.readyState !== WebSocket.OPEN) return

    entry.ws.send(JSON.stringify({ type: 'list-agents' }))
  }

  onMessage(callback: MessageCallback): () => void {
    this.messageCallbacks.add(callback)
    return () => {
      this.messageCallbacks.delete(callback)
    }
  }

  onAgentsUpdate(callback: AgentsCallback): () => void {
    this.agentCallbacks.add(callback)
    return () => {
      this.agentCallbacks.delete(callback)
    }
  }

  // ── Private ──

  private handleMessage(locationId: string, data: WebSocket.RawData): void {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(data.toString())
    } catch {
      return
    }

    switch (parsed.type) {
      case 'chat': {
        const message = parsed.message as ChatMessage
        for (const cb of this.messageCallbacks) {
          cb(locationId, message)
        }
        break
      }
      case 'agents': {
        const agents = parsed.agents as Agent[]
        for (const cb of this.agentCallbacks) {
          cb(locationId, agents)
        }
        break
      }
      case 'pong':
        // Handled by ws 'pong' event
        break
    }
  }

  private startHeartbeat(_locationId: string, entry: ConnectionEntry): void {
    entry.heartbeatTimer = setInterval(() => {
      if (entry.ws.readyState !== WebSocket.OPEN) return

      entry.ws.ping()
      entry.pongTimer = setTimeout(() => {
        // No pong received — close and let reconnect handle it
        entry.ws.terminate()
      }, HEARTBEAT_TIMEOUT_MS)
    }, HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeat(entry: ConnectionEntry): void {
    if (entry.heartbeatTimer) {
      clearInterval(entry.heartbeatTimer)
      entry.heartbeatTimer = null
    }
    if (entry.pongTimer) {
      clearTimeout(entry.pongTimer)
      entry.pongTimer = null
    }
  }

  private scheduleReconnect(locationId: string, entry: ConnectionEntry): void {
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, entry.reconnectAttempts),
      RECONNECT_MAX_MS
    )
    entry.reconnectAttempts++

    entry.reconnectTimer = setTimeout(async () => {
      entry.reconnectTimer = null
      try {
        await this.connect(locationId, entry.wsUrl, entry.apiKey)
      } catch {
        // connect failed — the close handler will schedule another reconnect
      }
    }, delay)
  }
}

export const openclawClient = new OpenClawClient()
