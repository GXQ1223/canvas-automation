import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '../stores/appStore'
import ReactMarkdown from 'react-markdown'
import { Calendar, FileText, BarChart3, ExternalLink } from 'lucide-react'
import type { ReportFile } from '../types'
import './Reports.css'

export function Reports() {
  const { reports } = useAppStore()
  const [selectedReport, setSelectedReport] = useState<ReportFile | null>(null)
  const [reportContent, setReportContent] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Group reports by date
  const groupedReports = useMemo(() => {
    const groups: Record<string, ReportFile[]> = {}

    reports.forEach((report) => {
      const date = new Date(report.modified).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(report)
    })

    return Object.entries(groups).sort((a, b) => {
      return new Date(b[0]).getTime() - new Date(a[0]).getTime()
    })
  }, [reports])

  // Load report content when selected
  useEffect(() => {
    const loadContent = async () => {
      if (!selectedReport || !window.electronAPI) return

      setLoading(true)
      const content = await window.electronAPI.files.readReport(selectedReport.path)
      setReportContent(content || '')
      setLoading(false)
    }

    loadContent()
  }, [selectedReport])

  // Auto-select first report
  useEffect(() => {
    if (reports.length > 0 && !selectedReport) {
      setSelectedReport(reports[0])
    }
  }, [reports, selectedReport])

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleOpenInFinder = () => {
    if (selectedReport && window.electronAPI) {
      window.electronAPI.shell.openPath(selectedReport.path)
    }
  }

  return (
    <div className="reports">
      <div className="reports-sidebar">
        <div className="reports-header-bar">
          <BarChart3 size={20} />
          <span>Daily Reports</span>
        </div>

        <div className="reports-list">
          {groupedReports.map(([date, dateReports]) => (
            <div key={date} className="date-group">
              <div className="date-label">
                <Calendar size={14} />
                {date}
              </div>
              {dateReports.map((report) => (
                <button
                  key={report.path}
                  className={`report-item ${selectedReport?.path === report.path ? 'active' : ''}`}
                  onClick={() => setSelectedReport(report)}
                >
                  <FileText size={16} />
                  <div className="report-info">
                    <span className="report-name">{report.name.replace('.md', '')}</span>
                    <span className="report-time">{formatTime(report.modified)}</span>
                  </div>
                </button>
              ))}
            </div>
          ))}

          {reports.length === 0 && (
            <div className="empty-state">
              <BarChart3 size={32} />
              <p>No reports yet</p>
            </div>
          )}
        </div>
      </div>

      <div className="reports-content">
        {selectedReport ? (
          <>
            <div className="reports-content-header">
              <h2>{selectedReport.name.replace('.md', '')}</h2>
              <button className="btn btn-ghost" onClick={handleOpenInFinder} title="Open in Finder">
                <ExternalLink size={16} />
              </button>
            </div>

            <div className="reports-body">
              {loading ? (
                <div className="loading">Loading...</div>
              ) : (
                <ReactMarkdown>{reportContent}</ReactMarkdown>
              )}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <BarChart3 size={48} />
            <h3>No report selected</h3>
            <p>Select a report from the sidebar to view it</p>
          </div>
        )}
      </div>
    </div>
  )
}
