import { create } from 'zustand'
import { api } from '../utils/api'

const MAX_RETRIES = 5
const RETRY_DELAY_MS = 3000

export const useGameStore = create((set, get) => ({
  socket:       null,
  connected:    false,
  tableId:      null,
  retryCount:   0,
  retryTimer:   null,

  gameState:    null,
  myCards:      [],
  validActions: [],
  chatMessages: [],
  actionLog:    [],
  winners:      null,
  error:        null,
  tableInfo:    null,
  isAdmin:      false,

  connect: async (tableId) => {
    // Clear any pending retry
    const { retryTimer } = get()
    if (retryTimer) clearTimeout(retryTimer)

    const existing = get().socket
    if (existing) { existing.onclose = null; existing.close() }

    set({ tableId, connected: false, error: null, retryTimer: null })
    get()._openSocket(tableId)
  },

  _openSocket: async (tableId) => {
    let ws
    try {
      ws = await api.createWebSocket(tableId)
    } catch (e) {
      set({ error: 'Could not create connection — check your login', connected: false })
      return
    }

    ws.onopen = () => {
      set({ connected: true, retryCount: 0, error: null })
      // Keep-alive ping every 30s to prevent idle disconnects
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        } else {
          clearInterval(ping)
        }
      }, 30000)
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        get()._handleMessage(msg)
      } catch (e) { /* ignore malformed */ }
    }

    ws.onerror = () => {
      set({ connected: false })
    }

    ws.onclose = (event) => {
      set({ connected: false })
      const { retryCount, tableId: tid } = get()
      // Don't retry if intentionally closed (code 4001 = unauth, 4004 = not found)
      if (event.code === 4001 || event.code === 4004 || event.code === 1000) return
      if (!tid) return

      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(1.5, retryCount) // backoff
        set({ error: `Disconnected — reconnecting in ${Math.round(delay/1000)}s…` })
        const timer = setTimeout(() => {
          set(s => ({ retryCount: s.retryCount + 1, error: 'Reconnecting…' }))
          get()._openSocket(tid)
        }, delay)
        set({ retryTimer: timer })
      } else {
        set({ error: 'Connection lost. Please refresh the page.' })
      }
    }

    set({ socket: ws })
  },

  disconnect: () => {
    const { socket, retryTimer } = get()
    if (retryTimer) clearTimeout(retryTimer)
    if (socket) { socket.onclose = null; socket.close(1000) }
    set({
      socket: null, connected: false, tableId: null,
      gameState: null, myCards: [], validActions: [],
      retryCount: 0, retryTimer: null, error: null,
    })
  },

  sendAction: (action, amount = 0) => {
    const ws = get().socket
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      set({ error: 'Not connected — please wait…' })
      return
    }
    ws.send(JSON.stringify({ type: 'action', action, amount }))
  },

  sendChat: (text) => {
    const ws = get().socket
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'chat', text }))
  },

  loadTableInfo: async (tableId) => {
    try {
      const info = await api.get(`/tables/${tableId}`)
      set({ tableInfo: info, isAdmin: info.is_admin })
    } catch (e) {
      set({ error: e.message })
    }
  },

  _handleMessage: (msg) => {
    switch (msg.type) {
      case 'game_state':
        set({ gameState: msg })
        break
      case 'private_update':
        set({
          gameState:    msg,
          myCards:      msg.my_cards      || [],
          validActions: msg.valid_actions || [],
        })
        break
      case 'hand_complete':
        set({ winners: msg.winners })
        break
      case 'action_log':
        set(s => ({ actionLog: [...s.actionLog.slice(-50), msg.log] }))
        break
      case 'chat':
        set(s => ({ chatMessages: [...s.chatMessages.slice(-100), msg] }))
        break
      case 'game_started':
      case 'new_hand':
        set(s => ({
          winners: null,
          tableInfo: s.tableInfo ? { ...s.tableInfo, started: true } : s.tableInfo,
        }))
        break
      case 'lobby_state':
        set(s => ({
          tableInfo: s.tableInfo
            ? { ...s.tableInfo, players: msg.players, table_name: msg.table_name,
                dealer_choice: msg.dealer_choice }
            : s.tableInfo,
        }))
        break
      case 'player_joined':
      case 'player_disconnected':
        if (get().tableId) get().loadTableInfo(get().tableId)
        break
      case 'variant_selected':
        set(s => ({
          tableInfo: s.tableInfo
            ? { ...s.tableInfo, pending_variant: msg.variant }
            : s.tableInfo,
        }))
        break
      case 'error':
        set({ error: msg.message })
        setTimeout(() => set({ error: null }), 4000)
        break
      case 'pong':
        break // keep-alive response
      default:
        break
    }
  },
}))
