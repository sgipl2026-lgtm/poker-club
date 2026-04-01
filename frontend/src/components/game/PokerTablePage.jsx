import { useEffect, useCallback, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useGameStore } from '../../store/gameStore'
import { api } from '../../utils/api'
import PlayerSeat from './PlayerSeat'
import PlayingCard from './PlayingCard'
import ActionPanel from './ActionPanel'
import ChatPanel   from './ChatPanel'
import WinnersOverlay from './WinnersOverlay'
import clsx from 'clsx'

const SEAT_POSITIONS = [
  { top: '82%', left: '50%',  transform: 'translate(-50%,-50%)' },
  { top: '68%', left: '16%',  transform: 'translate(-50%,-50%)' },
  { top: '38%', left: '6%',   transform: 'translate(-50%,-50%)' },
  { top: '12%', left: '22%',  transform: 'translate(-50%,-50%)' },
  { top: '12%', left: '50%',  transform: 'translate(-50%,-50%)' },
  { top: '12%', left: '78%',  transform: 'translate(-50%,-50%)' },
  { top: '38%', left: '94%',  transform: 'translate(-50%,-50%)' },
  { top: '68%', left: '84%',  transform: 'translate(-50%,-50%)' },
  { top: '82%', left: '30%',  transform: 'translate(-50%,-50%)' },
]

const VARIANT_OPTIONS = [
  { key: 'texas_holdem', name: "Texas Hold'em" },
  { key: 'omaha',        name: 'Omaha' },
  { key: 'omaha_hilo',   name: 'Omaha Hi-Lo' },
]

export default function PokerTablePage() {
  const { tableId }  = useParams()
  const navigate     = useNavigate()
  const { user }     = useAuthStore()
  const [showVariantPicker, setShowVariantPicker] = useState(false)
  const [selectedVariant,   setSelectedVariant]   = useState('texas_holdem')
  const [startingGame,      setStartingGame]       = useState(false)

  const {
    connect, disconnect, sendAction, sendChat, loadTableInfo,
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

  const handleStartGame = async (variantOverride = null) => {
    setStartingGame(true)
    try {
      await api.post(`/tables/${tableId}/start`, { variant_override: variantOverride })
    } catch (e) {
      console.error(e)
    } finally {
      setStartingGame(false)
      setShowVariantPicker(false)
    }
  }

  const handleNextHand = async (variantOverride = null) => {
    try {
      await api.post(`/tables/${tableId}/next_hand`, { variant_override: variantOverride })
    } catch (e) { console.error(e) }
    setShowVariantPicker(false)
    useGameStore.setState({ winners: null })
  }

  const isMyTurn      = gameState?.action_on === user?.id
  const players       = gameState?.players ?? tableInfo?.players ?? []
  const myIndex       = players.findIndex(p => p.user_id === user?.id)
  const seatCount     = tableInfo?.config?.max_seats ?? 9

  // Map only actual seated players around the oval — not empty seats for all 9
  const orderedSeats = SEAT_POSITIONS.slice(0, seatCount).map((pos, i) => {
    const playerIdx = myIndex >= 0 ? (myIndex + i) % players.length : i
    return { pos, player: i < players.length ? players[playerIdx] : null }
  })

  const pots      = gameState?.pots ?? []
  const totalPot  = pots.reduce((s, p) => s + p.amount, 0)
  const lobbyMode = !gameState || gameState.phase === 'waiting' || gameState.phase === 'finished'
  const isDealerChoice = tableInfo?.dealer_choice
  const currentVariantName = gameState?.variant ?? tableInfo?.variant?.replace('_',' ') ?? ''

  return (
    <div className="min-h-screen bg-table flex flex-col text-white overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-table-surface border-b border-table-border flex-shrink-0 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white text-sm transition-colors flex-shrink-0">
            ← Lobby
          </button>
          <span className="text-gray-600">|</span>
          <div className="min-w-0">
            <span className="font-display text-gold font-bold truncate block">
              {tableInfo?.table_name || 'Poker Table'}
            </span>
            <span className="text-xs text-gray-500">#{tableId} · {currentVariantName}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className={clsx('flex items-center gap-1.5 text-xs',
            connected ? 'text-green-400' : 'text-red-400')}>
            <div className={clsx('w-2 h-2 rounded-full', connected ? 'bg-green-400' : 'bg-red-500')} />
            {connected ? 'Live' : 'Reconnecting…'}
          </div>
          <button onClick={() => {
            const url = `${window.location.origin}${window.location.pathname}#/table/${tableId}`
            navigator.clipboard.writeText(url)
          }}
            className="text-xs text-gray-400 hover:text-gold border border-table-border hover:border-gold px-3 py-1.5 rounded-lg transition-colors">
            📋 Invite
          </button>
        </div>
      </header>

      {/* Error toast */}
      {error && (
        <div className="mx-4 mt-2 bg-red-950 border border-red-700 text-red-300 text-sm rounded-xl px-4 py-2 flex-shrink-0">
          {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* ===== TABLE ===== */}
        <main className="flex-1 flex flex-col items-center justify-between p-2 md:p-4 min-w-0 overflow-auto">

          {lobbyMode ? (
            /* ---------- Lobby ---------- */
            <div className="flex-1 flex flex-col items-center justify-center gap-5 w-full max-w-md py-4">
              <div className="text-center">
                <h2 className="font-display text-2xl text-gold font-bold">
                  {tableInfo?.table_name || 'Waiting Room'}
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  {players.length} / {tableInfo?.config?.max_seats ?? 9} players seated
                </p>
                {isDealerChoice && (
                  <div className="mt-2 text-xs text-gold bg-gold/10 border border-gold/20 rounded-lg px-3 py-1">
                    Dealer's Choice — you pick the game before each hand
                  </div>
                )}
              </div>

              {/* Player list */}
              <div className="w-full bg-table-surface border border-table-border rounded-2xl p-4 space-y-2">
                {players.map((p, i) => (
                  <div key={p.user_id ?? i} className="flex items-center gap-3 py-1">
                    <div className="w-8 h-8 rounded-full bg-felt/30 border border-felt flex items-center justify-center text-sm font-bold">
                      {p.username?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-gray-200 text-sm flex-1">{p.username}</span>
                    <span className="text-gold font-mono text-xs">${p.chips?.toLocaleString()}</span>
                    {p.user_id === tableInfo?.admin_id && (
                      <span className="text-xs text-gold border border-gold/30 px-2 py-0.5 rounded-full">Admin</span>
                    )}
                  </div>
                ))}
                {players.length < 2 && (
                  <p className="text-gray-600 text-xs text-center italic py-2">
                    Share the invite link to get more players
                  </p>
                )}
              </div>

              {/* Config summary */}
              {tableInfo?.config && (
                <div className="grid grid-cols-3 gap-2 w-full text-center">
                  {[
                    ['Blinds',    `${tableInfo.config.small_blind}/${tableInfo.config.big_blind}`],
                    ['Chips',     `$${tableInfo.config.starting_chips}`],
                    ['Structure', tableInfo.config.betting_structure?.replace('_',' ')],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-table-surface border border-table-border rounded-xl p-2">
                      <div className="text-xs text-gray-500 mb-0.5">{k}</div>
                      <div className="text-xs font-semibold text-gray-200">{v}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Admin controls */}
              {isAdmin && players.length >= 2 && (
                isDealerChoice && !showVariantPicker ? (
                  <button onClick={() => setShowVariantPicker(true)}
                    className="w-full py-3 bg-gold hover:bg-gold-light text-gray-900 font-bold rounded-2xl transition-colors">
                    Choose Variant & Start Game
                  </button>
                ) : isDealerChoice && showVariantPicker ? (
                  <VariantPicker
                    selected={selectedVariant}
                    onChange={setSelectedVariant}
                    onConfirm={() => handleStartGame(selectedVariant)}
                    loading={startingGame}
                  />
                ) : (
                  <button onClick={() => handleStartGame()} disabled={startingGame}
                    className="w-full py-3 bg-felt hover:bg-felt-light text-white font-bold text-lg rounded-2xl transition-colors disabled:opacity-50 shadow-lg">
                    {startingGame ? 'Starting…' : 'Start Game'}
                  </button>
                )
              )}
              {isAdmin && players.length < 2 && (
                <p className="text-gray-500 text-sm text-center">Need at least 2 players to start</p>
              )}
              {!isAdmin && (
                <p className="text-gray-500 text-sm italic animate-pulse text-center">
                  Waiting for {tableInfo?.admin_id ? 'admin' : 'host'} to start the game…
                </p>
              )}
            </div>

          ) : (
            /* ---------- Active game ---------- */
            <>
              {/* Felt table */}
              <div className="relative w-full" style={{ maxWidth: 620, aspectRatio: '16/10' }}>
                {/* Oval */}
                <div className="absolute inset-[10%] rounded-[50%] bg-felt border-[8px] border-[#7b5533]"
                  style={{ boxShadow: 'inset 0 4px 24px rgba(0,0,0,0.4), 0 4px 24px rgba(0,0,0,0.5)' }}>

                  {/* Community cards + pot */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                    <div className="text-[10px] text-white/50 uppercase tracking-widest">
                      {gameState?.phase?.replace('_', ' ')}
                      {gameState?.variant && ` · ${gameState.variant}`}
                    </div>
                    <div className="flex gap-1.5">
                      {(gameState?.community_cards ?? []).map((c, i) => (
                        <PlayingCard key={i} card={c} size="sm" />
                      ))}
                      {gameState?.community_cards && Array.from({
                        length: Math.max(0, 5 - gameState.community_cards.length)
                      }).map((_, i) => (
                        <div key={i} className="w-10 h-14 rounded-lg border-2 border-dashed border-felt-dark opacity-20" />
                      ))}
                    </div>
                    {totalPot > 0 && (
                      <div className="text-center mt-1">
                        <div className="text-[10px] text-white/50 uppercase tracking-wider">Pot</div>
                        <div className="text-gold font-bold font-mono text-xl">${totalPot.toLocaleString()}</div>
                        {pots.length > 1 && pots.map((p, i) => (
                          <div key={i} className="text-[9px] text-white/40">{p.name}: ${p.amount}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Player seats — only actual seats, not 9 empty ones */}
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

              {/* YOUR TURN banner */}
              {isMyTurn && (
                <div className="w-full max-w-lg">
                  <div className="text-center py-1.5 bg-gold/10 border border-gold/30 rounded-xl mb-2">
                    <span className="text-gold font-bold text-sm uppercase tracking-widest animate-pulse">
                      ⚡ Your Turn — Act Now
                    </span>
                  </div>
                </div>
              )}

              {/* Action panel */}
              <div className="w-full max-w-lg mt-1">
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

        {/* ===== SIDEBAR ===== */}
        <aside className="w-56 flex-shrink-0 flex-col border-l border-table-border bg-table-surface p-3 gap-3 hidden md:flex">
          {/* Next hand / dealer choice controls */}
          {isAdmin && winners && (
            <div className="space-y-2">
              {isDealerChoice ? (
                <>
                  <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Next Hand</div>
                  <VariantPicker
                    selected={selectedVariant}
                    onChange={setSelectedVariant}
                    onConfirm={() => handleNextHand(selectedVariant)}
                    compact
                  />
                </>
              ) : (
                <button onClick={() => handleNextHand()}
                  className="w-full py-2 bg-felt hover:bg-felt-light text-white text-sm font-semibold rounded-xl transition-colors">
                  Next Hand →
                </button>
              )}
            </div>
          )}

          {/* Action log */}
          <div className="flex-1 min-h-0">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Action Log</div>
            <div className="space-y-1 overflow-y-auto" style={{ maxHeight: 220 }}>
              {actionLog.slice(-30).reverse().map((entry, i) => (
                <div key={i} className="text-xs leading-snug">
                  <span className={clsx(
                    'font-medium',
                    entry.user_id === user?.id ? 'text-felt-light' : 'text-gray-300'
                  )}>
                    {entry.username}
                  </span>
                  {' '}
                  <span className="text-gray-500">{entry.action}</span>
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

          <ChatPanel messages={chatMessages} onSend={sendChat} className="flex-shrink-0" />
        </aside>
      </div>

      <WinnersOverlay
        winners={winners}
        isAdmin={isAdmin}
        isDealerChoice={isDealerChoice}
        selectedVariant={selectedVariant}
        onVariantChange={setSelectedVariant}
        onNextHand={handleNextHand}
        onDismiss={() => useGameStore.setState({ winners: null })}
      />
    </div>
  )
}

function VariantPicker({ selected, onChange, onConfirm, loading, compact }) {
  const VARIANTS = [
    { key: 'texas_holdem', name: "Texas Hold'em" },
    { key: 'omaha',        name: 'Omaha' },
    { key: 'omaha_hilo',   name: 'Omaha Hi-Lo' },
  ]
  return (
    <div className="space-y-2">
      {VARIANTS.map(v => (
        <button key={v.key} onClick={() => onChange(v.key)}
          className={clsx(
            'w-full text-left px-3 py-2 rounded-lg text-sm border transition-all',
            selected === v.key
              ? 'border-gold bg-gold/15 text-gold font-semibold'
              : 'border-table-border text-gray-400 hover:border-gray-500 hover:text-gray-200'
          )}>
          {v.name}
        </button>
      ))}
      <button onClick={onConfirm} disabled={loading}
        className={clsx(
          'w-full font-bold rounded-xl transition-colors disabled:opacity-50',
          compact ? 'py-2 text-sm bg-felt hover:bg-felt-light text-white'
                  : 'py-3 text-base bg-gold hover:bg-gold-light text-gray-900'
        )}>
        {loading ? 'Starting…' : compact ? 'Deal →' : `Start ${VARIANTS.find(v=>v.key===selected)?.name}`}
      </button>
    </div>
  )
}
