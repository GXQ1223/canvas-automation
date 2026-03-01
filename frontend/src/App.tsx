import { useEffect, useState, useRef } from 'react'
import { useAppStore } from './stores/appStore'
import { Widget } from './components/Widget'
import { Settings } from './pages/Settings'
import { NotesViewer } from './pages/NotesViewer'
import { X } from 'lucide-react'
import './App.css'

type ModalType = 'settings' | 'notes' | null

// Parse quiz questions from CLI output
function parseQuizQuestions(output: string): { questions: { number: number; text: string }[], videoTitle?: string } | null {
  const lines = output.split('\n')
  const questions: { number: number; text: string }[] = []
  let inQuizSection = false
  let videoTitle: string | undefined
  const seenQuestions = new Set<number>()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Detect start of quiz section
    if (trimmed.includes('FOCUS WHILE WATCHING')) {
      inQuizSection = true
      continue
    }

    // Detect end of quiz section
    if (inQuizSection && (trimmed.includes("You'll answer") || trimmed.includes("ALL") && trimmed.includes("must be correct"))) {
      break
    }

    // Parse question lines (format: "   1. Question text" or "1. Question")
    if (inQuizSection) {
      // Match lines like "   1. Question text" or "1. Question"
      const match = trimmed.match(/^(\d+)\.\s+(.+)$/)
      if (match) {
        const num = parseInt(match[1])
        // Avoid duplicates
        if (!seenQuestions.has(num)) {
          seenQuestions.add(num)
          questions.push({
            number: num,
            text: match[2].trim()
          })
        }
      }
    }

    // Try to capture video title from "Processing: Title" line
    if (trimmed.startsWith('Processing:')) {
      videoTitle = trimmed.replace('Processing:', '').trim()
    }
  }

  if (questions.length > 0) {
    // Sort by question number
    questions.sort((a, b) => a.number - b.number)
    return { questions, videoTitle }
  }
  return null
}

function App() {
  const {
    setProgress,
    setDoneList,
    setSkipList,
    setConfig,
    setNotes,
    setReports,
    setCliRunning,
    appendCliOutput,
    setQuizQuestions,
    clearQuizQuestions,
  } = useAppStore()

  const outputBufferRef = useRef<string[]>([])

  const [activeModal, setActiveModal] = useState<ModalType>(null)

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      if (!window.electronAPI) return

      const [progress, doneList, skipList, config, notes, reports] = await Promise.all([
        window.electronAPI.files.readProgress(),
        window.electronAPI.files.readDoneList(),
        window.electronAPI.files.readSkipList(),
        window.electronAPI.config.get(),
        window.electronAPI.files.listNotes(),
        window.electronAPI.files.listReports(),
      ])

      setProgress(progress)
      setDoneList(doneList)
      setSkipList(skipList)
      setConfig(config)
      setNotes(notes)
      setReports(reports)

      // Check CLI status
      const running = await window.electronAPI.cli.isRunning()
      setCliRunning(running)
    }

    loadData()

    // Subscribe to file changes
    if (window.electronAPI) {
      window.electronAPI.onFileChange((event, data) => {
        switch (event) {
          case 'progress-updated':
            setProgress(data as Parameters<typeof setProgress>[0])
            break
          case 'done-list-updated':
            setDoneList(data as string[])
            break
          case 'config-updated':
            setConfig(data as Parameters<typeof setConfig>[0])
            break
          case 'note-added':
          case 'note-deleted':
            window.electronAPI.files.listNotes().then(setNotes)
            break
          case 'report-added':
          case 'report-deleted':
            window.electronAPI.files.listReports().then(setReports)
            break
        }
      })

      // Subscribe to CLI output
      window.electronAPI.cli.onOutput((output) => {
        appendCliOutput(output)

        // Buffer output - split by newlines and add each line
        const newLines = output.split('\n').filter(line => line.trim())
        outputBufferRef.current.push(...newLines)
        // Keep last 100 lines for parsing
        if (outputBufferRef.current.length > 100) {
          outputBufferRef.current = outputBufferRef.current.slice(-100)
        }

        // Check for quiz questions in buffered output
        const fullBuffer = outputBufferRef.current.join('\n')
        if (fullBuffer.includes('FOCUS WHILE WATCHING:')) {
          const parsed = parseQuizQuestions(fullBuffer)
          if (parsed && parsed.questions.length > 0) {
            setQuizQuestions(parsed.questions, parsed.videoTitle)
          }
        }

        // Clear questions when video completes or quiz starts
        if (output.includes('Mark as done') || output.includes('QUIZ TIME')) {
          clearQuizQuestions()
          outputBufferRef.current = []
        }
      })
    }
  }, [setProgress, setDoneList, setSkipList, setConfig, setNotes, setReports, setCliRunning, appendCliOutput, setQuizQuestions, clearQuizQuestions])

  const closeModal = () => setActiveModal(null)

  return (
    <div className="app">
      <Widget
        onOpenSettings={() => setActiveModal('settings')}
        onOpenNotes={() => setActiveModal('notes')}
      />

      {/* Modal overlay */}
      {activeModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>
              <X size={18} />
            </button>
            {activeModal === 'settings' && <Settings />}
            {activeModal === 'notes' && <NotesViewer />}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
