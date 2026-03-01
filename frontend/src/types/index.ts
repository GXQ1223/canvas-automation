// Progress data structure (mirrors progress.json)
export interface Progress {
  xp: number
  level: number
  streak: number
  maxStreak: number
  lastActiveDate: string | null
  currentModule: number
  homework: Record<string, HomeworkModule>
  achievements: string[]
  stats: ProgressStats
}

export interface HomeworkModule {
  sections: Record<string, SectionStatus>
  totalPoints: number
  earnedPoints: number
  startedAt: string | null
  completedAt: string | null
}

export interface SectionStatus {
  videoWatched: boolean
  quizPassed: boolean
  started: boolean
  done: boolean
  points: number
}

export interface ProgressStats {
  videosWatched: number
  quizzesPassed: number
  questionsAnswered: number
  questionsCorrect: number
  fastAnswers: number
  timeouts: number
  sectionsCompleted: number
  homeworksCompleted: number
  perfectHomeworks: number
  fastCompletions: number
  videosSkipped: number
  totalTimeSpent: number
}

// Config structure
export interface AppConfig {
  canvasUrl: string
  username: string
  courseName: string
  twoFactorMethod: '2fa_sms' | '2fa_push' | '2fa_totp'
  twoFactorPhone: string
  gptContext: string
  studyLimit: number
  breakDuration: number
  quizTimeLimit: number
  playbackSpeed: number
  chromeProfilePath: string
  chromeProfileName: string
  telegramChatId: string
}

// Note file
export interface NoteFile {
  name: string
  path: string
  modified: Date
}

// Report file
export interface ReportFile {
  name: string
  path: string
  modified: Date
}

// Achievement definitions
export const ACHIEVEMENTS: Record<string, { name: string; desc: string; icon: string }> = {
  FIRST_SECTION: {
    name: 'First Section',
    desc: 'Complete 1 homework section',
    icon: '🎯',
  },
  FULL_MARKS: {
    name: 'Full Marks',
    desc: 'Get 100% on a homework',
    icon: '💯',
  },
  SPEED_RUNNER: {
    name: 'Speed Runner',
    desc: 'Finish homework in <2 hours total',
    icon: '⚡',
  },
  EFFICIENT: {
    name: 'Efficient Learner',
    desc: 'Skip 3+ non-essential videos',
    icon: '🧠',
  },
  STREAK_3: {
    name: 'On Fire',
    desc: 'Maintain a 3-day streak',
    icon: '🔥',
  },
  STREAK_7: {
    name: 'Unstoppable',
    desc: 'Maintain a 7-day streak',
    icon: '💪',
  },
  LEVEL_5: {
    name: 'Scholar',
    desc: 'Reach level 5',
    icon: '📚',
  },
  QUICK_DRAW: {
    name: 'Quick Draw',
    desc: 'Answer 10 questions in under 5 seconds',
    icon: '🎯',
  },
  SHARPSHOOTER: {
    name: 'Sharpshooter',
    desc: 'Maintain 80%+ accuracy over 20 questions',
    icon: '🏹',
  },
  NEVER_TIMEOUT: {
    name: 'Never Timeout',
    desc: 'Answer 20 questions without any timeouts',
    icon: '⏱️',
  },
}

// Electron API types
export interface ElectronAPI {
  config: {
    get: () => Promise<AppConfig>
    set: (config: Partial<AppConfig>) => Promise<void>
    getField: <K extends keyof AppConfig>(field: K) => Promise<AppConfig[K]>
    setField: <K extends keyof AppConfig>(field: K, value: AppConfig[K]) => Promise<void>
  }
  credentials: {
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string) => Promise<void>
    delete: (key: string) => Promise<void>
  }
  files: {
    readProgress: () => Promise<Progress | null>
    readDoneList: () => Promise<string[]>
    readSkipList: () => Promise<string[]>
    listNotes: () => Promise<NoteFile[]>
    readNote: (path: string) => Promise<string | null>
    listReports: () => Promise<ReportFile[]>
    readReport: (path: string) => Promise<string | null>
  }
  cli: {
    start: (args?: string[]) => Promise<boolean>
    stop: () => Promise<boolean>
    isRunning: () => Promise<boolean>
    sendInput: (input: string) => Promise<boolean>
    onOutput: (callback: (output: string) => void) => void
  }
  shell: {
    openExternal: (url: string) => Promise<boolean>
    openPath: (path: string) => Promise<boolean>
  }
  window: {
    setAlwaysOnTop: (value: boolean) => Promise<boolean>
    isAlwaysOnTop: () => Promise<boolean>
    minimize: () => Promise<boolean>
    close: () => Promise<boolean>
    setSize: (width: number, height: number) => Promise<boolean>
    getSize: () => Promise<[number, number]>
  }
  onFileChange: (callback: (event: string, data: unknown) => void) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
