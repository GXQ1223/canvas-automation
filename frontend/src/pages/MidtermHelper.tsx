import { useState, useMemo } from 'react'
import { useAppStore } from '../stores/appStore'
import ReactMarkdown from 'react-markdown'
import { Search, BookOpen, Sparkles, FileText, ChevronRight } from 'lucide-react'
import './MidtermHelper.css'

interface SearchResult {
  noteName: string
  notePath: string
  matches: string[]
}

export function MidtermHelper() {
  const { notes } = useAppStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [selectedNotes, setSelectedNotes] = useState<string[]>([])
  const [generatedGuide, setGeneratedGuide] = useState<string>('')
  const [isSearching, setIsSearching] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // Extract topics from notes
  const extractTitle = (name: string) => {
    return name.replace(/^\d{8}_\d{4}_/, '').replace(/_/g, ' ').replace(/\.md$/, '')
  }

  // Search across notes
  const handleSearch = async () => {
    if (!searchQuery || !window.electronAPI) return

    setIsSearching(true)
    const results: SearchResult[] = []

    for (const note of notes) {
      const content = await window.electronAPI.files.readNote(note.path)
      if (!content) continue

      const lines = content.split('\n')
      const matches: string[] = []
      const query = searchQuery.toLowerCase()

      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(query)) {
          // Get context (line before and after)
          const contextStart = Math.max(0, index - 1)
          const contextEnd = Math.min(lines.length, index + 2)
          const context = lines.slice(contextStart, contextEnd).join('\n')
          matches.push(context)
        }
      })

      if (matches.length > 0) {
        results.push({
          noteName: extractTitle(note.name),
          notePath: note.path,
          matches: matches.slice(0, 3), // Limit to 3 matches per note
        })
      }
    }

    setSearchResults(results)
    setIsSearching(false)
  }

  // Toggle note selection for study guide
  const toggleNoteSelection = (path: string) => {
    setSelectedNotes((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    )
  }

  // Generate study guide (placeholder - would use OpenAI in real implementation)
  const generateStudyGuide = async () => {
    if (selectedNotes.length === 0) return

    setIsGenerating(true)

    // Collect content from selected notes
    const contents: string[] = []
    for (const path of selectedNotes) {
      if (window.electronAPI) {
        const content = await window.electronAPI.files.readNote(path)
        if (content) {
          contents.push(content)
        }
      }
    }

    // Mock study guide generation (in real app, this would call OpenAI)
    const guide = `# Study Guide

## Selected Topics
${selectedNotes.map((p) => `- ${extractTitle(notes.find((n) => n.path === p)?.name || '')}`).join('\n')}

## Key Concepts

Based on your selected notes, here are the key topics to review:

${contents
  .map((content) => {
    // Extract headers and key points
    const lines = content.split('\n')
    const headers = lines.filter((l) => l.startsWith('## ') || l.startsWith('### '))
    return headers.slice(0, 5).join('\n')
  })
  .join('\n\n')}

## Study Tips

1. Review the AI insights section of each note
2. Practice explaining concepts in your own words
3. Focus on the "YOUR MISSION" sections for actionable items
4. Use the quiz results to identify weak areas

---
*Note: For full AI-powered study guide generation, ensure your OpenAI API key is configured in Settings.*
`

    setGeneratedGuide(guide)
    setIsGenerating(false)
  }

  return (
    <div className="midterm-helper">
      <div className="page-header">
        <h1 className="page-title">Midterm Helper</h1>
        <p className="page-subtitle">Search topics and generate study guides</p>
      </div>

      <div className="helper-grid">
        {/* Topic Search */}
        <section className="helper-section card">
          <div className="section-header">
            <Search size={20} />
            <h2>Topic Search</h2>
          </div>

          <div className="search-form">
            <input
              type="text"
              className="input"
              placeholder="Search for topics across all notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              className="btn btn-primary"
              onClick={handleSearch}
              disabled={isSearching || !searchQuery}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((result, index) => (
                <div key={index} className="search-result">
                  <div className="result-header">
                    <FileText size={16} />
                    <span className="result-name">{result.noteName}</span>
                    <span className="result-count">{result.matches.length} matches</span>
                  </div>
                  <div className="result-matches">
                    {result.matches.map((match, i) => (
                      <div key={i} className="match-snippet">
                        <ChevronRight size={12} />
                        <span>{match.substring(0, 200)}...</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {searchResults.length === 0 && searchQuery && !isSearching && (
            <div className="empty-state">
              <Search size={32} />
              <p>No results found for "{searchQuery}"</p>
            </div>
          )}
        </section>

        {/* Study Guide Generator */}
        <section className="helper-section card">
          <div className="section-header">
            <Sparkles size={20} />
            <h2>Study Guide Generator</h2>
          </div>

          <p className="section-desc">
            Select notes to include in your study guide:
          </p>

          <div className="notes-selector">
            {notes.slice(0, 10).map((note) => (
              <label key={note.path} className="note-checkbox">
                <input
                  type="checkbox"
                  checked={selectedNotes.includes(note.path)}
                  onChange={() => toggleNoteSelection(note.path)}
                />
                <span className="checkbox-label">{extractTitle(note.name)}</span>
              </label>
            ))}
            {notes.length > 10 && (
              <p className="more-notes">+ {notes.length - 10} more notes</p>
            )}
          </div>

          <button
            className="btn btn-primary"
            onClick={generateStudyGuide}
            disabled={selectedNotes.length === 0 || isGenerating}
          >
            <Sparkles size={16} />
            {isGenerating ? 'Generating...' : 'Generate Study Guide'}
          </button>
        </section>

        {/* Generated Guide */}
        {generatedGuide && (
          <section className="helper-section card guide-section">
            <div className="section-header">
              <BookOpen size={20} />
              <h2>Your Study Guide</h2>
            </div>

            <div className="guide-content">
              <ReactMarkdown>{generatedGuide}</ReactMarkdown>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
