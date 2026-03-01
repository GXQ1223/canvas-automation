import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import './StudyClock.css'

type ClockMode = 'idle' | 'study' | 'break'

interface StudyClockProps {
  compact?: boolean
}

export function StudyClock({ compact = false }: StudyClockProps) {
  const { config, cliRunning, cliOutput } = useAppStore()
  const [mode, setMode] = useState<ClockMode>('idle')
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [studyStartTime, setStudyStartTime] = useState<number | null>(null)

  const studyLimit = config?.studyLimit ?? 45
  const breakDuration = config?.breakDuration ?? 10

  // Parse CLI output to detect mode changes
  useEffect(() => {
    if (!cliRunning) {
      setMode('idle')
      setStudyStartTime(null)
      return
    }

    // Check recent output for break/study indicators
    const recentOutput = cliOutput.slice(-20).join('\n').toLowerCase()

    if (recentOutput.includes('break time') || recentOutput.includes('taking a break')) {
      setMode('break')
      // Reset timer for break duration
      setRemainingSeconds(breakDuration * 60)
    } else if (recentOutput.includes('starting') || recentOutput.includes('watching')) {
      if (mode !== 'study') {
        setMode('study')
        setStudyStartTime(Date.now())
      }
    }
  }, [cliOutput, cliRunning, breakDuration, mode])

  // When CLI starts, begin study mode
  useEffect(() => {
    if (cliRunning && mode === 'idle') {
      setMode('study')
      setStudyStartTime(Date.now())
    }
  }, [cliRunning, mode])

  // Countdown timer
  useEffect(() => {
    if (mode === 'idle') return

    const interval = setInterval(() => {
      if (mode === 'study' && studyStartTime) {
        const elapsed = Math.floor((Date.now() - studyStartTime) / 1000)
        const totalSeconds = studyLimit * 60
        setRemainingSeconds(Math.max(0, totalSeconds - elapsed))
      } else if (mode === 'break') {
        setRemainingSeconds(prev => Math.max(0, prev - 1))
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [mode, studyStartTime, studyLimit])

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate progress percentage
  const getProgress = () => {
    if (mode === 'study') {
      const total = studyLimit * 60
      return ((total - remainingSeconds) / total) * 100
    } else if (mode === 'break') {
      const total = breakDuration * 60
      return ((total - remainingSeconds) / total) * 100
    }
    return 0
  }

  const getModeConfig = () => {
    switch (mode) {
      case 'study':
        return {
          icon: '⏱️',
          label: 'STUDY TIME',
          sublabel: 'until break',
          className: 'study',
        }
      case 'break':
        return {
          icon: '☕',
          label: 'BREAK TIME',
          sublabel: 'rest up!',
          className: 'break',
        }
      default:
        return {
          icon: '💤',
          label: 'READY',
          sublabel: 'Press Start',
          className: 'idle',
        }
    }
  }

  const { icon, label, sublabel, className } = getModeConfig()

  if (compact) {
    return (
      <div className={`study-clock-compact ${className}`}>
        <span className="clock-icon">{icon}</span>
        <span className="clock-time">{mode === 'idle' ? '--:--' : formatTime(remainingSeconds)}</span>
      </div>
    )
  }

  return (
    <div className={`study-clock ${className}`}>
      <div className="clock-status">
        <span className="clock-icon">{icon}</span>
        <span className="clock-label">{label}</span>
      </div>

      <div className="clock-time-display">
        <span className="clock-time-big">
          {mode === 'idle' ? '--:--' : formatTime(remainingSeconds)}
        </span>
        <span className="clock-sublabel">{sublabel}</span>
      </div>

      <div className="clock-progress-bar">
        <div
          className="clock-progress-fill"
          style={{ width: `${getProgress()}%` }}
        />
      </div>
    </div>
  )
}
