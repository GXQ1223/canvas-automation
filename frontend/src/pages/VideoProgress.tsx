import { useMemo, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { CheckCircle, XCircle, Clock, Video, Search, SkipForward } from 'lucide-react'
import './VideoProgress.css'

type FilterType = 'all' | 'done' | 'pending' | 'skipped'

export function VideoProgress() {
  const { doneList, skipList } = useAppStore()
  const [filter, setFilter] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Parse video info from title
  const parseVideo = (title: string) => {
    const timeMatch = title.match(/\((\d+):(\d+)\)/)
    const duration = timeMatch
      ? parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2])
      : 0

    return {
      title,
      duration,
      durationStr: timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : 'N/A',
    }
  }

  // Build video list
  const videos = useMemo(() => {
    const allVideos = new Map<string, { title: string; status: 'done' | 'skipped' | 'pending' }>()

    // Add done videos
    doneList.forEach((title) => {
      allVideos.set(title, { title, status: 'done' })
    })

    // Add skipped videos
    skipList.forEach((title) => {
      if (!allVideos.has(title)) {
        allVideos.set(title, { title, status: 'skipped' })
      }
    })

    return Array.from(allVideos.values()).map((video) => ({
      ...video,
      ...parseVideo(video.title),
    }))
  }, [doneList, skipList])

  // Filter and search
  const filteredVideos = useMemo(() => {
    let result = videos

    if (filter !== 'all') {
      result = result.filter((v) => v.status === filter)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter((v) => v.title.toLowerCase().includes(query))
    }

    return result
  }, [videos, filter, searchQuery])

  // Stats
  const stats = useMemo(() => {
    const done = videos.filter((v) => v.status === 'done').length
    const skipped = videos.filter((v) => v.status === 'skipped').length
    const totalTime = videos
      .filter((v) => v.status === 'done')
      .reduce((sum, v) => sum + v.duration, 0)

    return {
      total: videos.length,
      done,
      skipped,
      pending: videos.length - done - skipped,
      totalTime: Math.round(totalTime / 60),
    }
  }, [videos])

  return (
    <div className="video-progress">
      <div className="page-header">
        <h1 className="page-title">Video Progress</h1>
        <p className="page-subtitle">Track all videos you've watched or skipped</p>
      </div>

      {/* Stats Row */}
      <div className="video-stats">
        <div className="stat-card">
          <Video size={24} className="stat-icon" />
          <div className="stat-info">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total Videos</span>
          </div>
        </div>
        <div className="stat-card success">
          <CheckCircle size={24} className="stat-icon" />
          <div className="stat-info">
            <span className="stat-value">{stats.done}</span>
            <span className="stat-label">Completed</span>
          </div>
        </div>
        <div className="stat-card warning">
          <SkipForward size={24} className="stat-icon" />
          <div className="stat-info">
            <span className="stat-value">{stats.skipped}</span>
            <span className="stat-label">Skipped</span>
          </div>
        </div>
        <div className="stat-card accent">
          <Clock size={24} className="stat-icon" />
          <div className="stat-info">
            <span className="stat-value">{stats.totalTime}</span>
            <span className="stat-label">Min Watched</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="video-controls card">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="input"
            placeholder="Search videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-tabs">
          <button
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({stats.total})
          </button>
          <button
            className={`filter-tab ${filter === 'done' ? 'active' : ''}`}
            onClick={() => setFilter('done')}
          >
            Done ({stats.done})
          </button>
          <button
            className={`filter-tab ${filter === 'skipped' ? 'active' : ''}`}
            onClick={() => setFilter('skipped')}
          >
            Skipped ({stats.skipped})
          </button>
        </div>
      </div>

      {/* Video Table */}
      <div className="video-table card">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Video Title</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {filteredVideos.map((video, index) => (
              <tr key={index} className={`video-row ${video.status}`}>
                <td className="status-cell">
                  {video.status === 'done' ? (
                    <span className="status-badge done">
                      <CheckCircle size={14} />
                      Done
                    </span>
                  ) : video.status === 'skipped' ? (
                    <span className="status-badge skipped">
                      <XCircle size={14} />
                      Skipped
                    </span>
                  ) : (
                    <span className="status-badge pending">
                      <Clock size={14} />
                      Pending
                    </span>
                  )}
                </td>
                <td className="title-cell">{video.title}</td>
                <td className="duration-cell">{video.durationStr}</td>
              </tr>
            ))}

            {filteredVideos.length === 0 && (
              <tr>
                <td colSpan={3}>
                  <div className="empty-state">
                    <Video size={32} />
                    <p>No videos found</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
