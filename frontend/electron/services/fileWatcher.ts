import chokidar from 'chokidar'
import path from 'path'
import fs from 'fs'

type FileChangeCallback = (event: string, data: unknown) => void

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null
  private projectRoot: string
  private callback: FileChangeCallback

  constructor(projectRoot: string, callback: FileChangeCallback) {
    this.projectRoot = projectRoot
    this.callback = callback
  }

  start(): void {
    const watchPaths = [
      path.join(this.projectRoot, 'progress.json'),
      path.join(this.projectRoot, 'done_list.txt'),
      path.join(this.projectRoot, 'skip_list.txt'),
      path.join(this.projectRoot, 'notes'),
      path.join(this.projectRoot, 'reports'),
      path.join(this.projectRoot, 'config.json'),
    ]

    this.watcher = chokidar.watch(watchPaths, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    })

    this.watcher.on('change', (filePath) => {
      this.handleChange(filePath)
    })

    this.watcher.on('add', (filePath) => {
      this.handleAdd(filePath)
    })

    this.watcher.on('unlink', (filePath) => {
      this.handleDelete(filePath)
    })
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  }

  private handleChange(filePath: string): void {
    const fileName = path.basename(filePath)

    if (fileName === 'progress.json') {
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const data = JSON.parse(content)
        this.callback('progress-updated', data)
      } catch {
        // Ignore parse errors during write
      }
    } else if (fileName === 'done_list.txt') {
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'))
        this.callback('done-list-updated', lines)
      } catch {
        // Ignore errors
      }
    } else if (fileName === 'config.json') {
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const data = JSON.parse(content)
        this.callback('config-updated', data)
      } catch {
        // Ignore parse errors
      }
    }
  }

  private handleAdd(filePath: string): void {
    const dir = path.dirname(filePath)
    const dirName = path.basename(dir)

    if (dirName === 'notes') {
      this.callback('note-added', { path: filePath, name: path.basename(filePath) })
    } else if (dirName === 'reports') {
      this.callback('report-added', { path: filePath, name: path.basename(filePath) })
    }
  }

  private handleDelete(filePath: string): void {
    const dir = path.dirname(filePath)
    const dirName = path.basename(dir)

    if (dirName === 'notes') {
      this.callback('note-deleted', { path: filePath, name: path.basename(filePath) })
    } else if (dirName === 'reports') {
      this.callback('report-deleted', { path: filePath, name: path.basename(filePath) })
    }
  }
}
