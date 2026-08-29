"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AudioLines, Headphones, LoaderCircle, Mic2, RotateCcw, Volume2, X } from "lucide-react"

import { GeminiLiveSetup } from "@/components/gemini-live-setup"
import { Button } from "@/components/ui/button"
import { createTutorLesson } from "@/lib/gemini-live-lesson"
import {
  GEMINI_LIVE_MODEL,
  readGeminiLiveSettings,
  validateGeminiLiveSettings,
  type GeminiLiveSettings,
} from "@/lib/gemini-live-settings"
import type { Deck } from "@/lib/deck"
import { cn } from "@/lib/utils"

type TutorPhase = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error"
type TranscriptItem = { id: number; role: "you" | "tutor"; text: string }

type LivePart = {
  inlineData?: { data?: string; mimeType?: string }
}

type LiveMessage = {
  setupComplete?: unknown
  serverContent?: {
    modelTurn?: { parts?: LivePart[] }
    inputTranscription?: { text?: string }
    outputTranscription?: { text?: string }
    interrupted?: boolean
    turnComplete?: boolean
  }
}

type WindowWithWebkitAudio = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext
}

const LIVE_WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained"
const CONNECT_TIMEOUT_MS = 20_000
const INPUT_RATE = 16_000
const OUTPUT_RATE = 24_000

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunk = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + chunk)))
  }
  return btoa(binary)
}

function downsample(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (outputRate >= inputRate) return new Float32Array(input)
  const ratio = inputRate / outputRate
  const length = Math.max(1, Math.round(input.length / ratio))
  const output = new Float32Array(length)

  for (let index = 0; index < length; index += 1) {
    const start = Math.floor(index * ratio)
    const end = Math.min(input.length, Math.floor((index + 1) * ratio))
    let total = 0
    let count = 0
    for (let source = start; source < Math.max(start + 1, end); source += 1) {
      total += input[source] ?? 0
      count += 1
    }
    output[index] = count > 0 ? total / count : 0
  }
  return output
}

function pcm16Base64(input: Float32Array, inputRate: number): string {
  const samples = downsample(input, inputRate, INPUT_RATE)
  const bytes = new Uint8Array(samples.length * 2)
  const view = new DataView(bytes.buffer)
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0))
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }
  return bytesToBase64(bytes)
}

function decodePcm16(base64: string): Float32Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  const view = new DataView(bytes.buffer)
  const output = new Float32Array(Math.floor(bytes.length / 2))
  for (let index = 0; index < output.length; index += 1) {
    output[index] = view.getInt16(index * 2, true) / 0x8000
  }
  return output
}

async function readLiveMessageData(data: unknown): Promise<string | null> {
  if (typeof data === "string") return data
  if (data instanceof Blob) return data.text()
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data)
  return null
}

async function requestLiveToken(apiKey: string): Promise<{ token: string; model: string }> {
  const response = await fetch("/api/gemini-live/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
    cache: "no-store",
  })
  const data = await response.json().catch(() => null) as { token?: string; model?: string; error?: string } | null
  if (!response.ok || !data?.token) throw new Error(data?.error || "Unable to create a Gemini Live session")
  return { token: data.token, model: data.model || GEMINI_LIVE_MODEL }
}

function phaseCopy(phase: TutorPhase): { label: string; hint: string } {
  switch (phase) {
    case "connecting": return { label: "Connecting", hint: "Preparing your voice lesson…" }
    case "thinking": return { label: "Thinking", hint: "The tutor is preparing the next step." }
    case "speaking": return { label: "Speaking", hint: "You can interrupt naturally at any time." }
    case "listening": return { label: "Listening", hint: "Answer naturally. The tutor will guide the lesson." }
    case "error": return { label: "Disconnected", hint: "Start a new lesson to continue." }
    default: return { label: "Ready", hint: "Start when you’re ready to practice out loud." }
  }
}

export function AiTutor({ deck, onExit }: { deck: Deck; onExit: () => void }) {
  const lesson = useMemo(() => createTutorLesson(deck), [deck])
  const [settings, setSettings] = useState<GeminiLiveSettings>(readGeminiLiveSettings)
  const [phase, setPhase] = useState<TutorPhase>("idle")
  const [error, setError] = useState("")
  const [transcript, setTranscript] = useState<TranscriptItem[]>([])
  const [liveUser, setLiveUser] = useState("")
  const [liveTutor, setLiveTutor] = useState("")

  const websocketRef = useRef<WebSocket | null>(null)
  const setupTimerRef = useRef(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const silentGainRef = useRef<GainNode | null>(null)
  const playbackSourcesRef = useRef(new Set<AudioBufferSourceNode>())
  const playbackCursorRef = useRef(0)
  const stoppedRef = useRef(true)
  const micStartedRef = useRef(false)
  const transcriptIdRef = useRef(0)
  const userDraftRef = useRef("")
  const tutorDraftRef = useRef("")
  const transcriptEndRef = useRef<HTMLDivElement | null>(null)

  const configured = validateGeminiLiveSettings(settings) === null
  const active = phase === "connecting" || phase === "listening" || phase === "thinking" || phase === "speaking"
  const copy = phaseCopy(phase)

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" })
  }, [liveTutor, liveUser, transcript])

  const addTranscript = useCallback((role: "you" | "tutor", text: string) => {
    const value = text.trim()
    if (!value) return
    transcriptIdRef.current += 1
    setTranscript((current) => [...current.slice(-7), { id: transcriptIdRef.current, role, text: value }])
  }, [])

  const flushUser = useCallback(() => {
    const value = userDraftRef.current
    userDraftRef.current = ""
    setLiveUser("")
    addTranscript("you", value)
  }, [addTranscript])

  const flushTutor = useCallback(() => {
    const value = tutorDraftRef.current
    tutorDraftRef.current = ""
    setLiveTutor("")
    addTranscript("tutor", value)
  }, [addTranscript])

  const clearPlayback = useCallback(() => {
    for (const source of playbackSourcesRef.current) {
      try { source.stop() } catch { /* already stopped */ }
    }
    playbackSourcesRef.current.clear()
    const context = audioContextRef.current
    playbackCursorRef.current = context?.currentTime ?? 0
  }, [])

  const playAudio = useCallback((base64: string) => {
    const context = audioContextRef.current
    if (!context || context.state === "closed") return
    const samples = decodePcm16(base64)
    if (samples.length === 0) return

    const buffer = context.createBuffer(1, samples.length, OUTPUT_RATE)
    buffer.getChannelData(0).set(samples)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    const startAt = Math.max(context.currentTime + 0.015, playbackCursorRef.current)
    playbackCursorRef.current = startAt + buffer.duration
    playbackSourcesRef.current.add(source)
    source.onended = () => playbackSourcesRef.current.delete(source)
    source.start(startAt)
  }, [])

  const stopSession = useCallback((exit = false) => {
    stoppedRef.current = true
    micStartedRef.current = false
    window.clearTimeout(setupTimerRef.current)
    setupTimerRef.current = 0

    const processor = processorRef.current
    if (processor) processor.onaudioprocess = null
    try { processorRef.current?.disconnect() } catch { /* disconnected */ }
    try { mediaSourceRef.current?.disconnect() } catch { /* disconnected */ }
    try { silentGainRef.current?.disconnect() } catch { /* disconnected */ }
    processorRef.current = null
    mediaSourceRef.current = null
    silentGainRef.current = null

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null

    clearPlayback()
    const socket = websocketRef.current
    websocketRef.current = null
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "Lesson ended")

    const context = audioContextRef.current
    audioContextRef.current = null
    if (context && context.state !== "closed") void context.close().catch(() => undefined)

    flushUser()
    flushTutor()
    if (exit) onExit()
  }, [clearPlayback, flushTutor, flushUser, onExit])

  useEffect(() => () => stopSession(false), [stopSession])

  const startMicrophone = useCallback((socket: WebSocket, context: AudioContext, stream: MediaStream) => {
    if (micStartedRef.current) return
    micStartedRef.current = true
    const source = context.createMediaStreamSource(stream)
    const processor = context.createScriptProcessor(4096, 1, 1)
    const silentGain = context.createGain()
    silentGain.gain.value = 0

    processor.onaudioprocess = (event) => {
      if (socket.readyState !== WebSocket.OPEN || stoppedRef.current) return
      const input = event.inputBuffer.getChannelData(0)
      socket.send(JSON.stringify({
        realtimeInput: {
          audio: {
            data: pcm16Base64(input, context.sampleRate),
            mimeType: `audio/pcm;rate=${INPUT_RATE}`,
          },
        },
      }))
    }

    source.connect(processor)
    processor.connect(silentGain)
    silentGain.connect(context.destination)
    mediaSourceRef.current = source
    processorRef.current = processor
    silentGainRef.current = silentGain
  }, [])

  const startLesson = useCallback(async () => {
    const nextSettings = readGeminiLiveSettings()
    const settingsError = validateGeminiLiveSettings(nextSettings)
    if (settingsError) {
      setSettings(nextSettings)
      setError(settingsError)
      return
    }
    if (lesson.cards.length === 0) {
      setError("This deck does not have any study content yet")
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access requires a secure browser context (HTTPS)")
      setPhase("error")
      return
    }

    stopSession(false)
    stoppedRef.current = false
    setSettings(nextSettings)
    setTranscript([])
    setLiveUser("")
    setLiveTutor("")
    userDraftRef.current = ""
    tutorDraftRef.current = ""
    setError("")
    setPhase("connecting")

    try {
      const AudioContextCtor = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext
      if (!AudioContextCtor) throw new Error("Web Audio is not supported by this browser")
      const context = new AudioContextCtor()
      audioContextRef.current = context
      await context.resume()

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
      if (stoppedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      mediaStreamRef.current = stream

      // Mint the one-use ephemeral token only after microphone permission so its
      // one-minute new-session window is not spent waiting on the user prompt.
      const { token, model } = await requestLiveToken(nextSettings.apiKey.trim())
      if (stoppedRef.current) return

      const socket = new WebSocket(`${LIVE_WS_URL}?access_token=${encodeURIComponent(token)}`)
      socket.binaryType = "arraybuffer"
      websocketRef.current = socket
      setupTimerRef.current = window.setTimeout(() => {
        if (stoppedRef.current || websocketRef.current !== socket) return
        stopSession(false)
        setError("Gemini Live did not finish connecting. Check API access and try again.")
        setPhase("error")
      }, CONNECT_TIMEOUT_MS)

      socket.onopen = () => {
        socket.send(JSON.stringify({
          setup: {
            model: `models/${model}`,
            generationConfig: { responseModalities: ["AUDIO"] },
            systemInstruction: { parts: [{ text: lesson.instruction }] },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        }))
      }

      socket.onmessage = (event) => {
        void (async () => {
          if (stoppedRef.current) return
          const raw = await readLiveMessageData(event.data)
          if (stoppedRef.current || raw == null) return

          let message: LiveMessage
          try {
            message = JSON.parse(raw) as LiveMessage
          } catch {
            return
          }

          if (message.setupComplete) {
            window.clearTimeout(setupTimerRef.current)
            setupTimerRef.current = 0
            startMicrophone(socket, context, stream)
            setPhase("thinking")
            socket.send(JSON.stringify({
              realtimeInput: {
                text: "Begin the voice lesson now. Greet briefly, then ask the first question from the deck.",
              },
            }))
          }

          const content = message.serverContent
          if (!content) return

          if (content.interrupted) {
            clearPlayback()
            flushTutor()
            setPhase("listening")
          }

          const inputText = content.inputTranscription?.text
          if (inputText) {
            userDraftRef.current += inputText
            setLiveUser(userDraftRef.current)
            setPhase("thinking")
          }

          const outputText = content.outputTranscription?.text
          if (outputText) {
            if (userDraftRef.current) flushUser()
            tutorDraftRef.current += outputText
            setLiveTutor(tutorDraftRef.current)
          }

          for (const part of content.modelTurn?.parts ?? []) {
            const audio = part.inlineData
            if (!audio?.data) continue
            if (audio.mimeType && !audio.mimeType.startsWith("audio/")) continue
            if (userDraftRef.current) flushUser()
            setPhase("speaking")
            playAudio(audio.data)
          }

          if (content.turnComplete) {
            flushUser()
            flushTutor()
            setPhase("listening")
          }
        })().catch(() => {
          if (stoppedRef.current) return
          stopSession(false)
          setError("Unable to read the Gemini Live response")
          setPhase("error")
        })
      }

      socket.onerror = () => {
        if (stoppedRef.current) return
        stopSession(false)
        setError("The Gemini Live connection failed")
        setPhase("error")
      }

      socket.onclose = (event) => {
        if (stoppedRef.current) return
        const reason = event.reason || "The Gemini Live session ended. Start a new lesson to continue."
        stopSession(false)
        setError(reason)
        setPhase("error")
      }
    } catch (caught) {
      stopSession(false)
      setError(caught instanceof Error ? caught.message : "Unable to start the voice lesson")
      setPhase("error")
    }
  }, [clearPlayback, flushTutor, flushUser, lesson.cards.length, lesson.instruction, playAudio, startMicrophone, stopSession])

  return (
    <div className="fixed inset-0 z-[120] flex min-h-0 flex-col bg-background text-foreground" role="dialog" aria-modal="true" aria-label="AI Tutor">
      <header className="shrink-0 border-b border-black/[0.05] bg-background/94 pt-[env(safe-area-inset-top)] backdrop-blur-2xl dark:border-white/[0.07]">
        <div className="mx-auto flex h-[68px] w-full max-w-3xl items-center gap-3 px-3 min-[390px]:h-[72px] min-[390px]:px-4 sm:px-6">
          <Button type="button" size="icon-lg" variant="outline" aria-label="Close AI Tutor" onClick={() => stopSession(true)}>
            <X className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[19px] font-semibold tracking-[-0.03em] min-[390px]:text-[20px]">AI Tutor</h1>
            <p className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground">{lesson.deckName}</p>
          </div>
          {active ? (
            <span className="flex shrink-0 items-center gap-2 rounded-full bg-muted/60 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground">
              <span className={cn("size-2 rounded-full", phase === "speaking" ? "bg-sky-400" : "bg-energy")} />
              {copy.label}
            </span>
          ) : null}
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-6">
        {!configured ? (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-4">
            <GeminiLiveSetup mode="onboarding" onSaved={(next) => { setSettings(next); setError("") }} />
          </div>
        ) : !active && phase !== "error" ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <span className="flex size-16 items-center justify-center rounded-[22px] bg-energy/18">
              <AudioLines className="size-7" />
            </span>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Voice Tutor</p>
            <h2 className="mt-2 text-[30px] font-semibold leading-[1.04] tracking-[-0.045em]">Learn by speaking</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Gemini will lead a voice lesson automatically using up to {lesson.cards.length} cards from this deck.
            </p>
            <Button type="button" size="lg" className="mt-6 h-13 min-w-52 rounded-[16px]" disabled={lesson.cards.length === 0} onClick={() => void startLesson()}>
              <Mic2 className="size-4.5" />
              Start voice lesson
            </Button>
            <p className="mt-4 flex items-center gap-1.5 text-[10px] text-muted-foreground"><Headphones className="size-3.5" />Headphones recommended for the cleanest interruption handling.</p>
          </div>
        ) : phase === "error" ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <span className="flex size-14 items-center justify-center rounded-[20px] bg-muted"><Mic2 className="size-6" /></span>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em]">Voice lesson stopped</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{error || copy.hint}</p>
            <div className="mt-5 flex gap-2">
              <Button type="button" variant="outline" onClick={() => stopSession(true)}>Close</Button>
              <Button type="button" onClick={() => void startLesson()}><RotateCcw className="size-4" />Try again</Button>
            </div>
          </div>
        ) : (
          <>
            <section className="shrink-0 py-3 text-center">
              <span className={cn("mx-auto flex size-16 items-center justify-center rounded-full transition-colors", phase === "speaking" ? "bg-sky-100 text-sky-700" : phase === "thinking" || phase === "connecting" ? "bg-muted text-foreground" : "bg-energy/20 text-foreground") }>
                {phase === "connecting" || phase === "thinking" ? <LoaderCircle className="size-7 animate-spin" /> : phase === "speaking" ? <Volume2 className="size-7" /> : <Mic2 className="size-7" />}
              </span>
              <h2 className="mt-3 text-xl font-semibold tracking-[-0.035em]">{copy.label}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{copy.hint}</p>
            </section>

            <section className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[22px] border border-black/[0.06] bg-card px-4 py-3 dark:border-white/[0.08] sm:px-5">
              {transcript.length === 0 && !liveUser && !liveTutor ? (
                <div className="flex h-full min-h-40 items-center justify-center text-center text-xs text-muted-foreground">The lesson transcript will appear here.</div>
              ) : (
                <div className="space-y-4 py-1">
                  {transcript.map((item) => (
                    <div key={item.id} className={cn("max-w-[88%]", item.role === "you" ? "ml-auto text-right" : "mr-auto") }>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{item.role === "you" ? "You" : "Tutor"}</p>
                      <p className={cn("mt-1 rounded-[16px] px-3.5 py-2.5 text-sm leading-5", item.role === "you" ? "bg-foreground text-background" : "bg-muted/65 text-foreground")}>{item.text}</p>
                    </div>
                  ))}
                  {liveUser ? <div className="ml-auto max-w-[88%] text-right opacity-70"><p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">You</p><p className="mt-1 rounded-[16px] bg-foreground px-3.5 py-2.5 text-sm leading-5 text-background">{liveUser}</p></div> : null}
                  {liveTutor ? <div className="mr-auto max-w-[88%] opacity-80"><p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tutor</p><p className="mt-1 rounded-[16px] bg-muted/65 px-3.5 py-2.5 text-sm leading-5">{liveTutor}</p></div> : null}
                  <div ref={transcriptEndRef} />
                </div>
              )}
            </section>

            <div className="shrink-0 pt-3 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
              <Button type="button" variant="outline" className="h-12 w-full justify-center rounded-[15px]" onClick={() => stopSession(true)}>
                <X className="size-4" />
                End lesson
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
