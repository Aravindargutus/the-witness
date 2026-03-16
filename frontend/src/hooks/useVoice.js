import { useState, useRef, useCallback, useEffect } from 'react'
import { connectGeminiLive } from '../lib/geminiLive'

const SEND_SAMPLE_RATE = 16000
const RECV_SAMPLE_RATE = 24000

export function useVoice({ sessionId, witnessId, onWitnessResponse, onUserTranscript }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const connectionRef = useRef(null)
  const connectingRef = useRef(false)
  const mountedRef = useRef(true)
  const audioContextRef = useRef(null)
  const sourceNodeRef = useRef(null)
  const processorRef = useRef(null)
  const streamRef = useRef(null)
  const playbackCtxRef = useRef(null)
  const nextPlayTimeRef = useRef(0)

  // Keep callbacks in refs so connect() doesn't re-create on every render
  const onResponseRef = useRef(onWitnessResponse)
  onResponseRef.current = onWitnessResponse
  const onUserTranscriptRef = useRef(onUserTranscript)
  onUserTranscriptRef.current = onUserTranscript

  // Play received PCM audio from Gemini
  const playAudioBlob = useCallback(async (blob) => {
    try {
      if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
        playbackCtxRef.current = new AudioContext({ sampleRate: RECV_SAMPLE_RATE })
        nextPlayTimeRef.current = 0
      }
      const ctx = playbackCtxRef.current

      // Resume if suspended (autoplay policy)
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }

      const arrayBuffer = await blob.arrayBuffer()
      // Gemini sends 16-bit PCM
      const int16 = new Int16Array(arrayBuffer)
      const float32 = new Float32Array(int16.length)
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, RECV_SAMPLE_RATE)
      audioBuffer.copyToChannel(float32, 0)

      const source = ctx.createBufferSource()
      source.buffer = audioBuffer

      // Schedule playback to avoid gaps
      const now = ctx.currentTime
      const startTime = Math.max(now, nextPlayTimeRef.current)
      source.connect(ctx.destination)
      source.start(startTime)
      nextPlayTimeRef.current = startTime + audioBuffer.duration
    } catch (err) {
      console.error('Audio playback error:', err)
    }
  }, [])

  // Initialize connection - guarded against duplicate calls
  const connect = useCallback(async () => {
    if (connectionRef.current || connectingRef.current) return connectionRef.current
    connectingRef.current = true

    try {
      const conn = await connectGeminiLive({
        sessionId,
        witnessId,
        onResponse: (text, kind) => {
          onResponseRef.current?.(text, kind)
        },
        onAudio: (blob) => {
          playAudioBlob(blob)
        },
        onConnected: () => {
          if (mountedRef.current) setIsConnected(true)
        },
        onDisconnected: () => {
          if (mountedRef.current) setIsConnected(false)
          connectionRef.current = null
          connectingRef.current = false
        },
        onError: (err) => {
          console.error('Voice connection error:', err)
          if (mountedRef.current) setIsConnected(false)
          connectionRef.current = null
          connectingRef.current = false
        },
        onUserTranscript: (text) => {
          onUserTranscriptRef.current?.(text)
        },
      })
      connectionRef.current = conn
      connectingRef.current = false
      return conn
    } catch (err) {
      console.error('Failed to connect to Gemini Live:', err)
      connectingRef.current = false
      return null
    }
  }, [sessionId, witnessId, playAudioBlob])

  const startRecording = useCallback(async () => {
    if (!connectionRef.current) {
      const conn = await connect()
      if (!conn) return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SEND_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      streamRef.current = stream

      const audioContext = new AudioContext({ sampleRate: SEND_SAMPLE_RATE })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      sourceNodeRef.current = source

      // Use ScriptProcessorNode to get raw PCM (deprecated but widely supported)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (!connectionRef.current) return
        const inputData = e.inputBuffer.getChannelData(0)
        // Convert Float32 [-1,1] to Int16 PCM
        const pcm16 = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }
        connectionRef.current.sendAudio(pcm16.buffer)
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      setIsRecording(true)
    } catch (err) {
      console.error('Mic access denied:', err)
    }
  }, [connect])

  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect()
      sourceNodeRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    connectionRef.current?.endTurn()
    setIsRecording(false)
  }, [])

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording()
    } else {
      await startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  // Send text question (no mic needed)
  const sendText = useCallback(async (text) => {
    if (!connectionRef.current) {
      const conn = await connect()
      if (!conn) return
    }
    connectionRef.current?.sendText(text)
  }, [connect])

  // Auto-connect when component mounts (only once)
  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      connectionRef.current?.close()
      if (playbackCtxRef.current && playbackCtxRef.current.state !== 'closed') {
        playbackCtxRef.current.close()
      }
      stopRecording()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { isRecording, isConnected, startRecording, stopRecording, toggleRecording, sendText }
}
