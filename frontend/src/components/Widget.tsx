import { useState, useEffect, useCallback, useRef } from 'react'
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
  const [quizAnswers, setQuizAnswers] = useState<Record<number, 'yes' | 'no' | null>>({})
  const [quizMode, setQuizMode] = useState<'view' | 'answer'>('view')
  const [quizActive, setQuizActive] = useState(false) // Track if quiz is in progress
  const [quizHeight, setQuizHeight] = useState(200) // Resizable quiz section height
  const [isResizing, setIsResizing] = useState(false)

  // Parse CLI output for status
  const parseCliStatus = () => {
    const lines = cliOutput.slice(-50)

    let status = 'Running...'
    let currentStep = ''
    let quizProgress = ''
    let videoName = ''
    let currentQuestion = ''

    // Find video name from recent output
    for (const line of lines) {
      if (line.includes('Processing:')) {
        videoName = line.replace('Processing:', '').trim()
      }
    }

    // Find current status (check most recent lines first)
    for (const line of [...lines].reverse()) {
      // Skip empty lines
      if (!line.trim()) continue

      // Waiting for input - highest priority
      if (line.includes('Press ENTER') || line.includes('press ENTER')) {
        status = 'Waiting for input'
        currentStep = line.includes('start video') ? 'Ready to play' : 'Press Enter'
        break
      }
      // Quiz question prompt (1/2/3 or Y/N)
      if (line.includes('1) Yes') || line.includes('2) No') || line.includes('3) Skip')) {
        status = 'Answer now!'
        // Look for the question text in previous lines
        for (let j = lines.indexOf(line) - 1; j >= 0 && j >= lines.indexOf(line) - 10; j--) {
          const prevLine = lines[j]
          // Match "QUESTION X of Y" line
          const qMatch = prevLine.match(/QUESTION (\d+) of (\d+)/)
          if (qMatch) {
            quizProgress = `Q${qMatch[1]}/${qMatch[2]}`
            // The question text should be 2 lines after
            if (j + 2 < lines.length) {
              currentQuestion = lines[j + 2].trim()
            }
            break
          }
        }
        break
      }
      if (line.includes('(Y/N)') || line.includes('(y/n)')) {
        status = 'Answer Y/N'
        break
      }
      // Quiz time / Question
      if (line.includes('QUIZ TIME')) {
        status = 'Quiz time'
        break
      }
      if (line.match(/Question \d+/)) {
        const match = line.match(/Question (\d+)\/(\d+)/)
        if (match) {
          quizProgress = `${match[1]}/${match[2]}`
        }
        status = 'Quiz in progress'
        break
      }
      // Correct/Wrong answers (match the new prominent format)
      if (line.includes('✓ CORRECT')) {
        status = 'Correct!'
        break
      }
      if (line.includes('✗ WRONG')) {
        status = 'Wrong!'
        break
      }
      // Video states
      if (line.includes('Starting video') || line.includes('Playing')) {
        status = 'Playing video'
        break
      }
      if (line.includes('Video complete') || line.includes('finished')) {
        status = 'Video complete'
        break
      }
      // Processing states
      if (line.includes('Generating') && line.includes('questions')) {
        status = 'Generating quiz'
        break
      }
      if (line.includes('Analyzing') || line.includes('KEY INSIGHTS')) {
        status = 'Analyzing content'
        break
      }
      if (line.includes('Extracting transcript') || line.includes('transcript')) {
        status = 'Getting transcript'
        break
      }
      if (line.includes('Processing:') || line.includes('Found incomplete')) {
        status = 'Processing video'
        break
      }
      // Navigation
      if (line.includes('Navigating') || line.includes('Loading')) {
        status = 'Navigating...'
        break
      }
      if (line.includes('Modules page') || line.includes('modules')) {
        status = 'Loading modules'
        break
      }
      // Login/Auth
      if (line.includes('Logging in') || line.includes('Login')) {
        status = 'Logging in'
        break
      }
      if (line.includes('2FA') || line.includes('verification')) {
        status = '2FA verification'
        break
      }
      // Break
      if (line.includes('BREAK') || line.includes('Take a break')) {
        status = 'Break time'
        break
      }
      // Mark as done
      if (line.includes('Mark as done') || line.includes('Marking')) {
        status = 'Marking complete'
        break
      }
      // FOCUS WHILE WATCHING
      if (line.includes('FOCUS WHILE WATCHING')) {
        status = 'Review questions'
        break
      }
    }

    return { status, currentStep, quizProgress, videoName, currentQuestion }
  }

  const cliStatus = cliRunning ? parseCliStatus() : { status: 'Ready', currentStep: '', quizProgress: '', videoName: '', currentQuestion: '' }

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

  // Track the last set of questions we've seen
  const [lastQuizKey, setLastQuizKey] = useState('')

  // Reset quiz answers only when questions actually change (new video)
  useEffect(() => {
    if (currentQuizQuestions.length > 0) {
      // Create a key from the questions to detect actual changes
      const newKey = currentQuizQuestions.map(q => q.text).join('|')
      if (newKey !== lastQuizKey) {
        setQuizAnswers({})
        setQuizMode('view')
        setLastQuizKey(newKey)
      }
    }
  }, [currentQuizQuestions, lastQuizKey])

  // Track quiz active state from CLI output
  useEffect(() => {
    if (cliOutput.length === 0) return

    const recentOutput = cliOutput.slice(-20).join('\n')

    // Quiz starts when we see "QUIZ" or question prompt
    if (recentOutput.includes('QUIZ') || recentOutput.includes('1) Yes')) {
      setQuizActive(true)
    }

    // Quiz ends when we see result or video starts
    if (recentOutput.includes('PERFECT!') ||
        recentOutput.includes('RETRY NEEDED') ||
        recentOutput.includes('Starting video') ||
        recentOutput.includes('Mark as done')) {
      setQuizActive(false)
    }
  }, [cliOutput])

  const handleQuizAnswer = (questionNum: number, answer: 'yes' | 'no') => {
    setQuizAnswers(prev => ({ ...prev, [questionNum]: answer }))
  }

  const toggleQuizMode = () => {
    setQuizMode(prev => prev === 'view' ? 'answer' : 'view')
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

  // Resize handlers for quiz section
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null)

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    resizeRef.current = { startY: e.clientY, startHeight: quizHeight }

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return
      const delta = e.clientY - resizeRef.current.startY
      const newHeight = Math.max(100, Math.min(400, resizeRef.current.startHeight + delta))
      setQuizHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      resizeRef.current = null
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [quizHeight])

  // Check if CLI is waiting for input
  const isWaitingForInput = cliStatus.status === 'Waiting for input' || cliStatus.currentStep.includes('Enter')
  const isWaitingForQuizAnswer = cliStatus.status === 'Answer now!' || cliStatus.status === 'Answer Y/N' || cliStatus.status === 'Quiz in progress'

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

      {/* CLI Status - shown when running */}
      {cliRunning && (
        <div className="widget-status">
          <div className="status-row">
            <span className="status-indicator"></span>
            <span className="status-text">{cliStatus.status}</span>
            {cliStatus.quizProgress && (
              <span className="status-progress">{cliStatus.quizProgress}</span>
            )}
          </div>
          {cliStatus.videoName && (
            <div className="status-video">{cliStatus.videoName}</div>
          )}
          {cliStatus.currentStep && (
            <div className="status-step">{cliStatus.currentStep}</div>
          )}
          {/* Show current quiz question */}
          {cliStatus.currentQuestion && (
            <div className="status-question">{cliStatus.currentQuestion}</div>
          )}
          {/* Debug: show last line of output */}
          {cliOutput.length > 0 && (
            <div className="status-debug" style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
              [{cliOutput.length}] {cliOutput[cliOutput.length - 1]?.substring(0, 50)}...
            </div>
          )}

          {/* Input buttons */}
          {isWaitingForInput && (
            <button className="continue-btn" onClick={handleSendEnter}>
              Continue →
            </button>
          )}

          {/* Quiz answer buttons (1=Yes, 2=No, 3=Skip) - send single keypress */}
          {(quizActive || isWaitingForQuizAnswer) && (
            <div className="quiz-input-buttons">
              <button className="input-btn yes" onClick={() => handleSendKey('1')}>
                1) Yes
              </button>
              <button className="input-btn no" onClick={() => handleSendKey('2')}>
                2) No
              </button>
              <button className="input-btn skip" onClick={() => handleSendKey('3')}>
                3) Skip
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quiz Questions - shown when available */}
      {currentQuizQuestions.length > 0 && (
        <div className={`widget-quiz ${quizMode === 'answer' ? 'quiz-answer-mode' : ''}`}>
          <div className="quiz-header">
            <span className="quiz-icon">🎯</span>
            <span className="quiz-title">Focus Questions</span>
            <button className="quiz-mode-toggle" onClick={toggleQuizMode}>
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
                      onClick={() => handleQuizAnswer(q.number, 'yes')}
                    >
                      Yes
                    </button>
                    <button
                      className={`answer-btn no ${quizAnswers[q.number] === 'no' ? 'selected' : ''}`}
                      onClick={() => handleQuizAnswer(q.number, 'no')}
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
              Answers locked! See how you did in the CLI quiz.
            </div>
          )}
          {/* Resize handle */}
          <div
            className={`quiz-resize-handle ${isResizing ? 'active' : ''}`}
            onMouseDown={handleResizeStart}
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
