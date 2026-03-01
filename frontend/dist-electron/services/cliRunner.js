"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CliRunner = void 0;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
class CliRunner {
    constructor(projectRoot) {
        this.process = null;
        this.projectRoot = projectRoot;
    }
    start(args = [], onOutput) {
        if (this.process) {
            this.stop();
        }
        const scriptPath = path_1.default.join(this.projectRoot, 'src', 'index.js');
        this.process = (0, child_process_1.spawn)('node', [scriptPath, ...args], {
            cwd: this.projectRoot,
            env: { ...process.env },
            stdio: ['pipe', 'pipe', 'pipe'], // Explicitly set stdin/stdout/stderr as pipes
        });
        this.process.stdout?.on('data', (data) => {
            onOutput(data.toString());
        });
        this.process.stderr?.on('data', (data) => {
            onOutput(`[ERROR] ${data.toString()}`);
        });
        this.process.on('close', (code) => {
            onOutput(`\n[Process exited with code ${code}]`);
            this.process = null;
        });
        this.process.on('error', (err) => {
            onOutput(`[ERROR] Failed to start: ${err.message}`);
            this.process = null;
        });
    }
    stop() {
        if (this.process) {
            this.process.kill('SIGTERM');
            this.process = null;
        }
    }
    isRunning() {
        return this.process !== null;
    }
    sendInput(input) {
        console.log('[CliRunner] sendInput called:', JSON.stringify(input));
        console.log('[CliRunner] process exists:', !!this.process);
        console.log('[CliRunner] stdin exists:', !!this.process?.stdin);
        console.log('[CliRunner] stdin writable:', this.process?.stdin?.writable);
        if (this.process?.stdin) {
            const result = this.process.stdin.write(input);
            console.log('[CliRunner] write result:', result);
        }
        else {
            console.log('[CliRunner] No stdin available!');
        }
    }
}
exports.CliRunner = CliRunner;
//# sourceMappingURL=cliRunner.js.map