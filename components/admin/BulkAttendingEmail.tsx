'use client'

import { useEffect, useMemo, useState } from 'react'
import { FINAL_HEADCOUNT_DEFAULTS } from '@/lib/email-templates'

export interface BulkRecipient {
  id: string
  name: string
  email?: string | null
  rsvpdCount?: number | null
}

type SendResult = { guestId: string; email: string | null; success: boolean; error?: string }

// The route caps a request at 100 ids and pauses 600ms between sends, so a batch
// is both a size limit and roughly a minute of waiting per 100 people.
const BATCH_SIZE = 100

/**
 * "Can we make it so she can review and edit the email before she sends them?"
 * — Whitney, 2026-09-04.
 *
 * The thing being edited is a TEMPLATE, not a message: one set of words goes to
 * every attending guest, while the greeting and the party count are filled in per
 * person. So the boxes hold only the prose, the preview is rendered by the server
 * for a named real recipient, and the personalised lines are labelled as such —
 * otherwise the preview reads as though all 63 people get "Hi Jean! ... 2 guests".
 */
export function BulkAttendingEmail({
  recipients,
  onClose,
  onSent,
}: {
  recipients: BulkRecipient[]
  onClose: () => void
  onSent?: () => void
}) {
  const [subject, setSubject] = useState<string>(FINAL_HEADCOUNT_DEFAULTS.subject)
  const [heading, setHeading] = useState<string>(FINAL_HEADCOUNT_DEFAULTS.heading)
  const [intro, setIntro] = useState<string>(FINAL_HEADCOUNT_DEFAULTS.intro)
  const [ask, setAsk] = useState<string>(FINAL_HEADCOUNT_DEFAULTS.ask)
  const [includeCount, setIncludeCount] = useState(true)

  // The boxes are a draft. They open on whatever was saved last time, and "Save as
  // the default wording" makes the current draft what they open on next time — so a
  // correction she makes once does not have to be retyped on the next send.
  const [loadingWording, setLoadingWording] = useState(true)
  const [savedWording, setSavedWording] = useState(false)
  const [savingWording, setSavingWording] = useState(false)
  const [wordingMsg, setWordingMsg] = useState('')

  const [previewHtml, setPreviewHtml] = useState('')
  const [previewedAs, setPreviewedAs] = useState<{ name: string; rsvpdCount: number | null } | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewError, setPreviewError] = useState('')

  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<SendResult[] | null>(null)

  // Someone with no address on file cannot be emailed; the route would only
  // report "No email on file" per row, so say it up front instead.
  const sendable = useMemo(() => recipients.filter((r) => r.email), [recipients])
  const skipped = recipients.length - sendable.length
  const sampleGuest = sendable[previewIndex] ?? sendable[0]

  const content = useMemo(
    () => ({ subject, heading, intro, ask, includeCount }),
    [subject, heading, intro, ask, includeCount]
  )

  // Load once, on open. Deliberately before the form is editable: seeding the boxes
  // with the suggestion and then overwriting them a moment later would discard
  // anything she had already started typing.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/email-wording')
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (cancelled || !data?.wording) return
        setSubject(data.wording.subject)
        setHeading(data.wording.heading)
        setIntro(data.wording.intro)
        setAsk(data.wording.ask)
        setIncludeCount(data.wording.includeCount !== false)
        setSavedWording(Boolean(data.saved))
      } catch {
        // Fall back to the suggestion already in state — she can still send.
        if (!cancelled) setWordingMsg('Could not load the saved wording; showing the original.')
      } finally {
        if (!cancelled) setLoadingWording(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function saveWording() {
    setSavingWording(true)
    setWordingMsg('')
    try {
      const res = await fetch('/api/admin/email-wording', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, heading, intro, ask, includeCount }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Not saved')
      setSavedWording(true)
      setWordingMsg('Saved ✓ This is what the form will open on next time.')
    } catch (err) {
      setWordingMsg(err instanceof Error ? err.message : 'Not saved')
    } finally {
      setSavingWording(false)
    }
  }

  // The preview comes from the same renderer that sends, so what she approves is
  // exactly what leaves — no second copy of the layout to drift out of step.
  useEffect(() => {
    if (!sampleGuest || loadingWording) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/admin/rsvps/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestIds: [sampleGuest.id],
            template: 'final_headcount',
            dryRun: true,
            content,
          }),
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (cancelled) return
        setPreviewHtml(data?.preview?.html ?? '')
        setPreviewedAs(data?.previewedAs ?? null)
        setPreviewError('')
      } catch {
        if (!cancelled) setPreviewError('Preview unavailable — your changes are still saved.')
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [content, sampleGuest, loadingWording])

  async function send() {
    setSending(true)
    setProgress(0)
    const all: SendResult[] = []
    try {
      for (let i = 0; i < sendable.length; i += BATCH_SIZE) {
        const batch = sendable.slice(i, i + BATCH_SIZE)
        const res = await fetch('/api/admin/rsvps/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestIds: batch.map((g) => g.id),
            template: 'final_headcount',
            content,
          }),
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        all.push(...((data?.results ?? []) as SendResult[]))
        setProgress(all.length)
      }
      setResults(all)
      onSent?.()
    } catch {
      // Whatever came back before the failure did go out; showing the partial
      // list matters more than a tidy error, so she knows who to skip on a retry.
      setResults(all.length > 0 ? all : [])
      setPreviewError('The send stopped partway. The people listed below were already emailed.')
    } finally {
      setSending(false)
    }
  }

  const failures = results?.filter((r) => !r.success) ?? []
  const sent = results ? results.length - failures.length : 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Email attending guests</h3>
            <p className="text-sm text-gray-600">
              {results
                ? 'Send complete.'
                : `Goes to ${sendable.length} ${sendable.length === 1 ? 'party' : 'parties'} marked attending.`}
              {!results && skipped > 0 && (
                <span className="text-amber-700">
                  {' '}
                  {skipped} {skipped === 1 ? 'has' : 'have'} no email on file and will be skipped.
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={sending}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none disabled:opacity-40"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {loadingWording && !results ? (
          <div className="p-6 text-sm text-gray-600">Loading the saved wording…</div>
        ) : results ? (
          <div className="p-6 overflow-y-auto space-y-4">
            <p className="text-sm text-gray-900">
              Sent to <strong>{sent}</strong> of {sendable.length}.
            </p>
            {previewError && <p className="text-sm text-red-700">{previewError}</p>}
            {failures.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">
                  {failures.length} did not go out:
                </p>
                <ul className="text-sm text-gray-700 list-disc pl-5 space-y-0.5">
                  {failures.map((f) => (
                    <li key={f.guestId}>
                      {f.email ?? 'no address'} — {f.error ?? 'failed'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-gray-500">
              Every send is recorded on the Emails tab.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto grid md:grid-cols-2 gap-6 p-6">
            {/* Left: what she edits */}
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Subject line</span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Headline (inside the email)</span>
                <input
                  value={heading}
                  onChange={(e) => setHeading(e.target.value)}
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Opening</span>
                <textarea
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  rows={4}
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                />
                <span className="text-xs text-gray-500">
                  Each guest&apos;s own greeting (&ldquo;Hi Jean!&rdquo;) is added in front of this
                  automatically. Leave a blank line for a new paragraph.
                </span>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">The ask</span>
                <textarea
                  value={ask}
                  onChange={(e) => setAsk(e.target.value)}
                  rows={4}
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={includeCount}
                  onChange={(e) => setIncludeCount(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-gray-700">
                  Tell each guest the number you have for them
                  <span className="block text-xs text-gray-500">
                    e.g. &ldquo;We have you down for 2 guests.&rdquo; Their own number, not this
                    one. Anybody with no number recorded just won&apos;t see the line.
                  </span>
                </span>
              </label>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {/* Makes the current draft what the form opens on next time. Separate
                    from sending on purpose: saving the wording sends nothing, and
                    sending does not quietly change the saved wording. */}
                <button
                  onClick={saveWording}
                  disabled={savingWording || sending}
                  className="px-3 py-1.5 rounded-md border border-[#00330a] text-[#00330a] text-sm hover:bg-[#00330a] hover:text-white transition-colors disabled:opacity-40"
                >
                  {savingWording ? 'Saving…' : 'Save as the default wording'}
                </button>
                {/* Fills the boxes with the original suggestion. It does not touch
                    what is saved until she saves, so this is safe to click just to
                    see what the wording used to say. */}
                <button
                  onClick={() => {
                    setSubject(FINAL_HEADCOUNT_DEFAULTS.subject)
                    setHeading(FINAL_HEADCOUNT_DEFAULTS.heading)
                    setIntro(FINAL_HEADCOUNT_DEFAULTS.intro)
                    setAsk(FINAL_HEADCOUNT_DEFAULTS.ask)
                    setIncludeCount(true)
                    setWordingMsg('')
                  }}
                  disabled={sending}
                  className="text-sm text-green-700 hover:underline disabled:opacity-40"
                >
                  Reset to the original wording
                </button>
              </div>
              {wordingMsg && <p className="text-xs text-gray-600">{wordingMsg}</p>}
              <p className="text-xs text-gray-500">
                {savedWording
                  ? 'These boxes opened on your saved wording.'
                  : 'These boxes opened on the original suggested wording.'}{' '}
                Edits here always apply to this send; saving also keeps them for next
                time.
              </p>
            </div>

            {/* Right: exactly what one person receives */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-700">Preview</span>
                {sendable.length > 1 && (
                  <label className="text-xs text-gray-600 flex items-center gap-1">
                    as
                    <select
                      value={previewIndex}
                      onChange={(e) => setPreviewIndex(Number(e.target.value))}
                      className="border rounded px-1 py-0.5 text-xs max-w-[12rem]"
                      aria-label="Preview as guest"
                    >
                      {sendable.map((r, i) => (
                        <option key={r.id} value={i}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {previewedAs && (
                <p className="text-xs text-gray-500">
                  Everyone else gets the same words with their own greeting
                  {includeCount ? ' and number' : ''}.
                </p>
              )}
              {previewError && <p className="text-xs text-red-700">{previewError}</p>}
              <iframe
                title="Email preview"
                srcDoc={previewHtml}
                sandbox=""
                className="w-full h-[26rem] border rounded-md bg-white"
              />
            </div>
          </div>
        )}

        <div className="border-t px-6 py-4 flex items-center justify-end gap-3">
          {sending && (
            <span className="text-sm text-gray-600 mr-auto">
              Sending… {progress} of {sendable.length}. Please leave this window open.
            </span>
          )}
          {!sending && !results && confirming && (
            <span className="text-sm text-gray-900 mr-auto">
              This emails {sendable.length} {sendable.length === 1 ? 'guest' : 'guests'} and cannot
              be undone. Send it?
            </span>
          )}
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 rounded-md border text-gray-700 disabled:opacity-40"
          >
            {results ? 'Close' : 'Cancel'}
          </button>
          {!results && (
            <button
              onClick={() => (confirming ? send() : setConfirming(true))}
              // Until the saved wording has loaded, the boxes still hold the original
              // suggestion — sending now would quietly send that instead of hers.
              disabled={sending || sendable.length === 0 || loadingWording}
              className="px-4 py-2 rounded-md bg-[#00330a] text-white disabled:opacity-40"
            >
              {sending
                ? 'Sending…'
                : confirming
                  ? `Yes, send ${sendable.length}`
                  : 'Review and send…'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
