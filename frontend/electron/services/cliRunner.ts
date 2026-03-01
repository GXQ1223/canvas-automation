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
      stdio: ['pipe', 'pipe', 'pipe'], // Explicitly set stdin/stdout/stderr as pipes
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
    console.log('[CliRunner] sendInput called:', JSON.stringify(input))
    console.log('[CliRunner] process exists:', !!this.process)
    console.log('[CliRunner] stdin exists:', !!this.process?.stdin)
    console.log('[CliRunner] stdin writable:', this.process?.stdin?.writable)
    if (this.process?.stdin) {
      const result = this.process.stdin.write(input)
      console.log('[CliRunner] write result:', result)
    } else {
      console.log('[CliRunner] No stdin available!')
    }
  }
}
