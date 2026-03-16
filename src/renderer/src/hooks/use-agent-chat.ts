import { useEffect, useCallback, useRef } from 'react'
import { useAgentStore } from '../store/agent-store'
import type { ChatMessage } from '../../../shared/remote-types'

const EMPTY_MESSAGES: ChatMessage[] = []

export function useAgentChat(agentId: string | null) {
  const addMessage = useAgentStore((s) => s.addMessage)
  const appendMessageContent = useAgentStore((s) => s.appendMessageContent)
  const messages = useAgentStore((s) => {
    if (!agentId) return EMPTY_MESSAGES
    return s.messages[agentId] ?? EMPTY_MESSAGES
  })
  const scrollRef = useRef<HTMLDivElement>(null)

  // Subscribe to agent messages
  useEffect(() => {
    if (!agentId || !window.electronAPI?.onAgentMessage) return
    const cleanup = window.electronAPI.onAgentMessage(agentId, (raw: unknown) => {
      const message = raw as ChatMessage
      if (message.status === 'streaming') {
        const existing = useAgentStore.getState().messages[agentId]?.find((m) => m.id === message.id)
        if (existing) {
          appendMessageContent(agentId, message.id, message.content)
        } else {
          addMessage(agentId, message)
        }
      } else {
        addMessage(agentId, message)
      }
    })
    return cleanup
  }, [agentId, addMessage, appendMessageContent])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!agentId || !window.electronAPI?.agentSend) return
      const agent = useAgentStore.getState().agents.find((a) => a.id === agentId)
      if (!agent) return
      const msg = await window.electronAPI.agentSend(agentId, agent.locationId, content)
      addMessage(agentId, msg as ChatMessage)
    },
    [agentId, addMessage]
  )

  return { messages, sendMessage, scrollRef }
}
