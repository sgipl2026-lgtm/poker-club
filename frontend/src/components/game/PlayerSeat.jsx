import clsx from 'clsx'
import PlayingCard from './PlayingCard'

export default function PlayerSeat({ player, isCurrentUser, isActive, myCards, dealerSeat }) {
  if (!player) {
    return (
      <div className="flex flex-col items-center gap-1 opacity-20 pointer-events-none">
        <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-700" />
      </div>
    )
  }

  const isDealer = player.seat === dealerSeat

  return (
    <div className={clsx(
      'flex flex-col items-center gap-1 transition-all duration-300',
      isActive && 'scale-110 z-10',
    )}>
      {/* Cards */}
      <div className="flex gap-1">
        {isCurrentUser
          ? myCards.map((c, i) => <PlayingCard key={i} card={c} size="sm" />)
          : Array.from({ length: player.card_count || 0 }).map((_, i) => (
              <PlayingCard key={i} faceDown size="sm" />
            ))
        }
      </div>

      {/* Active turn glow ring */}
      {isActive && (
        <div className="absolute inset-0 rounded-full pointer-events-none"
          style={{ animation: 'none' }} />
      )}

      {/* Avatar */}
      <div className={clsx(
        'relative w-12 h-12 rounded-full flex items-center justify-center',
        'border-2 transition-all duration-300 text-base font-bold select-none',
        player.folded
          ? 'border-gray-700 bg-gray-800 opacity-40 text-gray-600'
          : isActive
          // Big bright gold pulse for current turn player
          ? 'border-gold bg-gold/20 text-gold shadow-[0_0_0_4px_rgba(201,168,76,0.4),0_0_16px_rgba(201,168,76,0.3)]'
          : isCurrentUser
          ? 'border-felt-light bg-felt/30 text-white'
          : 'border-gray-600 bg-table-surface text-gray-300'
      )}>
        {player.username?.[0]?.toUpperCase() ?? '?'}

        {/* All-in badge */}
        {player.all_in && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[8px] font-black px-1 py-0.5 rounded-full leading-none">
            ALL IN
          </span>
        )}
        {/* Dealer button */}
        {isDealer && (
          <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-white text-gray-900 text-[9px] font-black rounded-full flex items-center justify-center shadow-md border border-gray-300">
            D
          </span>
        )}
      </div>

      {/* Name + chips */}
      <div className="text-center max-w-[80px]">
        {/* YOUR TURN label — very visible */}
        {isActive && (
          <div className="text-[10px] font-black text-gold uppercase tracking-widest mb-0.5 animate-pulse">
            ▶ Acting
          </div>
        )}
        <div className={clsx(
          'text-xs font-semibold leading-tight truncate',
          isActive ? 'text-gold' : isCurrentUser ? 'text-felt-light' : 'text-gray-300',
          player.folded && 'line-through text-gray-600'
        )}>
          {player.username}
          {isCurrentUser && <span className="text-gray-500 font-normal"> (you)</span>}
        </div>
        <div className={clsx(
          'text-xs font-mono',
          player.chips < 100 ? 'text-red-400' : 'text-gold-light'
        )}>
          ${player.chips?.toLocaleString()}
        </div>
        {player.bet > 0 && (
          <div className="text-[10px] text-yellow-300 font-semibold">
            bet ${player.bet}
          </div>
        )}
        {player.folded && (
          <div className="text-[10px] text-red-400 italic">folded</div>
        )}
      </div>
    </div>
  )
}
