import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../stores/appStore'
import { StudyClock } from './StudyClock'
import {
  Play,
  Square,
  Settings,
  BookOpen,
  ChevronUp,
  ChevronDown,
  Pin,
  PinOff,
  Minus,
  X,
} from 'lucide-react'
import './Widget.css'

const EXPANDED_HEIGHT = 650
const COLLAPSED_HEIGHT = 44
const WIDGET_WIDTH = 280

interface WidgetProps {
  onOpenSettings: () => void
  onOpenNotes: () => void
}

export function Widget({ onOpenSettings, onOpenNotes }: WidgetProps) {
  const {
    progress,
    doneList,
    cliRunning,
    cliOutput,
    setCliRunning,
    getQuizAccuracy,
    currentQuizQuestions,
    currentVideoTitle,
  } = useAppStore()

  const [expanded, setExpanded] = useState(true)
  const [alwaysOnTop, setAlwaysOnTop] = useState(false)
  const [terminalHeight, setTerminalHeight] = useState(200)
  const [quizMode, setQuizMode] = useState<'view' | 'answer'>('view')
  const [quizAnswers, setQuizAnswers] = useState<Record<number, 'yes' | 'no'>>({})
  const [quizHeight, setQuizHeight] = useState(200)
  const terminalRef = useRef<HTMLDivElement>(null)


  // Load always-on-top state
  useEffect(() => {
    const loadState = async () => {
      if (window.electronAPI) {
        const isOnTop = await window.electronAPI.window.isAlwaysOnTop()
        setAlwaysOnTop(isOnTop)
      }
    }
    loadState()
  }, [])

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [cliOutput])

  // Keyboard shortcuts for CLI interaction
  useEffect(() => {
    if (!cliRunning) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.key === '1') {
        e.preventDefault()
        window.electronAPI?.cli.sendInput('1')
      } else if (e.key === '2') {
        e.preventDefault()
        window.electronAPI?.cli.sendInput('2')
      } else if (e.key === 'Enter') {
        e.preventDefault()
        window.electronAPI?.cli.sendInput('\n')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cliRunning])

  // Reset quiz answers when new questions arrive
  useEffect(() => {
    setQuizAnswers({})
    setQuizMode('view')
  }, [currentQuizQuestions])

  // Resize window when collapsed/expanded
  useEffect(() => {
    if (window.electronAPI) {
      const height = expanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT
      window.electronAPI.window.setSize(WIDGET_WIDTH, height)
    }
  }, [expanded])

  const handleToggleAlwaysOnTop = async () => {
    if (!window.electronAPI) return
    const newValue = !alwaysOnTop
    await window.electronAPI.window.setAlwaysOnTop(newValue)
    setAlwaysOnTop(newValue)
  }

  const handleMinimize = () => {
    window.electronAPI?.window.minimize()
  }

  const handleClose = () => {
    window.electronAPI?.window.close()
  }

  const handleStartLearning = async () => {
    if (!window.electronAPI) return

    if (cliRunning) {
      await window.electronAPI.cli.stop()
      setCliRunning(false)
    } else {
      await window.electronAPI.cli.start()
      setCliRunning(true)
    }
  }

  const handleSendEnter = () => {
    window.electronAPI?.cli.sendInput('\n')
  }

  const handleSendInput = (input: string) => {
    window.electronAPI?.cli.sendInput(input + '\n')
  }

  // For quiz - send single keypress without newline
  const handleSendKey = (key: string) => {
    window.electronAPI?.cli.sendInput(key)
  }

  const level = progress ? Math.floor(progress.xp / 500) + 1 : 1
  const streak = progress?.streak ?? 0
  const accuracy = getQuizAccuracy()
  const videosCompleted = doneList.length
  const sectionsCompleted = progress?.stats.sectionsCompleted ?? 0

  if (!expanded) {
    // Collapsed mini bar
    return (
      <div className="widget-collapsed">
        <div className="widget-titlebar collapsed-bar" data-tauri-drag-region>
          <div className="collapsed-content">
            <StudyClock compact />
            <span className="collapsed-level">Lv.{level}</span>
            {streak > 0 && <span className="collapsed-streak">🔥{streak}</span>}
          </div>
          <button
            className="expand-btn"
            onClick={() => setExpanded(true)}
            title="Expand"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="widget">
      {/* Custom title bar */}
      <div className="widget-titlebar" data-tauri-drag-region>
        <div className="titlebar-buttons">
          <button
            className={`titlebar-btn ${alwaysOnTop ? 'active' : ''}`}
            onClick={handleToggleAlwaysOnTop}
            title={alwaysOnTop ? 'Unpin from top' : 'Pin to top'}
          >
            {alwaysOnTop ? <Pin size={12} /> : <PinOff size={12} />}
          </button>
          <button
            className="titlebar-btn"
            onClick={() => setExpanded(false)}
            title="Collapse"
          >
            <ChevronUp size={12} />
          </button>
          <button className="titlebar-btn" onClick={handleMinimize} title="Minimize">
            <Minus size={12} />
          </button>
          <button className="titlebar-btn close" onClick={handleClose} title="Close">
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Clock Section */}
      <div className="widget-clock">
        <StudyClock />
      </div>

      {/* Terminal output - shown when running */}
      {cliRunning && (
        <div className="widget-terminal">
          <div className="terminal-output" ref={terminalRef} style={{ height: terminalHeight }}>
            {(() => {
              const lines = cliOutput.slice(-50)
              // Check if line is a progress bar (countdown or video progress)
              const isProgressBar = (line: string) =>
                line.includes('█') || line.includes('░') ||
                (line.includes('[') && line.includes(']') && (line.includes('#') || line.includes('-')) && line.includes('/'))

              // Find the last progress bar line
              let lastProgressIdx = -1
              lines.forEach((line, i) => {
                if (isProgressBar(line)) {
                  lastProgressIdx = i
                }
              })
              // Filter: keep only last progress bar, skip duplicates
              return lines
                .filter((line, i, arr) => {
                  // Only keep the LAST progress bar
                  if (isProgressBar(line)) {
                    return i === lastProgressIdx
                  }
                  // Skip consecutive duplicate lines
                  if (i > 0 && line === arr[i - 1]) {
                    return false
                  }
                  return true
                })
                .map((line, i) => (
                  <div key={i} className="terminal-line">{line}</div>
                ))
            })()}
          </div>
          <div
            className="terminal-resize-handle"
            onMouseDown={(e) => {
              e.preventDefault()
              const startY = e.clientY
              const startHeight = terminalHeight
              const onMouseMove = (e: MouseEvent) => {
                const delta = e.clientY - startY
                setTerminalHeight(Math.max(100, Math.min(400, startHeight + delta)))
              }
              const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove)
                document.removeEventListener('mouseup', onMouseUp)
              }
              document.addEventListener('mousemove', onMouseMove)
              document.addEventListener('mouseup', onMouseUp)
            }}
          >
            <div className="resize-grip" />
          </div>
          <div className="terminal-buttons">
            <button className="term-btn" onClick={handleSendEnter}>Enter</button>
            <button className="term-btn yes" onClick={() => handleSendKey('1')}>1</button>
            <button className="term-btn no" onClick={() => handleSendKey('2')}>2</button>
          </div>
        </div>
      )}

      {/* Focus Questions - shown when available */}
      {currentQuizQuestions.length > 0 && (
        <div className={`widget-quiz ${quizMode === 'answer' ? 'quiz-answer-mode' : ''}`}>
          <div className="quiz-header">
            <span className="quiz-icon">🎯</span>
            <span className="quiz-title">Focus Questions</span>
            <button className="quiz-mode-toggle" onClick={() => setQuizMode(m => m === 'view' ? 'answer' : 'view')}>
              {quizMode === 'view' ? 'Practice' : 'View'}
            </button>
          </div>
          {currentVideoTitle && (
            <div className="quiz-video-title">{currentVideoTitle}</div>
          )}
          <div className="quiz-questions" style={{ maxHeight: quizHeight }}>
            {currentQuizQuestions.map((q) => (
              <div key={q.number} className="quiz-question-item">
                <div className="quiz-question">
                  <span className="question-number">{q.number}.</span>
                  <span className="question-text">{q.text}</span>
                </div>
                {quizMode === 'answer' && (
                  <div className="quiz-answers">
                    <button
                      className={`answer-btn yes ${quizAnswers[q.number] === 'yes' ? 'selected' : ''}`}
                      onClick={() => setQuizAnswers(prev => ({ ...prev, [q.number]: 'yes' }))}
                    >
                      Yes
                    </button>
                    <button
                      className={`answer-btn no ${quizAnswers[q.number] === 'no' ? 'selected' : ''}`}
                      onClick={() => setQuizAnswers(prev => ({ ...prev, [q.number]: 'no' }))}
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {quizMode === 'view' && (
            <div className="quiz-hint">Tap "Practice" to lock in your guesses</div>
          )}
          {quizMode === 'answer' && Object.keys(quizAnswers).length === currentQuizQuestions.length && (
            <div className="quiz-hint quiz-ready">
              Answers locked! Compare with the quiz.
            </div>
          )}
          {/* Resize handle */}
          <div
            className="quiz-resize-handle"
            onMouseDown={(e) => {
              e.preventDefault()
              const startY = e.clientY
              const startHeight = quizHeight
              const onMouseMove = (e: MouseEvent) => {
                const delta = e.clientY - startY
                setQuizHeight(Math.max(100, Math.min(400, startHeight + delta)))
              }
              const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove)
                document.removeEventListener('mouseup', onMouseUp)
              }
              document.addEventListener('mousemove', onMouseMove)
              document.addEventListener('mouseup', onMouseUp)
            }}
          >
            <div className="resize-grip" />
          </div>
        </div>
      )}

      {/* Primary Action */}
      <div className="widget-action">
        <button
          className={`action-btn ${cliRunning ? 'running' : ''}`}
          onClick={handleStartLearning}
        >
          {cliRunning ? (
            <>
              <Square size={16} />
              <span>Stop Learning</span>
            </>
          ) : (
            <>
              <Play size={16} />
              <span>Start Learning</span>
            </>
          )}
        </button>
      </div>

      {/* Stats Row */}
      <div className="widget-stats">
        <div className="stat-item">
          <span className="stat-value">Lv.{level}</span>
          <span className="stat-label">{progress?.xp ?? 0} XP</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">🔥 {streak}</span>
          <span className="stat-label">day{streak !== 1 ? 's' : ''}</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">{accuracy}%</span>
          <span className="stat-label">accuracy</span>
        </div>
      </div>

      {/* Counters */}
      <div className="widget-counters">
        <div className="counter-item">
          <span className="counter-icon">📹</span>
          <span className="counter-text">{videosCompleted} videos done</span>
        </div>
        <div className="counter-item">
          <span className="counter-icon">📝</span>
          <span className="counter-text">{sectionsCompleted} sections complete</span>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="widget-bottom">
        <button className="bottom-btn" onClick={onOpenSettings}>
          <Settings size={14} />
          <span>Settings</span>
        </button>
        <div className="bottom-divider" />
        <button className="bottom-btn" onClick={onOpenNotes}>
          <BookOpen size={14} />
          <span>Notes</span>
        </button>
      </div>
    </div>
  )
}
