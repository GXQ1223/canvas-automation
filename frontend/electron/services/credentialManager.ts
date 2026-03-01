// Note: keytar requires native compilation, so we use a fallback for dev
// In production, keytar will be used for secure credential storage

const SERVICE_NAME = 'canvas-learning-app'

type CredentialKey = 'canvasPassword' | 'openaiApiKey' | 'telegramBotToken'

export class CredentialManager {
  private keytar: typeof import('keytar') | null = null
  private fallbackStore: Map<string, string> = new Map()

  constructor() {
    try {
      // Dynamic import to handle cases where keytar isn't available
      this.keytar = require('keytar')
    } catch {
      console.warn('keytar not available, using in-memory fallback')
    }
  }

  async get(key: CredentialKey): Promise<string | null> {
    if (this.keytar) {
      try {
        return await this.keytar.getPassword(SERVICE_NAME, key)
      } catch (e) {
        console.error('keytar.getPassword failed:', e)
      }
    }
    return this.fallbackStore.get(key) ?? null
  }

  async set(key: CredentialKey, value: string): Promise<void> {
    if (this.keytar) {
      try {
        await this.keytar.setPassword(SERVICE_NAME, key, value)
        return
      } catch (e) {
        console.error('keytar.setPassword failed:', e)
      }
    }
    this.fallbackStore.set(key, value)
  }

  async delete(key: CredentialKey): Promise<void> {
    if (this.keytar) {
      try {
        await this.keytar.deletePassword(SERVICE_NAME, key)
        return
      } catch (e) {
        console.error('keytar.deletePassword failed:', e)
      }
    }
    this.fallbackStore.delete(key)
  }
}
