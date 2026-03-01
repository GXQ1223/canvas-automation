import fs from 'fs'
import path from 'path'

export interface AppConfig {
  // Authentication
  canvasUrl: string
  username: string
  courseName: string
  twoFactorMethod: '2fa_sms' | '2fa_push' | '2fa_totp'
  twoFactorPhone: string

  // AI
  gptContext: string

  // Study Settings
  studyLimit: number
  breakDuration: number
  quizTimeLimit: number
  playbackSpeed: number

  // Browser
  chromeProfilePath: string
  chromeProfileName: string

  // Telegram
  telegramChatId: string
}

const DEFAULT_CONFIG: AppConfig = {
  canvasUrl: 'https://canvas.upenn.edu/courses/',
  username: '',
  courseName: '',
  twoFactorMethod: '2fa_sms',
  twoFactorPhone: '',
  gptContext: '',
  studyLimit: 45,
  breakDuration: 10,
  quizTimeLimit: 30,
  playbackSpeed: 1.5,
  chromeProfilePath: '',
  chromeProfileName: 'Default',
  telegramChatId: '',
}

export class ConfigManager {
  private configPath: string
  private envPath: string
  private config: AppConfig

  constructor(projectRoot: string) {
    this.configPath = path.join(projectRoot, 'config.json')
    this.envPath = path.join(projectRoot, '.env')
    this.config = this.loadConfig()
  }

  private loadConfig(): AppConfig {
    // Try config.json first
    if (fs.existsSync(this.configPath)) {
      try {
        const content = fs.readFileSync(this.configPath, 'utf-8')
        const parsed = JSON.parse(content)
        return { ...DEFAULT_CONFIG, ...parsed }
      } catch {
        console.error('Failed to parse config.json')
      }
    }

    // Fall back to .env migration
    if (fs.existsSync(this.envPath)) {
      return this.migrateFromEnv()
    }

    return { ...DEFAULT_CONFIG }
  }

  private migrateFromEnv(): AppConfig {
    const envContent = fs.readFileSync(this.envPath, 'utf-8')
    const config = { ...DEFAULT_CONFIG }

    const envVars: Record<string, string> = {}
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match) {
        envVars[match[1].trim()] = match[2].trim()
      }
    })

    if (envVars.CANVAS_URL) config.canvasUrl = envVars.CANVAS_URL
    if (envVars.CANVAS_USERNAME) config.username = envVars.CANVAS_USERNAME
    if (envVars.CANVAS_COURSE_NAME) config.courseName = envVars.CANVAS_COURSE_NAME
    if (envVars.GPT_QUESTION) config.gptContext = envVars.GPT_QUESTION
    if (envVars.CHROME_USER_DATA_DIR) config.chromeProfilePath = envVars.CHROME_USER_DATA_DIR
    if (envVars.CHROME_PROFILE) config.chromeProfileName = envVars.CHROME_PROFILE
    if (envVars.TELEGRAM_CHAT_ID) config.telegramChatId = envVars.TELEGRAM_CHAT_ID

    return config
  }

  private saveConfig(): void {
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2))
  }

  getConfig(): AppConfig {
    return { ...this.config }
  }

  setConfig(config: Partial<AppConfig>): void {
    this.config = { ...this.config, ...config }
    this.saveConfig()
  }

  getField<K extends keyof AppConfig>(field: K): AppConfig[K] {
    return this.config[field]
  }

  setField<K extends keyof AppConfig>(field: K, value: AppConfig[K]): void {
    this.config[field] = value
    this.saveConfig()
  }
}
