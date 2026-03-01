import { create } from 'zustand'
import type { Progress, AppConfig, NoteFile, ReportFile } from '../types'

interface QuizQuestion {
  number: number
  text: string
}

interface AppState {
  // Progress data
  progress: Progress | null
  doneList: string[]
  skipList: string[]

  // Config
  config: AppConfig | null

  // Notes & Reports
  notes: NoteFile[]
  reports: ReportFile[]

  // CLI state
  cliRunning: boolean
  cliOutput: string[]

  // Quiz state
  currentQuizQuestions: QuizQuestion[]
  currentVideoTitle: string | null

  // UI state
  currentPage: string

  // Actions
  setProgress: (progress: Progress | null) => void
  setDoneList: (list: string[]) => void
  setSkipList: (list: string[]) => void
  setConfig: (config: AppConfig | null) => void
  setNotes: (notes: NoteFile[]) => void
  setReports: (reports: ReportFile[]) => void
  setCliRunning: (running: boolean) => void
  appendCliOutput: (output: string) => void
  clearCliOutput: () => void
  setCurrentPage: (page: string) => void
  setQuizQuestions: (questions: QuizQuestion[], videoTitle?: string) => void
  clearQuizQuestions: () => void

  // Computed
  getQuizAccuracy: () => number
  getXpToNextLevel: () => number
  getXpProgress: () => number
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  progress: null,
  doneList: [],
  skipList: [],
  config: null,
  notes: [],
  reports: [],
  cliRunning: false,
  cliOutput: [],
  currentQuizQuestions: [],
  currentVideoTitle: null,
  currentPage: 'dashboard',

  // Actions
  setProgress: (progress) => set({ progress }),
  setDoneList: (doneList) => set({ doneList }),
  setSkipList: (skipList) => set({ skipList }),
  setConfig: (config) => set({ config }),
  setNotes: (notes) => set({ notes }),
  setReports: (reports) => set({ reports }),
  setCliRunning: (cliRunning) => set({ cliRunning }),
  appendCliOutput: (output) =>
    set((state) => {
      // Split output by newlines and filter empty lines
      const newLines = output.split('\n').filter(line => line.trim())

      // Filter out duplicate consecutive lines and progress bar spam
      const currentOutput = state.cliOutput
      const filteredNew = newLines.filter((line, i) => {
        // Skip if same as last line in current output
        if (i === 0 && currentOutput.length > 0 && line === currentOutput[currentOutput.length - 1]) {
          return false
        }
        // Skip if same as previous new line
        if (i > 0 && line === newLines[i - 1]) {
          return false
        }
        return true
      })

      return {
        cliOutput: [...currentOutput.slice(-500), ...filteredNew],
      }
    }),
  clearCliOutput: () => set({ cliOutput: [] }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setQuizQuestions: (questions, videoTitle) => set({
    currentQuizQuestions: questions,
    currentVideoTitle: videoTitle ?? null
  }),
  clearQuizQuestions: () => set({ currentQuizQuestions: [], currentVideoTitle: null }),

  // Computed
  getQuizAccuracy: () => {
    const { progress } = get()
    if (!progress || progress.stats.questionsAnswered === 0) return 0
    return Math.round(
      (progress.stats.questionsCorrect / progress.stats.questionsAnswered) * 100
    )
  },

  getXpToNextLevel: () => {
    const { progress } = get()
    if (!progress) return 500
    const currentLevel = Math.floor(progress.xp / 500) + 1
    return currentLevel * 500 - progress.xp
  },

  getXpProgress: () => {
    const { progress } = get()
    if (!progress) return 0
    const xpInCurrentLevel = progress.xp % 500
    return (xpInCurrentLevel / 500) * 100
  },
}))
