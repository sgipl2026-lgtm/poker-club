import { useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useGameStore } from '../../store/gameStore'
import PlayerSeat from './PlayerSeat'
import PlayingCard from './PlayingCard'
import ActionPanel from './ActionPanel'
import ChatPanel   from './ChatPanel'
import WinnersOverlay from './WinnersOverlay'
import clsx from 'clsx'

// Seat positions around the oval table (as % of container width/height)
const SEAT_POSITIONS = [
  { top: '85%', left: '50%',  transform: 'translate(-50%,-50%)' }, // bottom center  (you)
  { top: '70%', left: '15%',  transform: 'translate(-50%,-50%)' }, // bottom left
  { top: '35%', left: '8%',   transform: 'translate(-50%,-50%)' }, // mid left
  { top: '10%', left: '25%',  transform: 'translate(-50%,-50%)' }, // top left
  { top: '10%', left: '50%',  transform: 'translate(-50%,-50%)' }, // top center
  { top: '10%', left: '75%',  transform: 'translate(-50%,-50%)' }, // top right
  { top: '35%', left: '92%',  transform: 'translate(-50%,-50%)' }, // mid right
  { top: '70%', left: '85%',  transform: 'translate(-50%,-50%)' }, // bottom right
  { top: '85%', left: '30%',  transform: 'translate(-50%,-50%)' }, // bottom left 2
]

export default function PokerTablePage() {
  const { tableId }  = useParams()
  const navigate     = useNavigate()
  const { user, profile } = useAuthStore()

  const {
    connect, disconnect, sendAction, sendChat, startGame, loadTableInfo,
    gameState, myCards, validActions, chatMessages, actionLog, winners, error,
    tableInfo, isAdmin, connected,
  } = useGameStore()

  useEffect(() => {
    if (!user) { navigate('/auth'); return }
    loadTableInfo(tableId)
    connect(tableId)
    return () => disconnect()
  }, [tableId, user])

  const handleAction = useCallback((action, amount = 0) => {
    sendAction(action, amount)
  }, [sendAction])

  const isMyTurn = gameState?.action_on === user?.id

  // Remap players so current user always appears at seat index 0 (bottom)
  const players      = gameState?.players ?? tableInfo?.players ?? []
  const myIndex      = players.findIndex(p => p.user_id === user?.id)
  const orderedSeats = SEAT_POSITIONS.map((pos, i) => {
    const playerIdx = myIndex >= 0 ? (myIndex + i) % players.length : i
    return { pos, player: players[playerIdx] ?? null }
  })

  const pots = gameState?.pots ?? []
  const totalPot = pots.reduce((s, p) => s + p.amount, 0)

  const lobbyMode = !gameState || gameState.phase === 'waiting'

  return (
    <div className="min-h-screen bg-table flex flex-col text-white">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-table-surface border-b border-table-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white text-sm transition-colors">← Lobby</button>
          <span className="text-gray-600">|</span>
          <span className="font-display text-gold font-bold">{tableInfo?.variant?.replace('_',' ')?.replace(/\b\w/g, c => c.toUpperCase())}</span>
          <span className="text-xs text-gray-500">#{tableId}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={clsx('w-2 h-2 rounded-full', connected ? 'bg-green-400' : 'bg-red-500')} />
          <span className="text-xs text-gray-400">{connected ? 'Connected' : 'Reconnecting…'}</span>
        </div>
        {/* Invite link copy */}
        <button onClick={() => navigator.clipboard.writeText(window.location.href)}
          className="text-xs text-gray-400 hover:text-gold border border-table-border hover:border-gold px-3 py-1 rounded-lg transition-colors">
          Copy Invite Link
        </button>
      </header>

      {/* Error toast */}
      {error && (
        <div className="mx-4 mt-2 bg-red-950 border border-red-700 text-red-300 text-sm rounded-xl px-4 py-2">
          {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ====== TABLE ====== */}
        <main className="flex-1 flex flex-col items-center justify-between p-2 md:p-4 min-w-0">

          {lobbyMode ? (
            /* ---- Lobby / Waiting room ---- */
            <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full max-w-md">
              <div className="text-center">
                <h2 className="font-display text-2xl text-gold font-bold">Waiting Room</h2>
                <p className="text-gray-400 text-sm mt-1">
                  {players.length} / {tableInfo?.config?.max_seats ?? 9} players seated
                </p>
              </div>

              <div className="w-full bg-table-surface border border-table-border rounded-2xl p-4 space-y-2">
                {players.map((p, i) => (
                  <div key={p.user_id ?? i} className="flex items-center gap-3 py-1">
                    <div className="w-8 h-8 rounded-full bg-felt/30 border border-felt flex items-center justify-center text-sm font-bold text-white">
                      {p.username?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-gray-200 text-sm">{p.username}</span>
                    {p.user_id === tableInfo?.admin_id && (
                      <span className="ml-auto text-xs text-gold border border-gold/30 px-2 py-0.5 rounded-full">Admin</span>
                    )}
                  </div>
                ))}
              </div>

              {isAdmin && players.length >= 2 && (
                <button onClick={startGame}
                  className="w-full py-4 bg-felt hover:bg-felt-light text-white font-bold text-lg rounded-2xl transition-colors shadow-lg">
                  Start Game
                </button>
              )}
              {isAdmin && players.length < 2 && (
                <p className="text-gray-500 text-sm">Need at least 2 players to start</p>
              )}
              {!isAdmin && (
                <p className="text-gray-500 text-sm animate-pulse">Waiting for admin to start the game…</p>
              )}

              {/* Config summary */}
              {tableInfo?.config && (
                <div className="grid grid-cols-3 gap-2 w-full text-center">
                  {[
                    ['Blinds', `${tableInfo.config.small_blind}/${tableInfo.config.big_blind}`],
                    ['Chips',  `${tableInfo.config.starting_chips}`],
                    ['Structure', tableInfo.config.betting_structure?.replace('_',' ')],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-table-surface border border-table-border rounded-xl p-2">
                      <div className="text-xs text-gray-500 mb-0.5">{k}</div>
                      <div className="text-sm font-semibold text-gray-200">{v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          ) : (
            /* ---- Active Game ---- */
            <>
              {/* Felt table */}
              <div className="relative w-full" style={{ maxWidth: 640, aspectRatio: '16/10' }}>
                {/* Oval felt */}
                <div className="absolute inset-[12%] rounded-[50%] bg-felt border-[8px] border-[#7b5533] shadow-inner"
                  style={{ boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.4)' }}>

                  {/* Community cards */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <div className="flex gap-1.5">
                      {(gameState?.community_cards ?? []).map((c, i) => (
                        <PlayingCard key={i} card={c} size="sm" />
                      ))}
                      {Array.from({ length: Math.max(0, 5 - (gameState?.community_cards?.length ?? 0)) }).map((_, i) => (
                        <div key={i} className="w-10 h-14 rounded-lg border-2 border-dashed border-felt-dark opacity-30" />
                      ))}
                    </div>

                    {/* Pot */}
                    {totalPot > 0 && (
                      <div className="text-center">
                        <div className="text-xs text-white/60 uppercase tracking-wider">Pot</div>
                        <div className="text-gold font-bold font-mono text-lg">${totalPot.toLocaleString()}</div>
                        {pots.length > 1 && pots.map((p, i) => (
                          <div key={i} className="text-[10px] text-white/50">{p.name}: ${p.amount}</div>
                        ))}
                      </div>
                    )}

                    {/* Phase badge */}
                    <div className="text-xs text-white/50 uppercase tracking-widest">
                      {gameState?.phase?.replace('_', ' ')}
                    </div>
                  </div>
                </div>

                {/* Player seats */}
                {orderedSeats.map(({ pos, player }, i) => (
                  <div key={i} className="absolute" style={pos}>
                    <PlayerSeat
                      player={player}
                      isCurrentUser={player?.user_id === user?.id}
                      isActive={player?.user_id === gameState?.action_on}
                      myCards={player?.user_id === user?.id ? myCards : []}
                      dealerSeat={gameState?.dealer_seat}
                    />
                  </div>
                ))}
              </div>

              {/* Action panel */}
              <div className="w-full max-w-lg mt-2">
                {isMyTurn && (
                  <div className="text-center text-xs text-gold font-semibold uppercase tracking-widest mb-2 animate-pulse">
                    Your turn
                  </div>
                )}
                <ActionPanel
                  validActions={validActions}
                  gameState={gameState}
                  onAction={handleAction}
                  disabled={!isMyTurn}
                />
              </div>
            </>
          )}
        </main>

        {/* ====== SIDEBAR ====== */}
        <aside className="w-56 flex-shrink-0 flex flex-col border-l border-table-border bg-table-surface p-3 gap-3 hidden md:flex">
          {/* Action log */}
          <div className="flex-1 min-h-0">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Action Log</div>
            <div className="space-y-1 overflow-y-auto" style={{ maxHeight: 240 }}>
              {actionLog.slice(-20).reverse().map((entry, i) => (
                <div key={i} className="text-xs">
                  <span className="text-felt-light font-medium">{entry.username}</span>
                  {' '}
                  <span className="text-gray-400">{entry.action}</span>
                  {entry.amount > 0 && (
                    <span className="text-gold font-mono"> ${entry.amount}</span>
                  )}
                </div>
              ))}
              {actionLog.length === 0 && (
                <p className="text-gray-600 text-xs italic">No actions yet</p>
              )}
            </div>
          </div>

          {/* Chat */}
          <ChatPanel
            messages={chatMessages}
            onSend={sendChat}
            className="flex-shrink-0"
          />
        </aside>
      </div>

      {/* Winners overlay */}
      <WinnersOverlay winners={winners} onDismiss={() => useGameStore.setState({ winners: null })} />
    </div>
  )
}
