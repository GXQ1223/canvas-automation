import { useAppStore } from '../stores/appStore'
import { ACHIEVEMENTS } from '../types'
import { Trophy, Flame, Zap, Target, Clock, CheckCircle } from 'lucide-react'
import './Dashboard.css'

function ProgressRing({ progress, size = 120, strokeWidth = 8 }: {
  progress: number
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          stroke="var(--bg-tertiary)"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className="progress-ring__circle"
          stroke="var(--accent-primary)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
          }}
        />
      </svg>
    </div>
  )
}

export function Dashboard() {
  const { progress, doneList, getQuizAccuracy, getXpToNextLevel, getXpProgress } = useAppStore()

  if (!progress) {
    return (
      <div className="dashboard">
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Loading progress data...</p>
        </div>
      </div>
    )
  }

  const accuracy = getQuizAccuracy()
  const xpToNext = getXpToNextLevel()
  const xpProgress = getXpProgress()

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Track your learning progress</p>
      </div>

      <div className="dashboard-grid">
        {/* XP & Level Card */}
        <div className="card dashboard-card level-card">
          <div className="level-content">
            <div className="level-ring">
              <ProgressRing progress={xpProgress} size={140} strokeWidth={10} />
              <div className="level-center">
                <span className="level-number">{progress.level}</span>
                <span className="level-label">Level</span>
              </div>
            </div>
            <div className="level-info">
              <div className="xp-display">
                <Zap size={20} className="xp-icon" />
                <span className="xp-value">{progress.xp.toLocaleString()} XP</span>
              </div>
              <p className="xp-next">{xpToNext} XP to next level</p>
            </div>
          </div>
        </div>

        {/* Streak Card */}
        <div className="card dashboard-card streak-card">
          <div className="streak-content">
            <div className="streak-icon">
              <Flame size={48} />
            </div>
            <div className="streak-info">
              <span className="streak-value">{progress.streak}</span>
              <span className="streak-label">Day Streak</span>
            </div>
          </div>
          <p className="streak-max">Best: {progress.maxStreak} days</p>
        </div>

        {/* Quick Stats */}
        <div className="card dashboard-card stats-card">
          <h3 className="card-title">Quick Stats</h3>
          <div className="stats-grid">
            <div className="quick-stat">
              <CheckCircle size={20} className="stat-icon success" />
              <div className="stat-info">
                <span className="stat-value">{doneList.length}</span>
                <span className="stat-label">Videos Done</span>
              </div>
            </div>
            <div className="quick-stat">
              <Target size={20} className="stat-icon accent" />
              <div className="stat-info">
                <span className="stat-value">{accuracy}%</span>
                <span className="stat-label">Quiz Accuracy</span>
              </div>
            </div>
            <div className="quick-stat">
              <Clock size={20} className="stat-icon warning" />
              <div className="stat-info">
                <span className="stat-value">{progress.stats.fastAnswers}</span>
                <span className="stat-label">Fast Answers</span>
              </div>
            </div>
            <div className="quick-stat">
              <Trophy size={20} className="stat-icon gold" />
              <div className="stat-info">
                <span className="stat-value">{progress.stats.sectionsCompleted}</span>
                <span className="stat-label">Sections Done</span>
              </div>
            </div>
          </div>
        </div>

        {/* Achievements */}
        <div className="card dashboard-card achievements-card">
          <h3 className="card-title">
            <Trophy size={18} />
            Achievements
          </h3>
          <div className="achievements-grid">
            {Object.entries(ACHIEVEMENTS).map(([id, achievement]) => {
              const unlocked = progress.achievements.includes(id)
              return (
                <div
                  key={id}
                  className={`achievement ${unlocked ? 'unlocked' : 'locked'}`}
                  title={`${achievement.name}: ${achievement.desc}`}
                >
                  <span className="achievement-icon">{achievement.icon}</span>
                  <span className="achievement-name">{achievement.name}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quiz Performance */}
        <div className="card dashboard-card performance-card">
          <h3 className="card-title">Quiz Performance</h3>
          <div className="performance-stats">
            <div className="perf-stat">
              <span className="perf-value">{progress.stats.questionsAnswered}</span>
              <span className="perf-label">Questions</span>
            </div>
            <div className="perf-stat success">
              <span className="perf-value">{progress.stats.questionsCorrect}</span>
              <span className="perf-label">Correct</span>
            </div>
            <div className="perf-stat error">
              <span className="perf-value">{progress.stats.timeouts}</span>
              <span className="perf-label">Timeouts</span>
            </div>
          </div>
          <div className="accuracy-bar">
            <div
              className="accuracy-fill"
              style={{ width: `${accuracy}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
