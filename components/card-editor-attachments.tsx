"use client"

import { useEffect, useRef, useState, type ComponentProps, type ChangeEvent } from "react"
import { CloudUpload, Image as ImageIcon, Paperclip, Trash2, Video } from "lucide-react"

import { CardEditor as BaseCardEditor } from "./card-editor"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  createAttachmentRef,
  encodeAttachmentValue,
  mirrorAttachmentToDrive,
  parseAttachmentValue,
  resolveAttachmentBlob,
  storeAttachmentBlob,
} from "@/lib/attachments"
import { setCardField, textFields } from "@/lib/deck"

type CardEditorProps = ComponentProps<typeof BaseCardEditor>

function attachmentFieldElement(field: string): HTMLInputElement | HTMLTextAreaElement | null {
  const element = document.getElementById(`field-${field}`)
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element : null
}

export function CardEditor(props: CardEditorProps) {
  const selected = props.deck.cards.find((card) => card.id === props.selectedId) ?? props.deck.cards[0]
  const fields = textFields(props.deck)
  const [open, setOpen] = useState(false)
  const [field, setField] = useState(() => fields.find((name) => !selected?.values[name]?.trim()) ?? fields[0] ?? "")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const activeField = fields.includes(field) ? field : fields[0] ?? ""
  const currentValue = selected?.values[activeField] ?? ""
  const currentAttachment = parseAttachmentValue(currentValue)

  useEffect(() => {
    const touched: Array<{ element: HTMLInputElement | HTMLTextAreaElement; readOnly: boolean; title: string }> = []
    for (const name of fields) {
      const ref = parseAttachmentValue(selected?.values[name] ?? "")
      if (!ref) continue
      const element = attachmentFieldElement(name)
      if (!element) continue
      touched.push({ element, readOnly: element.readOnly, title: element.title })
      element.readOnly = true
      element.dataset.ankiStudioAttachmentField = "true"
      element.title = `${ref.kind === "image" ? "Image" : "Video"} attachment: ${ref.name}. Use Media to replace or remove it.`
    }
    return () => {
      for (const item of touched) {
        item.element.readOnly = item.readOnly
        item.element.title = item.title
        delete item.element.dataset.ankiStudioAttachmentField
      }
    }
  }, [fields, selected?.id, selected?.values])

  const updateSelectedValue = (value: string, expectedAttachmentId?: string) => {
    if (!selected) return
    props.onChange((current) => {
      const currentCard = current.cards.find((card) => card.id === selected.id)
      if (!currentCard) return current
      if (expectedAttachmentId) {
        const currentRef = parseAttachmentValue(currentCard.values[activeField] ?? "")
        if (currentRef?.id !== expectedAttachmentId) return current
      }
      const result = setCardField(current, selected.id, activeField, value)
      if (!result.ok) {
        queueMicrotask(() => setMessage(result.error))
        return current
      }
      return result.deck
    })
  }

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !selected || !activeField || busy) return
    setBusy(true)
    setMessage("")
    void (async () => {
      try {
        const ref = createAttachmentRef(file)
        await storeAttachmentBlob(ref, file)
        updateSelectedValue(encodeAttachmentValue(ref))
        setMessage("Saved on this device. Syncing to Google Drive…")
        const mirrored = await mirrorAttachmentToDrive(ref, file)
        setMessage(mirrored.message)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Couldn’t attach this file")
      } finally {
        setBusy(false)
      }
    })()
  }

  const retryDrive = () => {
    if (!currentAttachment || busy) return
    setBusy(true)
    setMessage("Syncing attachment to Google Drive…")
    void (async () => {
      try {
        const blob = await resolveAttachmentBlob(currentAttachment)
        const mirrored = await mirrorAttachmentToDrive(currentAttachment, blob)
        setMessage(mirrored.message)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Couldn’t sync this attachment")
      } finally {
        setBusy(false)
      }
    })()
  }

  const removeCurrent = () => {
    if (!currentAttachment || busy) return
    updateSelectedValue("", currentAttachment.id)
    setMessage("Attachment removed from this field. The stored media is retained for other notes or deck copies.")
  }

  const openAttachmentDialog = () => {
    if (!selected || fields.length === 0) return
    const preferred = fields.find((name) => parseAttachmentValue(selected.values[name] ?? ""))
      ?? fields.find((name) => !selected.values[name]?.trim())
      ?? fields[0]!
    setField(preferred)
    setMessage("")
    setOpen(true)
  }

  return (
    <>
      <BaseCardEditor {...props} />
      {props.layout === "detail" && selected && fields.length > 0 ? (
        <Button
          type="button"
          className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-40 rounded-full px-4 shadow-lg lg:bottom-6 lg:right-6"
          aria-label="Attach image or video"
          onClick={openAttachmentDialog}
        >
          <Paperclip data-icon="inline-start" />
          Media
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Attach image or video</DialogTitle>
            <DialogDescription>
              Store one media file in a field. It is saved locally first and mirrored to Google Drive when connected.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="attachment-field">Field</Label>
              <select
                id="attachment-field"
                value={activeField}
                className="h-11 w-full rounded-[14px] border border-black/[0.075] bg-card px-3.5 text-sm outline-none focus-visible:border-foreground/35 focus-visible:ring-3 focus-visible:ring-energy/30 dark:border-white/[0.1]"
                onChange={(event) => {
                  setField(event.target.value)
                  setMessage("")
                }}
              >
                {fields.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>

            {currentAttachment ? (
              <div className="flex items-center gap-3 rounded-[16px] border border-black/[0.065] bg-muted/40 p-3 dark:border-white/[0.08]">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-card">
                  {currentAttachment.kind === "image" ? <ImageIcon className="size-5" /> : <Video className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{currentAttachment.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{currentAttachment.kind === "image" ? "Image" : "Video"} attachment</p>
                </div>
              </div>
            ) : currentValue.trim() ? (
              <p className="rounded-[14px] bg-muted/45 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                This field currently contains text. Choosing a file will replace that value.
              </p>
            ) : null}

            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={onFile} />
            <Button type="button" className="w-full" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Paperclip data-icon="inline-start" />
              {currentAttachment ? "Replace media" : "Choose image or video"}
            </Button>

            {currentAttachment ? (
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={retryDrive}>
                  <CloudUpload data-icon="inline-start" />
                  Sync to Drive
                </Button>
                <Button type="button" variant="outline" className="text-destructive" disabled={busy} onClick={removeCurrent}>
                  <Trash2 data-icon="inline-start" />
                  Remove
                </Button>
              </div>
            ) : null}

            {message ? <p className="text-xs leading-5 text-muted-foreground">{message}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
