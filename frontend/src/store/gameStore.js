import { create } from 'zustand'
import { api } from '../utils/api'

export const useGameStore = create((set, get) => ({
  // Connection
  socket:      null,
  connected:   false,
  tableId:     null,

  // Game state (from server)
  gameState:   null,
  myCards:     [],
  validActions:[],
  chatMessages:[],
  actionLog:   [],
  winners:     null,
  error:       null,

  // Table lobby state
  tableInfo:   null,
  isAdmin:     false,

  connect: async (tableId) => {
    const existing = get().socket
    if (existing) existing.close()

    set({ tableId, connected: false, error: null, winners: null })

    const ws = await api.createWebSocket(tableId)

    ws.onopen = () => set({ connected: true })

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      get()._handleMessage(msg)
    }

    ws.onerror = () => set({ error: 'Connection error', connected: false })

    ws.onclose = () => set({ connected: false })

    set({ socket: ws })
  },

  disconnect: () => {
    get().socket?.close()
    set({ socket: null, connected: false, gameState: null, myCards: [], validActions: [] })
  },

  sendAction: (action, amount = 0) => {
    const ws = get().socket
    if (!ws || ws.readyState !== WebSocket.OPEN) return
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

  startGame: async () => {
    const { tableId } = get()
    await api.post(`/tables/${tableId}/start`)
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
        set(s => ({ tableInfo: s.tableInfo ? { ...s.tableInfo, started: true } : s.tableInfo }))
        break
      case 'lobby_state':
        set(s => ({
          tableInfo: s.tableInfo ? { ...s.tableInfo, players: msg.players } : s.tableInfo,
        }))
        break
      case 'error':
        set({ error: msg.message })
        setTimeout(() => set({ error: null }), 4000)
        break
      case 'player_joined':
      case 'player_disconnected':
        // Refetch table info for lobby updates
        if (get().tableId) get().loadTableInfo(get().tableId)
        break
      default:
        break
    }
  },
}))
