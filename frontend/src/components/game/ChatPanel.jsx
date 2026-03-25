import { useState, useEffect, useRef } from 'react'
import clsx from 'clsx'

export default function ChatPanel({ messages, onSend, className }) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(true)
  const [unread, setUnread] = useState(0)
  const bottomRef = useRef(null)
  const prevLen   = useRef(0)

  useEffect(() => {
    if (messages.length > prevLen.current) {
      if (!open) setUnread(u => u + (messages.length - prevLen.current))
      else bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevLen.current = messages.length
  }, [messages, open])

  const handleOpen = () => { setOpen(true); setUnread(0) }

  const submit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text.trim())
    setText('')
  }

  return (
    <div className={clsx('flex flex-col bg-table-surface border border-table-border rounded-2xl overflow-hidden', className)}>
      {/* Header */}
      <button onClick={() => open ? setOpen(false) : handleOpen()}
        className="flex items-center justify-between px-4 py-2.5 border-b border-table-border hover:bg-table-border/30 transition-colors">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          Chat
          {unread > 0 && (
            <span className="w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unread}
            </span>
          )}
        </span>
        <span className="text-gray-600 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0" style={{ maxHeight: 180 }}>
            {messages.length === 0 && (
              <p className="text-gray-600 text-xs italic text-center py-4">No messages yet</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={clsx('text-xs leading-snug', m.type === 'system_event' ? 'text-gray-500 italic' : '')}>
                {m.username && (
                  <span className="font-semibold text-felt-light mr-1">{m.username}:</span>
                )}
                <span className="text-gray-300">{m.text}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={submit} className="flex gap-2 p-2 border-t border-table-border">
            <input
              value={text} onChange={e => setText(e.target.value)}
              placeholder="Say something…"
              className="flex-1 bg-table border border-table-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-felt-light"
            />
            <button type="submit"
              className="px-3 py-1.5 bg-felt hover:bg-felt-light rounded-lg text-white text-xs font-semibold transition-colors">
              Send
            </button>
          </form>
        </>
      )}
    </div>
  )
}
