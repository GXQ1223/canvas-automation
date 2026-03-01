# CLAUDE.md - Project Context for Claude Code

## What This Project Does

Canvas learning automation tool that:
1. Logs into Canvas LMS (handles 2FA)
2. Finds next unwatched video
3. Extracts transcript, generates AI insights
4. Plays video at 1.5x speed
5. Quizzes user (scales with video length: 1 question per 400 words)
6. Marks video as done on Canvas
7. Loops infinitely until all videos complete
8. Forces study breaks after 45 min

## Project Structure

```
canvas-automation/
├── src/                      # CLI automation (Node.js)
│   ├── index.js              # Main automation loop
│   ├── progress.js           # XP, levels, achievements
│   ├── homework-analyzer.js  # Parse homework, map to videos
│   └── report.js             # Daily report generator
├── frontend/                 # Electron + React desktop widget
│   ├── electron/             # Electron main process
│   │   ├── main.ts           # App entry, IPC handlers, window config
│   │   ├── preload.ts        # Context bridge for renderer
│   │   ├── tsconfig.electron.json  # Electron TypeScript config
│   │   └── services/         # Backend services
│   │       ├── configManager.ts    # Read/write config.json
│   │       ├── credentialManager.ts # OS Keychain storage
│   │       ├── fileWatcher.ts      # Watch progress/notes changes
│   │       └── cliRunner.ts        # Spawn CLI, send input
│   ├── src/                  # React app
│   │   ├── App.tsx           # Main app, modal handling, CLI parsing
│   │   ├── App.css           # Global styles, modal styles
│   │   ├── components/       # Widget components
│   │   │   ├── Widget.tsx    # Main widget (collapsible)
│   │   │   ├── Widget.css    # Widget styles
│   │   │   ├── StudyClock.tsx # Countdown timer component
│   │   │   └── StudyClock.css # Clock styles
│   │   ├── pages/            # Settings, Notes (shown as modals)
│   │   ├── stores/           # Zustand state management
│   │   └── types/            # TypeScript types
│   └── package.json
├── config.json               # GUI settings (non-secrets)
├── config.example.json       # Template for config.json
├── progress.json             # XP, level, streak, homework tracking
├── done_list.txt             # Completed video titles
├── skip_list.txt             # Skipped video titles
├── notes/                    # AI-generated lecture notes
└── reports/                  # Daily learning reports
```

## Key Files

### CLI (src/)
- `src/index.js` - Main automation loop, Playwright browser control
- `src/progress.js` - XP, levels, streaks, achievements
- `src/homework-analyzer.js` - Parse homework files, map to videos
- `src/report.js` - Daily learning report generator

### Frontend (frontend/)
- `frontend/electron/main.ts` - Electron main process, slim window (280x500), IPC handlers
- `frontend/src/App.tsx` - Widget view, modal system, CLI output parsing
- `frontend/src/components/Widget.tsx` - Collapsible widget with status, quiz, controls
- `frontend/src/components/StudyClock.tsx` - Study/break countdown timer
- `frontend/src/pages/Settings.tsx` - Settings (opens as modal)
- `frontend/src/pages/NotesViewer.tsx` - Notes browser (opens as modal)
- `frontend/src/stores/appStore.ts` - Zustand global state

## Widget Design

### Window Dimensions
- Width: 280px (fixed, slim vertical strip)
- Height: 500px expanded, 44px collapsed
- Position: Right edge of screen
- Frameless window with custom title bar

### Widget Layout (Expanded)
```
┌──────────────────────────┐
│  [Pin] [▲] [—] [X]       │  ← Custom title bar
├──────────────────────────┤
│     ⏱️ STUDY MODE        │  ← Status indicator
│       23:45              │  ← Big countdown clock
│    minutes left          │
│  ━━━━━━━━━━━━━━━━━━━━━━  │  ← Progress bar
├──────────────────────────┤
│  ● Processing video      │  ← CLI status
│  "Lecture 5: Algorithms" │  ← Current video
│  [ Continue → ]          │  ← Input button
├──────────────────────────┤
│  🎯 FOCUS QUESTIONS      │  ← Quiz section
│  1. Question one?        │
│  2. Question two?        │
│  [Practice] mode toggle  │
├──────────────────────────┤
│  ▶️ Start Learning       │  ← Primary action
├──────────────────────────┤
│  Lv.15 │ 🔥 2 │ 76%     │  ← Stats row
├──────────────────────────┤
│  📹 51 videos done       │  ← Counters
│  📝 3 sections complete  │
├──────────────────────────┤
│  ⚙️ Settings │ 📖 Notes  │  ← Bottom actions (modals)
└──────────────────────────┘
```

### Widget Layout (Collapsed - 44px bar)
```
┌──────────────────────────────────────┐
│ ⏱️ 23:45 │ Lv.15 │ 🔥2 │    [▼]    │
└──────────────────────────────────────┘
```

### Clock States
- **Study Mode** (green): Countdown to break
- **Break Mode** (orange): Break countdown
- **Idle Mode** (purple): Ready to start

## Configuration

### config.json (GUI-managed settings)
```json
{
  "canvasUrl": "https://canvas.upenn.edu/courses/",
  "username": "your_username",
  "courseName": "CIS 5300 - Spring 2026",
  "gptContext": "Homework context for AI",
  "studyLimit": 45,
  "breakDuration": 10,
  "quizTimeLimit": 30,
  "playbackSpeed": 1.5,
  "chromeProfilePath": "",
  "chromeProfileName": "Default"
}
```

### .env (secrets only)
```
CANVAS_PASSWORD=your_password
OPENAI_API_KEY=sk-...
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
```

The CLI checks `config.json` first, then falls back to `.env` for any missing values.

## Architecture

### CLI Flow
```
openCanvas()
├── Load config (config.json → .env fallback)
├── Login & 2FA handling
├── while(true) loop:
│   ├── Navigate to Modules page
│   ├── Find first incomplete video
│   ├── Extract transcript
│   ├── askGPT() → AI insights
│   ├── generateQuiz() → 1 question per 400 words (min 3, max 8)
│   ├── Display "FOCUS WHILE WATCHING" questions
│   ├── Wait for ENTER (widget shows "Continue →" button)
│   ├── Play video (1.5x, fullscreen)
│   ├── runQuiz() → must get 100% (widget shows Y/N buttons)
│   ├── Click "Mark as done" on Canvas
│   ├── markAsDone() → local done_list.txt
│   ├── Check if break needed (studyLimit)
│   └── Continue to next video
└── Exit when all videos complete
```

### Frontend Architecture
```
Electron Main Process (280x500 frameless window)
├── ConfigManager - Read/write config.json
├── CredentialManager - OS Keychain via keytar
├── FileWatcher - Watch progress.json, notes/, etc.
├── CliRunner - Spawn CLI, sendInput() for Enter/Y/N
├── Window Controls - setAlwaysOnTop, setSize, minimize, close
└── IPC Handlers - Bridge to React

React Renderer (Widget)
├── Zustand Store - Global state + quiz questions
├── Widget Component
│   ├── StudyClock - Countdown timer (study/break/idle)
│   ├── CLI Status - Current step, video name
│   ├── Input Buttons - Continue/Yes/No
│   ├── Quiz Display - Focus questions with practice mode
│   ├── Stats Row - Level, streak, accuracy
│   └── Bottom Actions - Settings/Notes modals
├── Modal System
│   ├── Settings - All config fields
│   └── NotesViewer - Browse/search notes
└── CLI Output Parser - Extract quiz questions, status
```

## Important Patterns

### Video Detection
Videos identified by time format in title: `(X:XX)` regex match.
Non-lecture content skipped via skipPatterns array.

### Quiz Flow
- Questions scale with video length: 1 per 400 words (~1 per 2-3 min)
- Minimum 3 questions, maximum 8 questions
- Time limit per question (configurable, default 30s)
- ALL questions must be correct to pass
- Retry until 100% achieved
- Widget shows questions during video for focus
- Widget provides Y/N buttons during quiz

### CLI-Widget Communication
- CLI output is streamed to widget via IPC
- Widget parses output for status updates and quiz questions
- Widget can send input to CLI (Enter, Y, N) via `cliRunner.sendInput()`
- Quiz questions extracted when "FOCUS WHILE WATCHING:" detected

### Break System
- `sessionStats.studyStartTime` tracks when study session started
- `getStudyTimeMin()` calculates elapsed time
- `needsBreak()` checks if >= studyLimit
- `forceBreak()` shows countdown timer, resets studyStartTime
- Widget clock shows break countdown in orange

### Progress Persistence
- `progress.json` - XP, level, streak, section tracking
- `done_list.txt` - Completed video titles (one per line)
- `skip_list.txt` - Skipped video titles

### Credential Security
- Passwords and API keys stored in OS Keychain (via keytar)
- Never stored in config.json
- Frontend accesses via CredentialManager IPC

## Running the App

### CLI Only
```bash
npm start                   # Full automation
npm run quick               # Quick 5-min session
npm run status              # Show progress
npm run report              # Generate daily report
```

### Frontend (Electron Widget)
```bash
cd frontend
npm install
npm run build:electron      # Compile electron TypeScript
npm run electron:dev        # Dev mode with hot reload
npm run electron:build      # Build for distribution
```

### Using Widget with CLI
1. Start widget: `npm run electron:dev`
2. Click "Start Learning" in widget (or run `npm start` in terminal)
3. Widget shows real-time status and quiz questions
4. Use "Continue →" button instead of pressing Enter in terminal
5. Use "Yes/No" buttons during quiz

## Common Modifications

### Change study/break timing
Edit via Settings modal, or directly in `config.json`:
```json
{
  "studyLimit": 45,
  "breakDuration": 10
}
```

### Change quiz scaling
In `src/index.js` `generateQuiz()`:
```javascript
// Current: 1 question per 400 words, min 3, max 8
const questionCount = Math.min(8, Math.max(3, Math.ceil(wordCount / 400)));
```

### Change AI prompts
- `askGPT()` - lecture insights prompt
- `generateQuiz()` - question generation prompt
- `evaluateSingleAnswer()` - explanation prompt

### Add new Settings field
1. Add to `frontend/electron/services/configManager.ts` (AppConfig interface)
2. Add to `frontend/src/types/index.ts` (AppConfig interface)
3. Add UI in `frontend/src/pages/Settings.tsx`
4. Use in CLI via `getConfig('field', 'ENV_VAR', 'default')`

### Modify widget layout
- `frontend/src/components/Widget.tsx` - Component structure
- `frontend/src/components/Widget.css` - Styling
- `frontend/electron/main.ts` - Window size (WIDGET_WIDTH, WIDGET_HEIGHT)

## Gotchas

- Canvas selectors may change - check `a:has-text("Modules")` etc.
- Panopto iframe requires frame navigation for video controls
- 2FA handling assumes Duo with SMS option
- `done_list.txt` uses normalized titles (special chars removed)
- config.json takes priority over .env for non-secret values
- Secrets (passwords, API keys) always from .env or OS Keychain
- Electron requires `npm run build:electron` before `electron:dev`
- Widget window is frameless - drag via title bar area
- Quiz questions parse from CLI output containing "FOCUS WHILE WATCHING:"
