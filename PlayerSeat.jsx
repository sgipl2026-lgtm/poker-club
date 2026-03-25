import clsx from 'clsx'
import PlayingCard from './PlayingCard'

export default function PlayerSeat({ player, isCurrentUser, isActive, myCards, dealerSeat }) {
  if (!player) {
    return (
      <div className="flex flex-col items-center gap-1 opacity-30">
        <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center">
          <span className="text-gray-500 text-lg">+</span>
        </div>
        <span className="text-xs text-gray-600">Empty</span>
      </div>
    )
  }

  const isDealer = player.seat === dealerSeat

  return (
    <div className={clsx(
      'flex flex-col items-center gap-1.5 transition-all duration-300',
      isActive && 'scale-105',
    )}>
      {/* Cards above avatar */}
      <div className="flex gap-1">
        {isCurrentUser
          ? myCards.map((c, i) => (
              <PlayingCard key={i} card={c} size="sm" />
            ))
          : Array.from({ length: player.card_count || 0 }).map((_, i) => (
              <PlayingCard key={i} faceDown size="sm" />
            ))
        }
      </div>

      {/* Avatar ring */}
      <div className={clsx(
        'relative w-12 h-12 rounded-full flex items-center justify-center',
        'border-2 transition-all duration-300 text-lg font-bold',
        player.folded
          ? 'border-gray-700 bg-gray-800 opacity-40 text-gray-500'
          : isActive
          ? 'border-gold bg-gold/10 text-gold animate-pulse-gold'
          : isCurrentUser
          ? 'border-felt-light bg-felt/20 text-white'
          : 'border-gray-600 bg-table-surface text-gray-300'
      )}>
        {player.username?.[0]?.toUpperCase() ?? '?'}
        {/* All-in badge */}
        {player.all_in && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold px-1 rounded">AI</span>
        )}
        {/* Dealer chip */}
        {isDealer && (
          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-white text-gray-900 text-[8px] font-black rounded-full flex items-center justify-center shadow">D</span>
        )}
      </div>

      {/* Name + chips */}
      <div className="text-center">
        <div className={clsx(
          'text-xs font-semibold leading-tight',
          isCurrentUser ? 'text-felt-light' : 'text-gray-200',
          player.folded && 'line-through text-gray-600'
        )}>
          {player.username}
          {isCurrentUser && <span className="text-gray-500"> (you)</span>}
        </div>
        <div className={clsx(
          'text-xs font-mono',
          player.chips < 100 ? 'text-red-400' : 'text-gold'
        )}>
          ${player.chips.toLocaleString()}
        </div>
        {player.bet > 0 && (
          <div className="text-[10px] text-yellow-300 font-medium">
            bet ${player.bet}
          </div>
        )}
      </div>
    </div>
  )
}
