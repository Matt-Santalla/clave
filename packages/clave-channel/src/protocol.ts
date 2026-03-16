// ── Shared message types between Clave client and channel server ──

export interface AgentInfo {
  id: string
  name: string
  status: 'online' | 'offline' | 'busy' | 'error'
  model?: string
  cwd?: string
}

export interface ChatMessagePayload {
  id: string
  agentId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  status: 'sending' | 'streaming' | 'sent' | 'error'
}

// Messages from Clave → Channel
export type ClientMessage =
  | { type: 'chat'; agentId: string; content: string }
  | { type: 'list-agents' }
  | { type: 'ping' }

// Messages from Channel → Clave
export type ServerMessage =
  | { type: 'chat'; message: ChatMessagePayload }
  | { type: 'agents'; agents: AgentInfo[] }
  | { type: 'pong' }
  | { type: 'error'; error: string }
