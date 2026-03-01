"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DEFAULT_CONFIG = {
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
};
class ConfigManager {
    constructor(projectRoot) {
        this.configPath = path_1.default.join(projectRoot, 'config.json');
        this.envPath = path_1.default.join(projectRoot, '.env');
        this.config = this.loadConfig();
    }
    loadConfig() {
        // Try config.json first
        if (fs_1.default.existsSync(this.configPath)) {
            try {
                const content = fs_1.default.readFileSync(this.configPath, 'utf-8');
                const parsed = JSON.parse(content);
                return { ...DEFAULT_CONFIG, ...parsed };
            }
            catch {
                console.error('Failed to parse config.json');
            }
        }
        // Fall back to .env migration
        if (fs_1.default.existsSync(this.envPath)) {
            return this.migrateFromEnv();
        }
        return { ...DEFAULT_CONFIG };
    }
    migrateFromEnv() {
        const envContent = fs_1.default.readFileSync(this.envPath, 'utf-8');
        const config = { ...DEFAULT_CONFIG };
        const envVars = {};
        envContent.split('\n').forEach(line => {
            const match = line.match(/^([^#=]+)=(.*)$/);
            if (match) {
                envVars[match[1].trim()] = match[2].trim();
            }
        });
        if (envVars.CANVAS_URL)
            config.canvasUrl = envVars.CANVAS_URL;
        if (envVars.CANVAS_USERNAME)
            config.username = envVars.CANVAS_USERNAME;
        if (envVars.CANVAS_COURSE_NAME)
            config.courseName = envVars.CANVAS_COURSE_NAME;
        if (envVars.GPT_QUESTION)
            config.gptContext = envVars.GPT_QUESTION;
        if (envVars.CHROME_USER_DATA_DIR)
            config.chromeProfilePath = envVars.CHROME_USER_DATA_DIR;
        if (envVars.CHROME_PROFILE)
            config.chromeProfileName = envVars.CHROME_PROFILE;
        if (envVars.TELEGRAM_CHAT_ID)
            config.telegramChatId = envVars.TELEGRAM_CHAT_ID;
        return config;
    }
    saveConfig() {
        fs_1.default.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    }
    getConfig() {
        return { ...this.config };
    }
    setConfig(config) {
        this.config = { ...this.config, ...config };
        this.saveConfig();
    }
    getField(field) {
        return this.config[field];
    }
    setField(field, value) {
        this.config[field] = value;
        this.saveConfig();
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=configManager.js.map