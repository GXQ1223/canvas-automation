import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '../stores/appStore'
import ReactMarkdown from 'react-markdown'
import { Search, FileText, Calendar, Download, ExternalLink } from 'lucide-react'
import type { NoteFile } from '../types'
import './NotesViewer.css'

export function NotesViewer() {
  const { notes } = useAppStore()
  const [selectedNote, setSelectedNote] = useState<NoteFile | null>(null)
  const [noteContent, setNoteContent] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)

  // Filter notes by search
  const filteredNotes = useMemo(() => {
    if (!searchQuery) return notes
    const query = searchQuery.toLowerCase()
    return notes.filter((note) => note.name.toLowerCase().includes(query))
  }, [notes, searchQuery])

  // Load note content when selected
  useEffect(() => {
    const loadContent = async () => {
      if (!selectedNote || !window.electronAPI) return

      setLoading(true)
      const content = await window.electronAPI.files.readNote(selectedNote.path)
      setNoteContent(content || '')
      setLoading(false)
    }

    loadContent()
  }, [selectedNote])

  // Auto-select first note
  useEffect(() => {
    if (notes.length > 0 && !selectedNote) {
      setSelectedNote(notes[0])
    }
  }, [notes, selectedNote])

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const extractTitle = (name: string) => {
    // Remove timestamp prefix and .md extension
    const cleaned = name.replace(/^\d{8}_\d{4}_/, '').replace(/_/g, ' ').replace(/\.md$/, '')
    return cleaned || name
  }

  const handleExport = () => {
    if (!selectedNote || !noteContent) return

    // Create blob and download
    const blob = new Blob([noteContent], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = selectedNote.name
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleOpenInFinder = () => {
    if (selectedNote && window.electronAPI) {
      window.electronAPI.shell.openPath(selectedNote.path)
    }
  }

  return (
    <div className="notes-viewer">
      <div className="notes-sidebar">
        <div className="notes-search">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="input"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="notes-count">
          {filteredNotes.length} note{filteredNotes.length !== 1 ? 's' : ''}
        </div>

        <div className="notes-list">
          {filteredNotes.map((note) => (
            <button
              key={note.path}
              className={`note-item ${selectedNote?.path === note.path ? 'active' : ''}`}
              onClick={() => setSelectedNote(note)}
            >
              <FileText size={16} className="note-icon" />
              <div className="note-info">
                <span className="note-title">{extractTitle(note.name)}</span>
                <span className="note-date">
                  <Calendar size={12} />
                  {formatDate(note.modified)}
                </span>
              </div>
            </button>
          ))}

          {filteredNotes.length === 0 && (
            <div className="empty-state">
              <FileText size={32} />
              <p>No notes found</p>
            </div>
          )}
        </div>
      </div>

      <div className="notes-content">
        {selectedNote ? (
          <>
            <div className="notes-header">
              <h2 className="notes-title">{extractTitle(selectedNote.name)}</h2>
              <div className="notes-actions">
                <button className="btn btn-ghost" onClick={handleOpenInFinder} title="Open in Finder">
                  <ExternalLink size={16} />
                </button>
                <button className="btn btn-ghost" onClick={handleExport} title="Download">
                  <Download size={16} />
                </button>
              </div>
            </div>

            <div className="notes-body">
              {loading ? (
                <div className="loading">Loading...</div>
              ) : (
                <ReactMarkdown>{noteContent}</ReactMarkdown>
              )}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <FileText size={48} />
            <h3>No note selected</h3>
            <p>Select a note from the sidebar to view its contents</p>
          </div>
        )}
      </div>
    </div>
  )
}
