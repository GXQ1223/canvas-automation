# Canvas Learning Automation

Automate your Canvas LMS video learning workflow with AI-powered quizzes, progress tracking, and healthy study breaks.

## Features

- **Auto-login & Navigation** - Handles Canvas login including 2FA
- **Transcript Extraction** - Pulls video transcripts automatically
- **AI Analysis** - Summarizes key concepts from each lecture
- **Quiz Generation** - Creates Yes/No questions to test understanding
- **Progress Tracking** - XP system, levels, streaks, achievements
- **Forced Breaks** - 10-min break after 45 min of studying (configurable)
- **Infinite Loop** - Keeps going until you finish all videos

## Quick Start

```bash
# Install dependencies
npm install

# Copy and fill in your credentials
cp .env.example .env

# Run
npm start
```

## Environment Variables

Create a `.env` file with:

```
CANVAS_URL=https://canvas.yourschool.edu/courses/
CANVAS_USERNAME=your_username
CANVAS_PASSWORD=your_password
OPENAI_API_KEY=sk-...
GPT_QUESTION="Your homework/project context for AI to reference"
```

## Usage

```bash
npm start          # Full learning session (infinite loop)
npm run quick      # Quick 5-min session (shortest video)
npm run status     # Check progress without watching
npm run report     # Generate daily learning report
npm start -- 2     # Start from Week 2
```

## How It Works

```
Login → Find next video → AI insights → Watch video → Quiz (100% required) → Mark done → Repeat
```

### The Flow

1. **Startup** - Shows progress dashboard and study break timer
2. **Find Video** - Locates next unwatched video in modules
3. **AI Analysis** - Extracts transcript, generates key insights
4. **Focus Questions** - Shows 3 questions to watch for
5. **Video Playback** - Auto-plays at 1.5x, tracks progress
6. **Quiz** - 3 Yes/No questions, must get ALL correct to pass
7. **Mark Complete** - Clicks Canvas "Mark as done", updates local list
8. **Break Check** - Forces 10-min break after 45 min of studying
9. **Loop** - Continues to next video until semester complete

### Gamification

| Action | XP |
|--------|-----|
| Watch video | +50 |
| Quiz correct | +25 |
| Fast answer (<5s) | +15 bonus |
| Complete section | +200 |
| Daily streak | +25 |

### Study Breaks

The app enforces healthy study habits:
- Tracks total study time (video + quiz)
- Forces a **10-minute break** after **45 minutes**
- Shows countdown timer: `[Break in 12 min]`
- Break timer counts down, then resumes automatically

## File Structure

```
src/
  index.js              # Main automation
  homework-analyzer.js  # Parse homework, map to videos
  progress.js           # XP, levels, streaks
  report.js             # Daily report generator

# User data (gitignored)
done_list.txt           # Completed videos
progress.json           # Your progress
notes/                  # AI-generated notes
```

## Requirements

- Node.js 18+
- OpenAI API key (for AI features)
- Canvas LMS account

## Customization

Edit constants at top of `src/index.js`:

```javascript
const BREAK_SETTINGS = {
  STUDY_LIMIT: 45,    // Minutes before forced break
  BREAK_DURATION: 10  // Break length in minutes
};
```

## License

MIT

## Credits

Built with [Playwright](https://playwright.dev/) and [OpenAI API](https://openai.com/).

Co-developed with Claude Code.
