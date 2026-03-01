import { useState, useEffect } from 'react'
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

const EXPANDED_HEIGHT = 500
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

  // Parse CLI output for status
  const parseCliStatus = () => {
    const recentOutput = cliOutput.slice(-30).join('\n')
    const lines = cliOutput.slice(-30)

    let status = 'Idle'
    let currentStep = ''
    let quizProgress = ''
    let videoName = ''

    for (const line of lines.reverse()) {
      // Video processing
      if (line.includes('Processing:')) {
        videoName = line.replace('Processing:', '').trim()
        status = 'Processing video'
        break
      }
      // Analyzing
      if (line.includes('Analyzing lecture')) {
        status = 'Analyzing content'
        break
      }
      // Generating questions
      if (line.includes('Generating homework-focused')) {
        status = 'Generating quiz'
        break
      }
      // Starting video
      if (line.includes('Starting video')) {
        status = 'Playing video'
        break
      }
      // Quiz time
      if (line.includes('QUIZ TIME') || line.includes('Question')) {
        const match = line.match(/Question (\d+)\/(\d+)/)
        if (match) {
          quizProgress = `${match[1]}/${match[2]}`
          status = 'Quiz in progress'
        } else {
          status = 'Quiz time'
        }
        break
      }
      // Correct/Wrong
      if (line.includes('CORRECT') || line.includes('WRONG')) {
        status = line.includes('CORRECT') ? 'Correct!' : 'Wrong!'
        break
      }
      // Break
      if (line.includes('BREAK TIME') || line.includes('break')) {
        status = 'Break time'
        break
      }
      // Waiting for input
      if (line.includes('Press ENTER')) {
        status = 'Waiting for input'
        currentStep = line.includes('start video') ? 'Ready to play' : 'Press Enter'
        break
      }
      // Login
      if (line.includes('Logging in') || line.includes('2FA')) {
        status = 'Logging in'
        break
      }
    }

    return { status, currentStep, quizProgress, videoName }
  }

  const cliStatus = cliRunning ? parseCliStatus() : { status: 'Ready', currentStep: '', quizProgress: '', videoName: '' }

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

  // Reset quiz answers when new questions arrive
  useEffect(() => {
    if (currentQuizQuestions.length > 0) {
      setQuizAnswers({})
      setQuizMode('view')
    }
  }, [currentQuizQuestions])

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

  // Check if CLI is waiting for input
  const isWaitingForInput = cliStatus.status === 'Waiting for input' || cliStatus.currentStep.includes('Enter')

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

          {/* Input buttons */}
          {isWaitingForInput && (
            <button className="continue-btn" onClick={handleSendEnter}>
              Continue →
            </button>
          )}

          {/* Quiz answer buttons */}
          {cliStatus.status === 'Quiz in progress' && (
            <div className="quiz-input-buttons">
              <button className="input-btn yes" onClick={() => handleSendInput('y')}>
                Yes (Y)
              </button>
              <button className="input-btn no" onClick={() => handleSendInput('n')}>
                No (N)
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
          <div className="quiz-questions">
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
