"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileWatcher = void 0;
const chokidar_1 = __importDefault(require("chokidar"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
class FileWatcher {
    constructor(projectRoot, callback) {
        this.watcher = null;
        this.projectRoot = projectRoot;
        this.callback = callback;
    }
    start() {
        const watchPaths = [
            path_1.default.join(this.projectRoot, 'progress.json'),
            path_1.default.join(this.projectRoot, 'done_list.txt'),
            path_1.default.join(this.projectRoot, 'skip_list.txt'),
            path_1.default.join(this.projectRoot, 'notes'),
            path_1.default.join(this.projectRoot, 'reports'),
            path_1.default.join(this.projectRoot, 'config.json'),
        ];
        this.watcher = chokidar_1.default.watch(watchPaths, {
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 500,
                pollInterval: 100,
            },
        });
        this.watcher.on('change', (filePath) => {
            this.handleChange(filePath);
        });
        this.watcher.on('add', (filePath) => {
            this.handleAdd(filePath);
        });
        this.watcher.on('unlink', (filePath) => {
            this.handleDelete(filePath);
        });
    }
    stop() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }
    handleChange(filePath) {
        const fileName = path_1.default.basename(filePath);
        if (fileName === 'progress.json') {
            try {
                const content = fs_1.default.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(content);
                this.callback('progress-updated', data);
            }
            catch {
                // Ignore parse errors during write
            }
        }
        else if (fileName === 'done_list.txt') {
            try {
                const content = fs_1.default.readFileSync(filePath, 'utf-8');
                const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
                this.callback('done-list-updated', lines);
            }
            catch {
                // Ignore errors
            }
        }
        else if (fileName === 'config.json') {
            try {
                const content = fs_1.default.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(content);
                this.callback('config-updated', data);
            }
            catch {
                // Ignore parse errors
            }
        }
    }
    handleAdd(filePath) {
        const dir = path_1.default.dirname(filePath);
        const dirName = path_1.default.basename(dir);
        if (dirName === 'notes') {
            this.callback('note-added', { path: filePath, name: path_1.default.basename(filePath) });
        }
        else if (dirName === 'reports') {
            this.callback('report-added', { path: filePath, name: path_1.default.basename(filePath) });
        }
    }
    handleDelete(filePath) {
        const dir = path_1.default.dirname(filePath);
        const dirName = path_1.default.basename(dir);
        if (dirName === 'notes') {
            this.callback('note-deleted', { path: filePath, name: path_1.default.basename(filePath) });
        }
        else if (dirName === 'reports') {
            this.callback('report-deleted', { path: filePath, name: path_1.default.basename(filePath) });
        }
    }
}
exports.FileWatcher = FileWatcher;
//# sourceMappingURL=fileWatcher.js.map