import type { User } from '@supabase/supabase-js'
import { useState } from 'react'
import type { SyncStatus } from '../lib/store'
import { Sheet } from './Sheet'

interface Props {
  user: User | null
  loading: boolean
  configured: boolean
  error?: string
  syncStatus: SyncStatus
  onSendCode: (email: string) => Promise<boolean>
  onVerifyCode: (email: string, token: string) => Promise<boolean>
  onSignOut: () => void
  onClose: () => void
}

const SYNC_LABEL: Record<SyncStatus, string> = {
  local: 'Saved on this device',
  syncing: 'Syncing…',
  synced: 'Saved to your account',
  error: 'Sync paused. Your changes are safe on this device.',
}

export function AccountSheet({ user, loading, configured, error, syncStatus, onSendCode, onVerifyCode, onSignOut, onClose }: Props) {
  const avatar = user?.user_metadata.avatar_url as string | undefined
  const name = (user?.user_metadata.full_name as string | undefined) ?? user?.email
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const sendCode = async () => {
    if (!email.trim()) return
    setSubmitting(true)
    const sent = await onSendCode(email.trim())
    setSubmitting(false)
    if (sent) setCodeSent(true)
  }

  const verifyCode = async () => {
    if (code.trim().length !== 6) return
    setSubmitting(true)
    const verified = await onVerifyCode(email.trim(), code.trim())
    setSubmitting(false)
    if (verified) onClose()
  }

  return (
    <Sheet onClose={onClose}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-900">{user ? 'Your account' : 'Back up your closet'}</h2>
          <p className="mt-1 text-sm text-stone-500">
            {user ? SYNC_LABEL[syncStatus] : 'Sign in to keep your closet backed up and see it on every device.'}
          </p>
        </div>
        <button onClick={onClose} className="rounded-full bg-stone-100 px-3 py-1.5 text-sm font-semibold text-stone-500">
          Done
        </button>
      </div>

      {user ? (
        <>
          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-100">
            {avatar ? (
              <img src={avatar} alt="" className="h-11 w-11 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="grid h-11 w-11 place-items-center rounded-full bg-stone-900 font-bold text-white">
                {(name ?? 'Y').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate font-semibold text-stone-900">{name}</div>
              {name !== user.email && <div className="truncate text-sm text-stone-500">{user.email}</div>}
            </div>
          </div>
          <button onClick={onSignOut} className="mt-5 w-full rounded-xl bg-stone-100 py-3 font-semibold text-stone-700 active:bg-stone-200">
            Sign out
          </button>
          <p className="mt-3 text-center text-xs leading-relaxed text-stone-400">
            Signing out hides this account’s closet from this device. Sign in again to bring them back.
          </p>
        </>
      ) : (
        <>
          {!codeSent ? (
            <form
              className="mt-6"
              onSubmit={(event) => {
                event.preventDefault()
                void sendCode()
              }}
            >
              <label htmlFor="account-email" className="text-sm font-semibold text-stone-700">
                Email
              </label>
              <input
                id="account-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-2 w-full rounded-xl bg-stone-50 px-4 py-3 text-base text-stone-900 ring-1 ring-stone-200 outline-none focus:ring-2 focus:ring-stone-900"
              />
              <button
                type="submit"
                disabled={loading || submitting || !configured || !email.trim()}
                className="mt-3 w-full rounded-xl bg-stone-900 py-3.5 font-semibold text-white disabled:opacity-50"
              >
                {loading ? 'Checking account…' : submitting ? 'Sending…' : 'Email me a sign-in code'}
              </button>
            </form>
          ) : (
            <form
              className="mt-6"
              onSubmit={(event) => {
                event.preventDefault()
                void verifyCode()
              }}
            >
              <label htmlFor="account-code" className="text-sm font-semibold text-stone-700">
                Enter the 6-digit code sent to {email}
              </label>
              <input
                id="account-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoFocus
                className="mt-2 w-full rounded-xl bg-stone-50 px-4 py-3 text-center text-2xl font-semibold tracking-[0.35em] text-stone-900 ring-1 ring-stone-200 outline-none focus:ring-2 focus:ring-stone-900"
              />
              <button
                type="submit"
                disabled={submitting || code.length !== 6}
                className="mt-3 w-full rounded-xl bg-stone-900 py-3.5 font-semibold text-white disabled:opacity-50"
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCodeSent(false)
                  setCode('')
                }}
                className="mt-3 w-full py-2 text-sm font-semibold text-stone-500"
              >
                Use a different email
              </button>
            </form>
          )}
          {!configured && <p className="mt-3 text-center text-sm text-amber-600">Cloud accounts are being set up.</p>}
          <p className="mt-4 text-center text-xs leading-relaxed text-stone-400">
            Items you’ve already added move into your account the first time you sign in.
          </p>
        </>
      )}
      {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}
    </Sheet>
  )
}
