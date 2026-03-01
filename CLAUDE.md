# CLAUDE.md - Project Context for Claude Code

## What This Project Does

Canvas learning automation tool that:
1. Logs into Canvas LMS (handles 2FA)
2. Finds next unwatched video
3. Extracts transcript, generates AI insights
4. Plays video at 1.5x speed
5. Quizzes user (3 Y/N questions, must get 100%)
6. Marks video as done on Canvas
7. Loops infinitely until all videos complete
8. Forces study breaks after 45 min

## Key Files

- `src/index.js` - Main automation loop, Playwright browser control
- `src/progress.js` - XP, levels, streaks, achievements
- `src/homework-analyzer.js` - Parse homework files, map to videos
- `src/report.js` - Daily learning report generator

## Architecture

```
openCanvas()
├── Login & 2FA handling
├── while(true) loop:
│   ├── Navigate to Modules page
│   ├── Find first incomplete video
│   ├── Extract transcript
│   ├── askGPT() → AI insights
│   ├── generateQuiz() → 3 questions
│   ├── Play video (1.5x, fullscreen)
│   ├── runQuiz() → must get 100%
│   ├── Click "Mark as done" on Canvas
│   ├── markAsDone() → local done_list.txt
│   ├── Check if break needed (45 min limit)
│   └── Continue to next video
└── Exit when all videos complete
```

## Important Patterns

### Video Detection
Videos identified by time format in title: `(X:XX)` regex match.
Non-lecture content skipped via skipPatterns array.

### Quiz Flow
- 3 Yes/No questions generated from transcript
- 15-second time limit per question
- ALL 3 must be correct to pass
- Retry until 100% achieved

### Break System
- `sessionStats.studyStartTime` tracks when study session started
- `getStudyTimeMin()` calculates elapsed time
- `needsBreak()` checks if >= 45 min
- `forceBreak()` shows countdown timer, resets studyStartTime

### Progress Persistence
- `progress.json` - XP, level, streak, section tracking
- `done_list.txt` - Completed video titles (one per line)

## Common Modifications

### Change break timing
Top of `src/index.js`:
```javascript
const BREAK_SETTINGS = {
  STUDY_LIMIT: 45,    // minutes
  BREAK_DURATION: 10  // minutes
};
```

### Change quiz behavior
In `generateQuiz()` - adjust prompt, question count
In `runQuiz()` - adjust passing threshold

### Change AI prompts
- `askGPT()` - lecture insights prompt
- `generateQuiz()` - question generation prompt
- `evaluateSingleAnswer()` - explanation prompt

## Environment Variables

```
CANVAS_URL - Base Canvas URL
CANVAS_USERNAME - Login username
CANVAS_PASSWORD - Login password
OPENAI_API_KEY - For AI features
GPT_QUESTION - Context about homework/projects
```

## Testing Changes

```bash
node --check src/index.js  # Syntax check
npm start                   # Run full flow
```

## Gotchas

- Canvas selectors may change - check `a:has-text("Modules")` etc.
- Panopto iframe requires frame navigation for video controls
- 2FA handling assumes Duo with SMS option
- `done_list.txt` uses normalized titles (special chars removed)
