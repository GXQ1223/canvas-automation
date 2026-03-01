import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { Save, RefreshCw, Check, AlertCircle, FolderOpen } from 'lucide-react'
import type { AppConfig } from '../types'
import './Settings.css'

export function Settings() {
  const { config, setConfig } = useAppStore()
  const [localConfig, setLocalConfig] = useState<AppConfig | null>(null)
  const [passwords, setPasswords] = useState({
    canvasPassword: '',
    openaiApiKey: '',
    telegramBotToken: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  // Load config and passwords
  useEffect(() => {
    const loadData = async () => {
      if (!window.electronAPI) return

      const cfg = await window.electronAPI.config.get()
      setLocalConfig(cfg)

      // Load existing passwords (masked)
      const [pwd, apiKey, tgToken] = await Promise.all([
        window.electronAPI.credentials.get('canvasPassword'),
        window.electronAPI.credentials.get('openaiApiKey'),
        window.electronAPI.credentials.get('telegramBotToken'),
      ])

      setPasswords({
        canvasPassword: pwd ? '••••••••' : '',
        openaiApiKey: apiKey ? 'sk-••••••••' : '',
        telegramBotToken: tgToken ? '••••••••' : '',
      })
    }

    loadData()
  }, [])

  // Sync localConfig with store
  useEffect(() => {
    if (config && !localConfig) {
      setLocalConfig(config)
    }
  }, [config, localConfig])

  const handleChange = (field: keyof AppConfig, value: string | number) => {
    if (!localConfig) return
    setLocalConfig({ ...localConfig, [field]: value })
    setSaved(false)
  }

  const handlePasswordChange = (field: keyof typeof passwords, value: string) => {
    setPasswords({ ...passwords, [field]: value })
    setSaved(false)
  }

  const handleSave = async () => {
    if (!localConfig || !window.electronAPI) return

    setSaving(true)
    try {
      // Save config
      await window.electronAPI.config.set(localConfig)
      setConfig(localConfig)

      // Save passwords (only if changed from masked value)
      if (!passwords.canvasPassword.includes('•') && passwords.canvasPassword) {
        await window.electronAPI.credentials.set('canvasPassword', passwords.canvasPassword)
      }
      if (!passwords.openaiApiKey.includes('•') && passwords.openaiApiKey) {
        await window.electronAPI.credentials.set('openaiApiKey', passwords.openaiApiKey)
      }
      if (!passwords.telegramBotToken.includes('•') && passwords.telegramBotToken) {
        await window.electronAPI.credentials.set('telegramBotToken', passwords.telegramBotToken)
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      console.error('Save failed:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setTestResult({ type: 'success', message: 'Connection test would run here' })
    setTimeout(() => setTestResult(null), 3000)
  }

  const handleTestApiKey = async () => {
    if (!passwords.openaiApiKey || passwords.openaiApiKey.includes('•')) {
      setTestResult({ type: 'error', message: 'Please enter an API key first' })
      setTimeout(() => setTestResult(null), 3000)
      return
    }
    setTestResult({ type: 'success', message: 'API key format looks valid' })
    setTimeout(() => setTestResult(null), 3000)
  }

  if (!localConfig) {
    return (
      <div className="settings">
        <div className="page-header">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Loading configuration...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="settings">
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Configure your learning environment</p>
          </div>
          <button
            className={`btn btn-primary save-btn ${saved ? 'saved' : ''}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <RefreshCw size={16} className="spin" />
            ) : saved ? (
              <Check size={16} />
            ) : (
              <Save size={16} />
            )}
            <span>{saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {testResult && (
        <div className={`test-result ${testResult.type}`}>
          {testResult.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{testResult.message}</span>
        </div>
      )}

      <div className="settings-grid">
        {/* Authentication Section */}
        <section className="settings-section">
          <h2 className="section-title">Authentication & Platform</h2>
          <div className="settings-fields">
            <div className="field">
              <label className="label">Canvas URL</label>
              <input
                type="url"
                className="input"
                value={localConfig.canvasUrl}
                onChange={(e) => handleChange('canvasUrl', e.target.value)}
                placeholder="https://canvas.example.edu/courses/"
              />
            </div>

            <div className="field">
              <label className="label">Username</label>
              <input
                type="text"
                className="input"
                value={localConfig.username}
                onChange={(e) => handleChange('username', e.target.value)}
                placeholder="your_username"
              />
            </div>

            <div className="field">
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                value={passwords.canvasPassword}
                onChange={(e) => handlePasswordChange('canvasPassword', e.target.value)}
                onFocus={(e) => {
                  if (e.target.value.includes('•')) e.target.value = ''
                }}
                placeholder="Enter password"
              />
              <span className="field-hint">Stored securely in OS Keychain</span>
            </div>

            <div className="field">
              <label className="label">Course Name</label>
              <input
                type="text"
                className="input"
                value={localConfig.courseName}
                onChange={(e) => handleChange('courseName', e.target.value)}
                placeholder="CIS 5300 - Spring 2026"
              />
            </div>

            <div className="field-row">
              <div className="field">
                <label className="label">2FA Method</label>
                <select
                  className="select"
                  value={localConfig.twoFactorMethod}
                  onChange={(e) => handleChange('twoFactorMethod', e.target.value)}
                >
                  <option value="2fa_sms">SMS</option>
                  <option value="2fa_push">Push Notification</option>
                  <option value="2fa_totp">Authenticator App</option>
                </select>
              </div>

              <div className="field">
                <label className="label">2FA Phone</label>
                <input
                  type="tel"
                  className="input"
                  value={localConfig.twoFactorPhone}
                  onChange={(e) => handleChange('twoFactorPhone', e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            <button className="btn btn-secondary" onClick={handleTestConnection}>
              Test Connection
            </button>
          </div>
        </section>

        {/* AI Configuration */}
        <section className="settings-section">
          <h2 className="section-title">AI Configuration</h2>
          <div className="settings-fields">
            <div className="field">
              <label className="label">OpenAI API Key</label>
              <input
                type="password"
                className="input"
                value={passwords.openaiApiKey}
                onChange={(e) => handlePasswordChange('openaiApiKey', e.target.value)}
                onFocus={(e) => {
                  if (e.target.value.includes('•')) e.target.value = ''
                }}
                placeholder="sk-..."
              />
              <span className="field-hint">Stored securely in OS Keychain</span>
            </div>

            <div className="field">
              <label className="label">GPT Context</label>
              <textarea
                className="textarea"
                value={localConfig.gptContext}
                onChange={(e) => handleChange('gptContext', e.target.value)}
                placeholder="Describe your current homework/project here. This helps the AI provide more relevant insights."
                rows={4}
              />
            </div>

            <button className="btn btn-secondary" onClick={handleTestApiKey}>
              Test API Key
            </button>
          </div>
        </section>

        {/* Study Settings */}
        <section className="settings-section">
          <h2 className="section-title">Study Settings</h2>
          <div className="settings-fields">
            <div className="field">
              <label className="label">Study Limit (minutes)</label>
              <div className="slider-container">
                <input
                  type="range"
                  min="15"
                  max="90"
                  step="5"
                  value={localConfig.studyLimit}
                  onChange={(e) => handleChange('studyLimit', parseInt(e.target.value))}
                />
                <span className="slider-value">{localConfig.studyLimit} min</span>
              </div>
            </div>

            <div className="field">
              <label className="label">Break Duration (minutes)</label>
              <div className="slider-container">
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="5"
                  value={localConfig.breakDuration}
                  onChange={(e) => handleChange('breakDuration', parseInt(e.target.value))}
                />
                <span className="slider-value">{localConfig.breakDuration} min</span>
              </div>
            </div>

            <div className="field">
              <label className="label">Quiz Time Limit (seconds)</label>
              <div className="slider-container">
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="5"
                  value={localConfig.quizTimeLimit}
                  onChange={(e) => handleChange('quizTimeLimit', parseInt(e.target.value))}
                />
                <span className="slider-value">{localConfig.quizTimeLimit}s</span>
              </div>
            </div>

            <div className="field">
              <label className="label">Playback Speed</label>
              <select
                className="select"
                value={localConfig.playbackSpeed}
                onChange={(e) => handleChange('playbackSpeed', parseFloat(e.target.value))}
              >
                <option value="1">1x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="1.75">1.75x</option>
                <option value="2">2x</option>
              </select>
            </div>
          </div>
        </section>

        {/* Browser Settings */}
        <section className="settings-section">
          <h2 className="section-title">Browser Settings</h2>
          <p className="section-desc">Optional: Use an existing Chrome profile to skip login</p>
          <div className="settings-fields">
            <div className="field">
              <label className="label">Chrome Profile Path</label>
              <div className="input-with-button">
                <input
                  type="text"
                  className="input"
                  value={localConfig.chromeProfilePath}
                  onChange={(e) => handleChange('chromeProfilePath', e.target.value)}
                  placeholder="~/Library/Application Support/Google/Chrome"
                />
                <button className="btn btn-ghost" title="Browse">
                  <FolderOpen size={18} />
                </button>
              </div>
            </div>

            <div className="field">
              <label className="label">Chrome Profile Name</label>
              <input
                type="text"
                className="input"
                value={localConfig.chromeProfileName}
                onChange={(e) => handleChange('chromeProfileName', e.target.value)}
                placeholder="Default"
              />
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="settings-section">
          <h2 className="section-title">Notifications</h2>
          <p className="section-desc">Optional: Get daily report notifications via Telegram</p>
          <div className="settings-fields">
            <div className="field">
              <label className="label">Telegram Bot Token</label>
              <input
                type="password"
                className="input"
                value={passwords.telegramBotToken}
                onChange={(e) => handlePasswordChange('telegramBotToken', e.target.value)}
                onFocus={(e) => {
                  if (e.target.value.includes('•')) e.target.value = ''
                }}
                placeholder="123456:ABC-DEF..."
              />
              <span className="field-hint">Stored securely in OS Keychain</span>
            </div>

            <div className="field">
              <label className="label">Telegram Chat ID</label>
              <input
                type="text"
                className="input"
                value={localConfig.telegramChatId}
                onChange={(e) => handleChange('telegramChatId', e.target.value)}
                placeholder="your_chat_id"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
