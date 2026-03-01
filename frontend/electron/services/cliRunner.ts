import { spawn, ChildProcess } from 'child_process'
import path from 'path'

type OutputCallback = (output: string) => void

export class CliRunner {
  private process: ChildProcess | null = null
  private projectRoot: string

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  start(args: string[] = [], onOutput: OutputCallback): void {
    if (this.process) {
      this.stop()
    }

    const scriptPath = path.join(this.projectRoot, 'src', 'index.js')

    this.process = spawn('node', [scriptPath, ...args], {
      cwd: this.projectRoot,
      env: { ...process.env },
      shell: true,
    })

    this.process.stdout?.on('data', (data) => {
      onOutput(data.toString())
    })

    this.process.stderr?.on('data', (data) => {
      onOutput(`[ERROR] ${data.toString()}`)
    })

    this.process.on('close', (code) => {
      onOutput(`\n[Process exited with code ${code}]`)
      this.process = null
    })

    this.process.on('error', (err) => {
      onOutput(`[ERROR] Failed to start: ${err.message}`)
      this.process = null
    })
  }

  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM')
      this.process = null
    }
  }

  isRunning(): boolean {
    return this.process !== null
  }

  sendInput(input: string): void {
    if (this.process?.stdin) {
      this.process.stdin.write(input)
    }
  }
}
