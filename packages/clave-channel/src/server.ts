import { WebSocketServer, WebSocket } from 'ws'
import { randomUUID } from 'crypto'
import type { ClientMessage, ServerMessage, AgentInfo, ChatMessagePayload } from './protocol.js'

export interface ClaveChannelServerOptions {
  port: number
  apiKey?: string
  onChat?: (agentId: string, content: string) => Promise<string | AsyncIterable<string>>
  getAgents?: () => AgentInfo[]
}

export class ClaveChannelServer {
  private wss: WebSocketServer | null = null
  private clients = new Set<WebSocket>()
  private options: ClaveChannelServerOptions

  constructor(options: ClaveChannelServerOptions) {
    this.options = options
  }

  start(): void {
    this.wss = new WebSocketServer({ port: this.options.port })

    this.wss.on('connection', (ws, req) => {
      // API key auth
      if (this.options.apiKey) {
        const url = new URL(req.url || '/', `http://localhost:${this.options.port}`)
        const key = url.searchParams.get('key') || req.headers['x-api-key']
        if (key !== this.options.apiKey) {
          ws.close(4001, 'Unauthorized')
          return
        }
      }

      this.clients.add(ws)

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as ClientMessage
          this.handleMessage(ws, msg)
        } catch {
          this.send(ws, { type: 'error', error: 'Invalid message format' })
        }
      })

      ws.on('close', () => {
        this.clients.delete(ws)
      })

      ws.on('pong', () => {
        // Client is alive
      })
    })
  }

  stop(): void {
    for (const client of this.clients) {
      client.close()
    }
    this.clients.clear()
    this.wss?.close()
    this.wss = null
  }

  /** Broadcast a message to all connected Clave clients */
  broadcast(message: ServerMessage): void {
    const data = JSON.stringify(message)
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data)
      }
    }
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  private async handleMessage(ws: WebSocket, msg: ClientMessage): Promise<void> {
    switch (msg.type) {
      case 'ping':
        this.send(ws, { type: 'pong' })
        break

      case 'list-agents': {
        const agents = this.options.getAgents?.() ?? []
        this.send(ws, { type: 'agents', agents })
        break
      }

      case 'chat': {
        if (!this.options.onChat) {
          this.send(ws, { type: 'error', error: 'No chat handler configured' })
          return
        }

        const messageId = randomUUID()

        try {
          const result = await this.options.onChat(msg.agentId, msg.content)

          if (typeof result === 'string') {
            // Single response
            const chatMsg: ChatMessagePayload = {
              id: messageId,
              agentId: msg.agentId,
              role: 'assistant',
              content: result,
              timestamp: Date.now(),
              status: 'sent'
            }
            this.send(ws, { type: 'chat', message: chatMsg })
          } else {
            // Streaming response
            let fullContent = ''
            for await (const chunk of result) {
              fullContent += chunk
              const chatMsg: ChatMessagePayload = {
                id: messageId,
                agentId: msg.agentId,
                role: 'assistant',
                content: chunk,
                timestamp: Date.now(),
                status: 'streaming'
              }
              this.send(ws, { type: 'chat', message: chatMsg })
            }
            // Final message
            const finalMsg: ChatMessagePayload = {
              id: messageId,
              agentId: msg.agentId,
              role: 'assistant',
              content: fullContent,
              timestamp: Date.now(),
              status: 'sent'
            }
            this.send(ws, { type: 'chat', message: finalMsg })
          }
        } catch (err) {
          const errorMsg: ChatMessagePayload = {
            id: messageId,
            agentId: msg.agentId,
            role: 'system',
            content: `Error: ${err instanceof Error ? err.message : String(err)}`,
            timestamp: Date.now(),
            status: 'error'
          }
          this.send(ws, { type: 'chat', message: errorMsg })
        }
        break
      }
    }
  }
}
