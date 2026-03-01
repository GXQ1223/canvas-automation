import { useAppStore } from '../stores/appStore'
import {
  LayoutDashboard,
  Settings,
  FileText,
  BookOpen,
  BarChart3,
  Video,
  GraduationCap,
  Play,
  Square,
} from 'lucide-react'
import './Sidebar.css'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'homework', label: 'Homework', icon: BookOpen },
  { id: 'videos', label: 'Videos', icon: Video },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'midterm', label: 'Midterm Helper', icon: GraduationCap },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const { currentPage, setCurrentPage, cliRunning, progress } = useAppStore()

  const handleStartLearning = async () => {
    if (cliRunning) {
      await window.electronAPI?.cli.stop()
    } else {
      await window.electronAPI?.cli.start()
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="logo-icon">🎓</span>
          <span className="logo-text">Canvas Learning</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => setCurrentPage(item.id)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        {progress && (
          <div className="sidebar-stats">
            <div className="sidebar-stat">
              <span className="stat-icon">⚡</span>
              <span>Level {progress.level}</span>
            </div>
            <div className="sidebar-stat">
              <span className="stat-icon">🔥</span>
              <span>{progress.streak} day streak</span>
            </div>
          </div>
        )}

        <button
          className={`start-learning-btn ${cliRunning ? 'running' : ''}`}
          onClick={handleStartLearning}
        >
          {cliRunning ? (
            <>
              <Square size={18} />
              <span>Stop Learning</span>
            </>
          ) : (
            <>
              <Play size={18} />
              <span>Start Learning</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
