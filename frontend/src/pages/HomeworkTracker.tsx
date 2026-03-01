import { useMemo } from 'react'
import { useAppStore } from '../stores/appStore'
import { CheckCircle, Circle, Video, HelpCircle, Play, Trophy } from 'lucide-react'
import './HomeworkTracker.css'

export function HomeworkTracker() {
  const { progress } = useAppStore()

  const modules = useMemo(() => {
    if (!progress?.homework) return []

    return Object.entries(progress.homework).map(([key, data]) => {
      const moduleNum = parseInt(key.replace('module_', ''))
      const sections = Object.entries(data.sections).map(([sectionId, status]) => ({
        id: sectionId,
        ...status,
      }))

      const completed = sections.filter((s) => s.done).length
      const total = sections.length
      const earnedPoints = sections.filter((s) => s.done).reduce((sum, s) => sum + s.points, 0)

      return {
        moduleNum,
        sections,
        completed,
        total,
        earnedPoints,
        totalPoints: data.totalPoints,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
      }
    }).sort((a, b) => a.moduleNum - b.moduleNum)
  }, [progress])

  if (!progress) {
    return (
      <div className="homework-tracker">
        <div className="page-header">
          <h1 className="page-title">Homework Tracker</h1>
          <p className="page-subtitle">Loading...</p>
        </div>
      </div>
    )
  }

  if (modules.length === 0) {
    return (
      <div className="homework-tracker">
        <div className="page-header">
          <h1 className="page-title">Homework Tracker</h1>
          <p className="page-subtitle">Track your homework progress by section</p>
        </div>
        <div className="card">
          <div className="empty-state">
            <Trophy size={48} />
            <h3 className="empty-state-title">No homework tracked yet</h3>
            <p className="empty-state-desc">
              Start watching videos to see your homework progress here
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="homework-tracker">
      <div className="page-header">
        <h1 className="page-title">Homework Tracker</h1>
        <p className="page-subtitle">Track your homework progress by section</p>
      </div>

      <div className="modules-list">
        {modules.map((module) => (
          <div key={module.moduleNum} className="module-card card">
            <div className="module-header">
              <div className="module-title">
                <h2>Module {module.moduleNum}</h2>
                {module.completedAt && <span className="badge badge-success">Complete</span>}
              </div>
              <div className="module-progress">
                <span className="progress-text">
                  {module.completed}/{module.total} sections
                </span>
                <span className="progress-points">
                  {module.earnedPoints}/{module.totalPoints} pts
                </span>
              </div>
            </div>

            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${(module.completed / module.total) * 100}%` }}
              />
            </div>

            <div className="sections-grid">
              {module.sections.map((section) => (
                <div
                  key={section.id}
                  className={`section-card ${section.done ? 'done' : section.started ? 'started' : ''}`}
                >
                  <div className="section-header">
                    <span className="section-id">Section {section.id}</span>
                    <span className="section-points">{section.points} pts</span>
                  </div>

                  <div className="section-status">
                    <div className={`status-item ${section.videoWatched ? 'complete' : ''}`}>
                      {section.videoWatched ? (
                        <CheckCircle size={14} />
                      ) : (
                        <Video size={14} />
                      )}
                      <span>Video</span>
                    </div>
                    <div className={`status-item ${section.quizPassed ? 'complete' : ''}`}>
                      {section.quizPassed ? (
                        <CheckCircle size={14} />
                      ) : (
                        <HelpCircle size={14} />
                      )}
                      <span>Quiz</span>
                    </div>
                    <div className={`status-item ${section.started ? 'complete' : ''}`}>
                      {section.started ? (
                        <CheckCircle size={14} />
                      ) : (
                        <Play size={14} />
                      )}
                      <span>Started</span>
                    </div>
                    <div className={`status-item ${section.done ? 'complete' : ''}`}>
                      {section.done ? (
                        <CheckCircle size={14} />
                      ) : (
                        <Circle size={14} />
                      )}
                      <span>Done</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
