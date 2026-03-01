import { chromium } from 'playwright';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import readline from 'readline';

// Import homework analyzer and progress tracker
import {
  parseHomework,
  analyzeHomework,
  mapSectionsToVideos,
  generateHomeworkQuestions,
  displayHomeworkAnalysis
} from './homework-analyzer.js';

import {
  generateDailyReport,
  generateReminderMessage,
  displayReport
} from './report.js';

import {
  loadProgress,
  saveProgress,
  addXP,
  updateStreak,
  initHomeworkTracking,
  updateSectionProgress,
  getHomeworkProgress,
  displayProgressDashboard,
  celebrateSection,
  celebrateHomework,
  recordQuizAnswer,
  displayAccuracyStats,
  getAccuracy,
  XP_REWARDS,
  QUIZ_SETTINGS
} from './progress.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DONE_LIST_PATH = path.join(__dirname, '..', 'done_list.txt');
const NOTES_DIR = path.join(__dirname, '..', 'notes');
const HOMEWORK_DIR = path.join(__dirname, '..', 'homework');

// Create notes directory if it doesn't exist
if (!fs.existsSync(NOTES_DIR)) {
  fs.mkdirSync(NOTES_DIR, { recursive: true });
}

const CANVAS_URL = process.env.CANVAS_URL || 'https://canvas.upenn.edu/courses/';
const CANVAS_USERNAME = process.env.CANVAS_USERNAME;
const CANVAS_PASSWORD = process.env.CANVAS_PASSWORD;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GPT_QUESTION = process.env.GPT_QUESTION;
const CANVAS_COURSE_NAME = process.env.CANVAS_COURSE_NAME || 'CIS 5300 - Spring 2026';
const CHROME_USER_DATA_DIR = process.env.CHROME_USER_DATA_DIR;
const CHROME_PROFILE = process.env.CHROME_PROFILE || 'Default';
const SKIP_LIST_PATH = path.join(__dirname, '..', 'skip_list.txt');

// Initialize OpenAI client
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// Parse command line arguments
const args = process.argv.slice(2);
const MODE = {
  HW: args.includes('--hw'),
  QUICK: args.includes('--quick'),
  STATUS: args.includes('--status'),
  REPORT: args.includes('--report'),
  SKIP: args.includes('--skip')
};
const weekNumber = args.find(a => !a.startsWith('--') && !isNaN(parseInt(a)));
const moduleFlag = args.find(a => a.startsWith('--module='));
const moduleOverride = moduleFlag ? parseInt(moduleFlag.split('=')[1]) : null;

// Session stats tracking
const sessionStats = {
  videosWatched: 0,
  questionsAnswered: 0,
  questionsCorrect: 0,
  xpEarned: 0,
  sectionsStarted: 0,
  sectionsCompleted: 0,
  startTime: Date.now(),
  studyStartTime: Date.now()  // When current study session started (resets after break)
};

// Break settings (in minutes)
const BREAK_SETTINGS = {
  STUDY_LIMIT: 45,   // Force break after 45 min of studying (video + quiz)
  BREAK_DURATION: 10 // 10 min break
};

// Get current study time in minutes
function getStudyTimeMin() {
  return Math.round((Date.now() - sessionStats.studyStartTime) / 60000);
}

// Get time until break
function getTimeUntilBreak() {
  const studyMin = getStudyTimeMin();
  const remaining = BREAK_SETTINGS.STUDY_LIMIT - studyMin;
  return Math.max(0, remaining);
}

// Format break clock
function breakClock() {
  const remaining = getTimeUntilBreak();
  return `[Break in ${remaining} min]`;
}

// Helper function to wait for user input
function waitForEnter(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

// Force a break with countdown timer
async function forceBreak(durationMin) {
  console.log('\n' + '='.repeat(55));
  console.log(`BREAK TIME! You've been studying for ${BREAK_SETTINGS.STUDY_LIMIT} min.`);
  console.log(`Take a ${durationMin} minute break. Stand up, stretch, hydrate!`);
  console.log('='.repeat(55));

  const breakMs = durationMin * 60 * 1000;
  const breakStart = Date.now();

  while (Date.now() - breakStart < breakMs) {
    const remaining = Math.ceil((breakMs - (Date.now() - breakStart)) / 1000);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    process.stdout.write(`\rBreak: ${mins}:${secs.toString().padStart(2, '0')} remaining...  `);
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n\nBreak over! Let\'s continue learning.');
  console.log('='.repeat(55));

  // Reset study time
  sessionStats.studyStartTime = Date.now();
}

// Check if break is needed
function needsBreak() {
  return getStudyTimeMin() >= BREAK_SETTINGS.STUDY_LIMIT;
}

// Helper function for 1/2 input (instant keypress like Claude Code)
function askYesNo(prompt) {
  return new Promise(resolve => {
    // Show prompt with options
    console.log(prompt.replace(/\(Y\/N\):?\s*$/i, '').trim());
    console.log('   1) Yes    2) No');
    process.stdout.write('   > ');

    const onKeyPress = (key) => {
      const char = key.toString();

      if (char === '1') {
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onKeyPress);
        console.log('1 - Yes');
        resolve(true);
      } else if (char === '2') {
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onKeyPress);
        console.log('2 - No');
        resolve(false);
      } else if (char === '\u0003') {
        // Ctrl+C
        process.exit();
      }
      // Ignore other keys
    };

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on('data', onKeyPress);
  });
}

// Timed 1/2/3 question with visual countdown - instant keypress like Claude Code
function askTimedQuestion(prompt, timeLimit = QUIZ_SETTINGS.TIME_LIMIT) {
  return new Promise(resolve => {
    const startTime = Date.now();
    let answered = false;
    let timeoutId;
    let countdownInterval;

    // Show options
    console.log('');
    console.log('   1) Yes    2) No    3) Skip');
    console.log('');

    // Function to render countdown bar
    const renderCountdown = () => {
      if (answered) return;

      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, timeLimit - elapsed);
      const remainingInt = Math.ceil(remaining);
      const progress = remaining / timeLimit;
      const barWidth = 20;
      const filled = Math.round(progress * barWidth);
      const empty = barWidth - filled;

      let status = '';
      if (remaining <= 5) {
        status = ' HURRY!';
      }

      const bar = '█'.repeat(filled) + '░'.repeat(empty);
      process.stdout.write(`\r   [${bar}] ${remainingInt.toString().padStart(2)}s${status}  > `);
    };

    // Initial render
    renderCountdown();

    // Update countdown every 100ms
    countdownInterval = setInterval(renderCountdown, 100);

    // Set timeout
    timeoutId = setTimeout(() => {
      if (!answered) {
        answered = true;
        clearInterval(countdownInterval);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.removeListener('data', onKeyPress);
        console.log('\n\n   ⏰ TIME OUT!');
        resolve({ answer: null, responseTime: timeLimit, timedOut: true });
      }
    }, timeLimit * 1000);

    // Handle keypress
    const onKeyPress = (key) => {
      if (answered) return;

      const char = key.toString();

      // Check for valid input (1, 2, 3)
      if (char === '1' || char === '2' || char === '3') {
        answered = true;
        clearTimeout(timeoutId);
        clearInterval(countdownInterval);

        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.removeListener('data', onKeyPress);

        const responseTime = (Date.now() - startTime) / 1000;

        let answerText;
        let answerValue;

        if (char === '1') {
          answerValue = true;
          answerText = 'Yes';
        } else if (char === '2') {
          answerValue = false;
          answerText = 'No';
        } else {
          answerValue = null;
          answerText = 'Skip';
        }

        console.log(`${char}`);
        console.log(`   Answered: ${answerText} (${responseTime.toFixed(1)}s)`);

        resolve({ answer: answerValue, responseTime, timedOut: false });
      } else if (char === '\u0003') {
        // Ctrl+C
        process.exit();
      }
      // Ignore other keys
    };

    // Enable raw mode for instant keypress
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on('data', onKeyPress);
  });
}

// Normalize string by removing invisible/special characters
function normalizeTitle(str) {
  return str
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Read done list
function getDoneList() {
  try {
    const content = fs.readFileSync(DONE_LIST_PATH, 'utf-8');
    return content.split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => normalizeTitle(line));
  } catch (e) {
    return [];
  }
}

// Check if video is in done list
function isVideoDone(videoTitle, doneList) {
  const normalizedTitle = normalizeTitle(videoTitle);
  return doneList.some(done => normalizeTitle(done) === normalizedTitle);
}

// Add video to done list
function markAsDone(videoTitle) {
  const doneList = getDoneList();
  if (!isVideoDone(videoTitle, doneList)) {
    fs.appendFileSync(DONE_LIST_PATH, `${normalizeTitle(videoTitle)}\n`);
    console.log(`\nVIDEO COMPLETE: ${normalizeTitle(videoTitle)}`);
  }
}

// Read skip list
function getSkipList() {
  try {
    const content = fs.readFileSync(SKIP_LIST_PATH, 'utf-8');
    return content.split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => normalizeTitle(line));
  } catch (e) {
    return [];
  }
}

// Check if video is in skip list
function isVideoSkipped(videoTitle, skipList) {
  const normalizedTitle = normalizeTitle(videoTitle);
  return skipList.some(skip => normalizeTitle(skip) === normalizedTitle);
}

// Add video to skip list
function addToSkipList(videoTitle) {
  const skipList = getSkipList();
  const normalized = normalizeTitle(videoTitle);
  if (!skipList.includes(normalized)) {
    fs.appendFileSync(SKIP_LIST_PATH, `${normalized}\n`);
    console.log(`\nSKIPPED: ${normalized}`);
  }
}

// Detect current module from done list
function getCurrentModule() {
  try {
    const content = fs.readFileSync(DONE_LIST_PATH, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    let currentModule = 1;
    for (const line of lines) {
      const match = line.match(/Introduction to Module (\d+)/i);
      if (match) {
        currentModule = parseInt(match[1]);
      }
    }
    return currentModule;
  } catch (e) {
    return 1;
  }
}

// Read homework for a specific module
function getHomework(moduleNumber) {
  const homeworkFile = path.join(HOMEWORK_DIR, `module_${moduleNumber}.txt`);
  if (!fs.existsSync(homeworkFile)) return '';
  try {
    const content = fs.readFileSync(homeworkFile, 'utf-8');
    if (content.includes('Paste your homework content here') && content.length < 300) return '';
    return content;
  } catch (e) {
    return '';
  }
}

// Generate homework-focused quiz questions (3 questions)
async function generateQuiz(transcript, videoTitle, relevantSections = []) {
  if (!OPENAI_API_KEY || !transcript || transcript.length < 50) {
    return null;
  }

  console.log('\nGenerating homework-focused questions...');

  const sectionsContext = relevantSections.length > 0
    ? `This video helps with:\n${relevantSections.map(s => `- Section ${s.id}: ${s.title}`).join('\n')}`
    : '';

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Create exactly 3 Yes/No questions. Each question must have ONLY ONE correct answer.

OUTPUT FORMAT - follow EXACTLY:
Q1: YES: Is the sky blue?
Q2: NO: Is 2+2 equal to 5?
Q3: YES: Does water boil at 100 degrees Celsius?

RULES:
- Start each line with Q1:, Q2:, Q3:
- After the colon, write YES: or NO: to indicate the correct answer
- Then write the question
- You MUST include at least one YES and at least one NO answer
- Make questions that test understanding, not trivia
- Include tricky questions where the intuitive answer might be wrong`
        },
        {
          role: 'user',
          content: `${sectionsContext}

LECTURE: ${videoTitle}

TRANSCRIPT:
${transcript.substring(0, 3000)}

Create 3 homework-focused Y/N questions.`
        }
      ],
      max_tokens: 400
    });

    const questionsText = response.choices[0].message.content;

    const questions = questionsText.split('\n')
      .filter(line => line.match(/^Q\d/i))
      .map(line => {
        // Remove Q1:, Q2:, etc.
        const cleaned = line.replace(/^Q\d[\.:)\s]+/i, '').trim();

        // Expected format: YES: Question or NO: Question
        let match = cleaned.match(/^(YES|NO)\s*:\s*(.+)$/i);
        if (match) {
          return {
            correctAnswer: match[1].toUpperCase() === 'YES',
            text: match[2].trim()
          };
        }

        // Alternative: [Yes] Question or [No] Question
        match = cleaned.match(/^\[(Yes|No)\]\s*[-–—:]?\s*(.+)$/i);
        if (match) {
          return {
            correctAnswer: match[1].toUpperCase() === 'YES',
            text: match[2].trim()
          };
        }

        // Alternative: Yes - Question or No - Question
        match = cleaned.match(/^(Yes|No)\s*[-–—]\s*(.+)$/i);
        if (match) {
          return {
            correctAnswer: match[1].toUpperCase() === 'YES',
            text: match[2].trim()
          };
        }

        // Fallback: look for YES or NO anywhere at the start
        if (cleaned.toUpperCase().startsWith('YES')) {
          return {
            correctAnswer: true,
            text: cleaned.replace(/^YES\s*[:,-]?\s*/i, '').trim()
          };
        }
        if (cleaned.toUpperCase().startsWith('NO')) {
          return {
            correctAnswer: false,
            text: cleaned.replace(/^NO\s*[:,-]?\s*/i, '').trim()
          };
        }

        // Last resort
        console.log(`Warning: Could not parse: ${cleaned}`);
        return { correctAnswer: true, text: cleaned };
      });

    return questions.length > 0 ? questions.slice(0, 3) : null;
  } catch (e) {
    console.log(`Quiz generation failed: ${e.message}`);
    return null;
  }
}

// Evaluate answer - userAnswer is true (Yes), false (No), or null (Skip)
async function evaluateSingleAnswer(questionText, userAnswer, correctAnswer, transcript) {
  // Handle skip
  if (userAnswer === null) {
    const correctStr = correctAnswer ? 'Yes' : 'No';
    return {
      isCorrect: false,
      explanation: `[Skipped] The correct answer was: ${correctStr}`
    };
  }

  // Check if correct (userAnswer and correctAnswer are both booleans)
  const isCorrect = (userAnswer === correctAnswer);
  const userAnswerStr = userAnswer ? 'Yes' : 'No';
  const correctAnswerStr = correctAnswer ? 'Yes' : 'No';

  // Generate explanation
  if (!OPENAI_API_KEY) {
    return {
      isCorrect,
      explanation: isCorrect ? '[Correct!]' : `[Wrong] The correct answer was: ${correctAnswerStr}`
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You're a chill tutor. Student answered "${userAnswerStr}" (correct: "${correctAnswerStr}").
${isCorrect ? 'They nailed it!' : 'They missed it.'}
Reply in MAX 10 words. Be punchy, maybe witty. No fluff.
Start with: ${isCorrect ? '"Nice!"' : `"Nope - ${correctAnswerStr}."`}`
        },
        {
          role: 'user',
          content: `Q: ${questionText}\nContext: ${transcript.substring(0, 800)}`
        }
      ],
      max_tokens: 40
    });

    return { isCorrect, explanation: response.choices[0].message.content };
  } catch (e) {
    return {
      isCorrect,
      explanation: isCorrect ? '[Correct!]' : `[Wrong] The correct answer was: ${correctAnswerStr}`
    };
  }
}

// Run interactive quiz (3 questions) with retry until all correct
async function runQuiz(questions, notePath, transcript, videoTitle, progress, moduleNumber, relevantSections, sessionStats) {
  if (!questions || questions.length === 0) return 0;

  const requiredCorrect = Math.min(questions.length, 3);
  let attempt = 0;
  let quizPassed = false;
  let totalXPAllAttempts = 0;

  while (!quizPassed) {
    attempt++;
    const accuracy = getAccuracy(progress);
    console.log('\n' + '='.repeat(55));
    console.log(`QUIZ - ${requiredCorrect} questions | ${breakClock()}`);
    if (attempt > 1) {
      console.log(`ATTEMPT #${attempt} - Let's try again!`);
    }
    console.log(`Accuracy: ${accuracy}%`);
    console.log('='.repeat(55));

    let correctCount = 0;
    let totalXP = 0;
    const results = [];

    for (let i = 0; i < requiredCorrect; i++) {
      const q = questions[i];
      const questionText = q.text || q; // Handle both new format and fallback
      const correctAnswer = q.correctAnswer ?? null;

      console.log(`\nQ${i + 1}: ${questionText}`);

      // Timed question
      const { answer, responseTime, timedOut } = await askTimedQuestion('', QUIZ_SETTINGS.TIME_LIMIT);

      if (timedOut) {
        // Record timeout - show correct answer
        recordQuizAnswer(progress, false, responseTime, true);
        const correctStr = correctAnswer ? 'Yes' : 'No';
        console.log('-'.repeat(50));
        console.log(`⏰ TIME OUT! The correct answer was: ${correctStr}`);
        console.log('-'.repeat(50));
        results.push({ question: questionText, answer: 'TIMEOUT', responseTime, correct: false });
        sessionStats.questionsAnswered++;
        continue;
      }

      // Evaluate answer (answer is true=Yes, false=No, null=Skip)
      const { isCorrect, explanation } = await evaluateSingleAnswer(questionText, answer, correctAnswer, transcript);

      if (isCorrect) {
        correctCount++;
      }

      // Record answer and award XP (skip counts as wrong)
      const { xpEarned, speedBonus } = recordQuizAnswer(progress, isCorrect, responseTime, false);
      totalXP += xpEarned;

      // Track session stats
      sessionStats.questionsAnswered++;
      if (isCorrect) sessionStats.questionsCorrect++;
      sessionStats.xpEarned += xpEarned;

      console.log('-'.repeat(50));
      console.log(explanation);
      if (speedBonus > 0) {
        console.log(`Speed bonus: +${speedBonus} XP`);
      }
      console.log('-'.repeat(50));

      // Convert answer to string for results
      const answerStr = answer === null ? 'Skip' : (answer ? 'Yes' : 'No');
      results.push({ question: questionText, answer: answerStr, responseTime, correct: isCorrect });
    }

    totalXPAllAttempts += totalXP;

    // Append quiz results to notes file
    if (notePath && fs.existsSync(notePath)) {
      let quizContent = `\n\n## Quiz Results (Attempt ${attempt})\n`;
      quizContent += `Score: ${correctCount}/${requiredCorrect}\n`;
      quizContent += `XP earned: ${totalXP}\n`;
      for (const r of results) {
        quizContent += `- Q: ${r.question}\n  A: ${r.answer} (${r.responseTime.toFixed(1)}s) ${r.correct ? 'CORRECT' : 'WRONG'}\n`;
      }
      fs.appendFileSync(notePath, quizContent);
    }

    // Check if all correct
    if (correctCount === requiredCorrect) {
      quizPassed = true;

      // Update section progress for quiz - only when ALL correct
      if (relevantSections.length > 0) {
        for (const section of relevantSections) {
          updateSectionProgress(progress, moduleNumber, section.id, { quizPassed: true });
        }
      }

      // Summary - PASSED
      console.log('\n' + '='.repeat(55));
      console.log(`QUIZ PASSED! ${correctCount}/${requiredCorrect} correct | +${totalXP} XP`);

      const newAccuracy = getAccuracy(progress);
      console.log(`Accuracy: ${newAccuracy}%`);

      const avgTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      if (avgTime < 5) {
        console.log('PERFECT + LIGHTNING FAST! You really know this stuff!');
      } else {
        console.log('PERFECT! All questions correct!');
      }

      if (attempt > 1) {
        console.log(`Completed on attempt #${attempt}`);
      }

      console.log('='.repeat(55));
    } else {
      // Not all correct - retry
      console.log('\n' + '='.repeat(55));
      console.log(`RETRY NEEDED: ${correctCount}/${requiredCorrect} correct`);
      console.log(`You need ALL ${requiredCorrect} questions correct to pass.`);

      const newAccuracy = getAccuracy(progress);
      console.log(`Accuracy: ${newAccuracy}%`);

      // Show which questions were wrong
      const wrongQuestions = results.filter(r => !r.correct);
      if (wrongQuestions.length > 0) {
        console.log('\nMissed questions:');
        wrongQuestions.forEach((r, i) => {
          console.log(`   ${i + 1}. ${r.question}`);
        });
      }

      console.log('\nReview the material and try again!');
      console.log('='.repeat(55));

      // Wait for user to be ready to retry
      await waitForEnter('\nPress ENTER when ready to retry the quiz...\n');
    }
  }

  return requiredCorrect;
}

// Ask GPT about the transcript with homework focus
async function askGPT(transcript, videoTitle, relevantSections = []) {
  if (!OPENAI_API_KEY || !GPT_QUESTION) {
    console.log('Missing OPENAI_API_KEY or GPT_QUESTION in .env');
    return null;
  }

  console.log('Analyzing lecture for homework relevance...');

  const sectionsContext = relevantSections.length > 0
    ? `\n\nHOMEWORK SECTIONS THIS HELPS:\n${relevantSections.map(s => `- Section ${s.id}: ${s.title} (${s.points} pts)\n  ${s.description}`).join('\n')}`
    : '';

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Give a TIGHT summary. Max 5 bullet points.
Format:
- **Key thing**: one-liner explanation
- **Watch out**: common gotcha

End with "DO THIS:" - 2-3 action items max. No fluff. Be direct.`
        },
        {
          role: 'user',
          content: `Lecture: ${videoTitle}
${sectionsContext}
Projects: ${GPT_QUESTION}

${transcript.substring(0, 3000)}`
        }
      ],
      max_tokens: 600
    });

    const answer = response.choices[0].message.content;
    console.log('Analysis complete!\n');

    // Save to notes file
    const now = new Date();
    const timestamp = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`;
    const safeTitle = videoTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const notePath = path.join(NOTES_DIR, `${timestamp}_${safeTitle}.md`);
    const noteContent = `# ${videoTitle}\n\n## My Projects\n${GPT_QUESTION}\n\n## AI Insights\n${answer}\n\n## Full Transcript\n${transcript}`;
    fs.writeFileSync(notePath, noteContent);

    return { answer, notePath };
  } catch (e) {
    console.log(`Analysis failed: ${e.message}`);
    return null;
  }
}

// Display startup screen with homework mission
function displayStartupScreen(moduleNumber, sections, progress, videoMapping = null) {
  const hwProgress = getHomeworkProgress(progress, moduleNumber);
  const { streak, isNewDay, streakBroken } = updateStreak(progress);

  console.log('\n' + '='.repeat(55));
  console.log(`HOMEWORK MISSION: Module ${moduleNumber}`);
  console.log('='.repeat(55));

  // Streak display
  if (streakBroken) {
    console.log('\nStreak broken! Starting fresh at day 1.');
  } else if (isNewDay) {
    console.log(`\nStreak: ${streak} days! +${XP_REWARDS.STREAK_BONUS} XP bonus!`);
    addXP(progress, XP_REWARDS.STREAK_BONUS, 'streak bonus');
  } else {
    console.log(`\nStreak: ${streak} days`);
  }

  console.log(`Level ${progress.level} | ${progress.xp} XP`);

  // Deliverables
  console.log('\nYOUR DELIVERABLES:');
  for (const section of sections) {
    const status = hwProgress.sections[section.id];
    const check = status?.done ? 'X' : ' ';
    console.log(`   [${check}] Section ${section.id}: ${section.title} (${section.points} pts)`);
  }

  // Video recommendations
  if (videoMapping && videoMapping.mapping) {
    console.log('\nVIDEOS YOU NEED (AI-recommended):');
    let totalTime = 0;
    const shown = new Set();

    for (const section of sections) {
      const videos = videoMapping.mapping[section.id] || [];
      for (const video of videos) {
        if (!shown.has(video)) {
          shown.add(video);
          const timeMatch = video.match(/\((\d+):(\d+)\)/);
          if (timeMatch) {
            const mins = parseInt(timeMatch[1]);
            totalTime += mins;
          }
          console.log(`   - ${video} -> helps Section ${section.id}`);
        }
      }
    }

    if (totalTime > 0) {
      console.log(`\nTotal time: ~${Math.ceil(totalTime / 1.5)} min at 1.5x speed`);
    }

    if (videoMapping.skip && videoMapping.skip.length > 0) {
      console.log('\nSKIP these (not needed for homework):');
      for (const skip of videoMapping.skip.slice(0, 3)) {
        console.log(`   - ${skip}`);
      }
    }
  }

  const totalPoints = sections.reduce((sum, s) => sum + s.points, 0);
  console.log(`\nHomework worth: ${totalPoints} points`);
  console.log('='.repeat(55));
}

// Display quick mode startup
function displayQuickMode(progress, moduleNumber, sections) {
  const hwProgress = getHomeworkProgress(progress, moduleNumber);
  const { streak } = updateStreak(progress);

  console.log('\n' + '='.repeat(55));
  console.log('QUICK MODE (5 min)');
  console.log('='.repeat(55));
  console.log(`\nStreak: ${streak} days (don't break it!)`);

  const incomplete = sections.filter(s => !hwProgress.sections[s.id]?.videoWatched);
  console.log(`\nHomework Status: Module ${moduleNumber}`);
  console.log(`   ${incomplete.length} sections need videos still`);

  if (incomplete.length > 0) {
    console.log(`\nQuick win suggestion: Focus on Section ${incomplete[0].id}`);
  }

  console.log('='.repeat(55));
}

// Display status mode (no video watching)
function displayStatusMode(progress, moduleNumber, sections) {
  displayProgressDashboard(progress, moduleNumber);

  // Show accuracy stats
  displayAccuracyStats(progress);

  console.log('\nHOMEWORK SECTIONS DETAIL:');
  const hwProgress = getHomeworkProgress(progress, moduleNumber);

  for (const section of sections) {
    const status = hwProgress.sections[section.id] || {};
    console.log(`\nSection ${section.id}: ${section.title} (${section.points} pts)`);
    console.log(`   Video watched: ${status.videoWatched ? 'Yes' : 'No'}`);
    console.log(`   Quiz passed: ${status.quizPassed ? 'Yes' : 'No'}`);
    console.log(`   Started: ${status.started ? 'Yes' : 'No'}`);
    console.log(`   Done: ${status.done ? 'Yes' : 'No'}`);
  }

  console.log('\n' + '='.repeat(55));
  console.log('Run `npm start` to continue watching videos');
  console.log('Run `npm run quick` for a 5-minute session');
  console.log('='.repeat(55));
}

// Post-video action prompt - auto-mark as done, no questions
async function postVideoPrompt(videoTitle, relevantSections, progress, moduleNumber, sessionStats) {
  // Track video completion and add XP
  sessionStats.videosWatched++;
  sessionStats.xpEarned += XP_REWARDS.WATCH_VIDEO;
  addXP(progress, XP_REWARDS.WATCH_VIDEO, 'video complete');

  console.log('\n' + '='.repeat(55));
  console.log('VIDEO COMPLETE! Moving to next...');
  console.log('='.repeat(55));

  return true;
}

// Main function
async function openCanvas() {
  console.log('\nCanvas Learning Game - Homework First Edition');
  console.log('='.repeat(55));

  // Load progress
  const progress = loadProgress();
  const currentModule = moduleOverride || getCurrentModule();
  if (moduleOverride) {
    console.log(`Module override: targeting Module ${moduleOverride}`);
  }
  progress.currentModule = currentModule;

  // Parse homework
  const { sections, totalPoints, priorityOrder } = analyzeHomework(currentModule);

  // Initialize homework tracking
  if (sections.length > 0) {
    initHomeworkTracking(progress, currentModule, sections);
  }

  // Status mode - just show progress and exit
  if (MODE.STATUS) {
    displayStatusMode(progress, currentModule, sections);
    process.exit(0);
  }

  // Report mode - generate and show daily report
  if (MODE.REPORT) {
    const { report, filePath } = generateDailyReport(sessionStats);
    displayReport(report);
    console.log(`\nReport saved to: ${filePath}`);
    console.log('\nReminder message for your bot:');
    console.log('-'.repeat(55));
    console.log(generateReminderMessage());
    console.log('-'.repeat(55));
    process.exit(0);
  }

  // Quick mode startup
  if (MODE.QUICK) {
    displayQuickMode(progress, currentModule, sections);
  }

  // Get video mapping from AI (if homework exists)
  let videoMapping = null;

  // Display homework-first startup screen
  if (sections.length > 0 && !MODE.QUICK) {
    displayStartupScreen(currentModule, sections, progress, videoMapping);
  }

  // Launch browser
  console.log('\nLaunching browser...');
  let browser = null;
  let context;
  let page;

  if (CHROME_USER_DATA_DIR) {
    console.log(`Using Chrome profile: ${CHROME_PROFILE} from ${CHROME_USER_DATA_DIR}`);
    const userDataDir = CHROME_USER_DATA_DIR.replace(/^~/, process.env.HOME);
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: 'chrome',
      args: [`--profile-directory=${CHROME_PROFILE}`]
    });
    page = context.pages()[0] || await context.newPage();
  } else {
    browser = await chromium.launch({ headless: false });
    context = await browser.newContext();
    page = await context.newPage();
  }

  console.log(`Opening Canvas at: ${CANVAS_URL}`);
  await page.goto(CANVAS_URL);
  await page.waitForLoadState('networkidle');
  console.log('Page loaded!');

  // Handle login
  const currentUrl = page.url();
  if (currentUrl.includes('login') || currentUrl.includes('shibboleth') || currentUrl.includes('idp') || currentUrl.includes('weblogin')) {
    console.log('Login required...');

    if (!CANVAS_USERNAME || !CANVAS_PASSWORD) {
      console.error('CREDENTIALS MISSING! Set CANVAS_USERNAME and CANVAS_PASSWORD in .env.');
      process.exit(1);
    }

    const usernameField = page.locator('input[name="username"], input[name="j_username"], input[id="username"], input[type="text"][name*="user"], input[type="email"]');
    const passwordField = page.locator('input[name="password"], input[name="j_password"], input[id="password"], input[type="password"]');

    await usernameField.first().fill(CANVAS_USERNAME);
    console.log('Username entered');

    await passwordField.first().fill(CANVAS_PASSWORD);
    console.log('Password entered');

    const loginButton = page.locator('button[type="submit"], input[type="submit"], button:has-text("Log In"), button:has-text("Login"), button:has-text("Sign In"), button:has-text("Submit")');
    await loginButton.first().click();
    console.log('Logging in...');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Handle 2FA
    const newUrl = page.url();
    if (newUrl.includes('duo') || newUrl.includes('2fa') || newUrl.includes('mfa')) {
      console.log('2FA required...');

      await page.waitForTimeout(1000);
      try {
        await page.click('text=Other options');
        await page.waitForTimeout(1000);
        await page.click('text=Text message passcode');
        console.log('Check your phone for the code!');

        const passcodeInput = page.locator('input[name="passcode"], input[type="text"][inputmode="numeric"], input[placeholder*="code"]');
        if (await passcodeInput.count() > 0) {
          await passcodeInput.first().focus();
          await passcodeInput.first().click();
          console.log('Enter the code...');
        }
      } catch (e) {
        console.log(`2FA setup: ${e.message}`);
      }

      try {
        await page.waitForSelector('text=Yes, this is my device', { timeout: 300000 });
        await page.click('text=Yes, this is my device');
        console.log('Device confirmed!');
      } catch (e) {
        console.log(`Device confirmation: ${e.message}`);
      }

      await page.waitForURL(/canvas\.upenn\.edu/, { timeout: 60000 });
      console.log('2FA complete!');
    }

    await page.waitForLoadState('networkidle');
    console.log('Login successful!');
  }

  console.log('Canvas loaded!');

  // Navigate to course
  console.log(`Opening ${CANVAS_COURSE_NAME}...`);
  try {
    await page.click(`a:has-text("${CANVAS_COURSE_NAME}")`);
    await page.waitForLoadState('networkidle');
    console.log('Course opened!');
  } catch (e) {
    console.log(`Course navigation: ${e.message}`);
  }

  // Go to Modules
  await page.waitForTimeout(2000);
  try {
    await page.click('a:has-text("Modules")');
    await page.waitForLoadState('networkidle');
  } catch (e) {
    // Already on modules
  }

  // Optional week filter
  if (weekNumber) {
    console.log(`Targeting Week ${weekNumber}...`);
    try {
      await page.click(`a[title="Week ${weekNumber}"]`);
      await page.waitForLoadState('networkidle');
    } catch (e) {
      console.log(`Week ${weekNumber} not found, scanning all modules.`);
    }
  }

  // Determine which sections each video helps (based on module position and keywords)
  function findRelevantSections(videoTitle, sections) {
    const relevant = [];
    const lowerTitle = videoTitle.toLowerCase();

    for (const section of sections) {
      const keywords = section.title.toLowerCase().split(/\s+/);
      const descWords = section.description.toLowerCase().split(/\s+/);

      for (const word of [...keywords, ...descWords]) {
        if (word.length > 4 && lowerTitle.includes(word)) {
          if (!relevant.find(r => r.id === section.id)) {
            relevant.push(section);
          }
          break;
        }
      }
    }

    return relevant;
  }

  // ========== INFINITE VIDEO LOOP ==========
  while (true) {
    // Refresh done list and skip list each iteration
    const doneList = getDoneList();
    const skipList = getSkipList();

    // Go back to modules page
    console.log('\n' + '='.repeat(55));
    console.log(`Finding next video... | ${breakClock()}`);
    console.log(`Videos completed: ${doneList.length}`);
    console.log('='.repeat(55));

    // Click Modules link (we're already logged in)
    try {
      await page.click('a:has-text("Modules")');
      await page.waitForLoadState('networkidle');
    } catch (e) {
      // If that fails, try going back via browser
      await page.goBack();
      await page.waitForLoadState('networkidle');
      await page.click('a:has-text("Modules")');
      await page.waitForLoadState('networkidle');
    }

    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(2000);

  // Get all video items (filter out non-lecture content)
  const allVideos = await page.evaluate(() => {
    const moduleItems = document.querySelectorAll('li.context_module_item');
    const videos = [];

    // Skip these non-lecture items
    const skipPatterns = [
      /getting started/i,
      /how to get help/i,
      /how to submit/i,
      /office hours/i,
      /syllabus/i,
      /welcome to/i,
      /course overview/i,
      /^homework/i,
      /^assignment/i,
      /^quiz$/i,
      /^exam/i,
      /discussion/i,
      /piazza/i,
      /ed discussion/i,
      /gradescope/i,
      /colab/i,
      /notebook/i
    ];

    for (const item of moduleItems) {
      const link = item.querySelector('a.ig-title, a.title');
      if (!link || !link.href) continue;

      const title = link.title || link.textContent.trim();

      // Must have time format (X:XX) to be a video
      const hasTimeFormat = /\(\d+:\d+\)/.test(title);
      if (!hasTimeFormat) continue;

      // Skip non-lecture content
      const shouldSkip = skipPatterns.some(pattern => pattern.test(title));
      if (shouldSkip) continue;

      videos.push({ title, href: link.href });
    }
    return videos;
  });

    // Find first incomplete video
    // In QUICK mode, prefer shorter videos
    let incompleteItemData = null;

    if (MODE.QUICK) {
      // Sort by duration, pick shortest incomplete
      const incompleteVideos = allVideos.filter(v => !isVideoDone(v.title, doneList) && !isVideoSkipped(v.title, skipList));
      incompleteVideos.sort((a, b) => {
        const timeA = a.title.match(/\((\d+):(\d+)\)/) || [0, 99, 99];
        const timeB = b.title.match(/\((\d+):(\d+)\)/) || [0, 99, 99];
        return (parseInt(timeA[1]) * 60 + parseInt(timeA[2])) - (parseInt(timeB[1]) * 60 + parseInt(timeB[2]));
      });
      incompleteItemData = incompleteVideos[0];
    } else {
      incompleteItemData = allVideos.find(video => !isVideoDone(video.title, doneList) && !isVideoSkipped(video.title, skipList));
    }

    // --skip flag: skip the first incomplete video and move to next
    if (MODE.SKIP && incompleteItemData) {
      addToSkipList(incompleteItemData.title);
      console.log(`Skipped: ${incompleteItemData.title}`);
      continue;
    }

    if (!incompleteItemData) {
      console.log('\n' + '='.repeat(55));
      console.log('ALL VIDEOS COMPLETE! SEMESTER DONE!');
      console.log('='.repeat(55));
      displayProgressDashboard(progress, currentModule);

      // Generate final report
      const { filePath } = generateDailyReport(sessionStats);
      console.log(`\nFinal report saved: ${filePath}`);

      if (browser) await browser.close();
      else await context.close();
      process.exit(0);
    }

    // Find relevant sections for this video
    const relevantSections = findRelevantSections(incompleteItemData.title, sections);

    console.log(`\nTARGET: ${incompleteItemData.title}`);
    if (relevantSections.length > 0) {
      console.log(`Helps with: ${relevantSections.map(s => `Section ${s.id}`).join(', ')}`);
    }

    await page.goto(incompleteItemData.href);
    await page.waitForLoadState('networkidle');

    // Update progress - video started
    for (const section of relevantSections) {
      updateSectionProgress(progress, currentModule, section.id, { videoWatched: true });
    }

  // Extract transcript
  console.log('Looking for transcript...');
  let transcript = '';

  for (let attempt = 1; attempt <= 10; attempt++) {
    process.stdout.write(`\rChecking for transcript... ${attempt}/10`);

    try {
      const hasTranscript = await page.evaluate(() => {
        const summaries = document.querySelectorAll('summary');
        for (const summary of summaries) {
          if (summary.textContent.toLowerCase().includes('transcript')) {
            return true;
          }
        }
        return false;
      });

      if (hasTranscript) {
        console.log('\nTranscript found!');

        await page.evaluate(() => {
          const summaries = document.querySelectorAll('summary');
          for (const summary of summaries) {
            if (summary.textContent.toLowerCase().includes('transcript')) {
              summary.click();
              return;
            }
          }
        });
        await page.waitForTimeout(500);

        transcript = await page.evaluate(() => {
          const details = document.querySelectorAll('details');
          for (const detail of details) {
            const summary = detail.querySelector('summary');
            if (summary && summary.textContent.toLowerCase().includes('transcript')) {
              const clone = detail.cloneNode(true);
              const summaryInClone = clone.querySelector('summary');
              if (summaryInClone) summaryInClone.remove();
              return clone.textContent.trim();
            }
          }
          return '';
        });

        console.log(`Extracted ${transcript.length} characters`);
        break;
      }
    } catch (e) {
      // Silent fail
    }

    await page.waitForTimeout(1000);
  }

  // Process transcript with AI
  let notePath = null;
  let quizQuestions = null;

  if (transcript && transcript.length > 50) {
    console.log('\nAnalyzing lecture content...');
    console.log('='.repeat(55));

    const result = await askGPT(transcript, incompleteItemData.title, relevantSections);
    if (result && result.answer) {
      console.log('\n' + '='.repeat(55));
      console.log('KEY INSIGHTS:');
      console.log('='.repeat(55));
      console.log(result.answer);
      console.log('='.repeat(55));
      notePath = result.notePath;
    }

    // Generate 3 homework-focused questions
    quizQuestions = await generateQuiz(transcript, incompleteItemData.title, relevantSections);

    if (quizQuestions && quizQuestions.length > 0) {
      console.log('\n' + '='.repeat(55));
      console.log('FOCUS WHILE WATCHING:');
      console.log('='.repeat(55));
      quizQuestions.forEach((q, i) => {
        const questionText = q.text || q;
        console.log(`   ${i + 1}. ${questionText}`);
      });
      console.log('\nYou\'ll answer these Yes/No questions after the video.');
      console.log('ALL 3 must be correct to pass! (Mix of Yes and No answers)');
      console.log('='.repeat(55));
    }

    await waitForEnter('\nPress ENTER to start video...\n');
  }

  // Play video - bring window to front
  await page.bringToFront();
  console.log('Starting video...');
  await page.waitForTimeout(1000);

  const allFrames = page.frames();
  let panoptoFrame = null;
  let clicked = false;

  for (const frame of allFrames) {
    try {
      const playBtn = frame.locator('#playIconContainer, [aria-label="Play"]');
      const count = await playBtn.count().catch(() => 0);

      if (count > 0) {
        try {
          await playBtn.first().click({ force: true, timeout: 5000 });
          clicked = true;
          console.log('Video playing!');
          break;
        } catch (clickErr) {
          try {
            await frame.evaluate(() => {
              const btn = document.querySelector('#playIconContainer') || document.querySelector('[aria-label="Play"]');
              if (btn) btn.click();
            });
            clicked = true;
            console.log('Video playing!');
            break;
          } catch (jsErr) {
            // Silent
          }
        }
      }
    } catch (e) {
      // Silent
    }
  }

  for (const frame of allFrames) {
    if (frame.url().includes('panopto')) {
      panoptoFrame = frame;
      break;
    }
  }

  if (!clicked) {
    console.log('Using spacebar to play...');
    await page.keyboard.press('Space');
  }

  await page.waitForTimeout(3000);

  // Set playback speed to 1.5x
  console.log('Setting 1.5x speed...');
  let speedSet = false;

  // Try direct playbackRate first (most reliable)
  if (panoptoFrame) {
    try {
      speedSet = await panoptoFrame.evaluate(() => {
        const v = document.querySelector('video');
        if (v) { v.playbackRate = 1.5; return true; }
        return false;
      });
      if (speedSet) console.log('1.5x speed set via playbackRate!');
    } catch (e) {
      // Fall through to UI method
    }
  }

  // Fallback: use UI controls
  if (!speedSet && panoptoFrame) {
    try {
      await panoptoFrame.evaluate(() => {
        const btn = document.querySelector('[aria-label="Settings"]') || document.querySelector('.settings-button');
        if (btn) btn.click();
      });
      await page.waitForTimeout(1000);

      await panoptoFrame.evaluate(() => {
        const speedOptions = document.querySelectorAll('[data-speed], .speed-option, button');
        for (const opt of speedOptions) {
          if (opt.textContent.includes('1.5')) {
            opt.click();
            return;
          }
        }
      });
      console.log('1.5x speed set via UI!');
    } catch (e) {
      // Silent
    }
  }

  // Enter fullscreen
  await page.waitForTimeout(500);
  if (panoptoFrame) {
    try {
      await panoptoFrame.evaluate(() => {
        const selectors = [
          '[aria-label="Fullscreen"]',
          '[aria-label="Enter fullscreen"]',
          '[aria-label="Full screen"]',
          '#fullScreenButton'
        ];
        for (const sel of selectors) {
          const btn = document.querySelector(sel);
          if (btn) {
            btn.click();
            return;
          }
        }
      });
    } catch (e) {
      // Silent
    }
  }

  // Parse video duration
  let videoTimeoutMs = 0;
  const timeMatch = incompleteItemData.title.match(/\((\d+):(\d+)\)/);
  if (timeMatch) {
    const minutes = parseInt(timeMatch[1]);
    const seconds = parseInt(timeMatch[2]);
    const totalSeconds = (minutes * 60 + seconds + 30) / 1.5;
    videoTimeoutMs = totalSeconds * 1000;
    console.log(`\nDuration: ${minutes}:${seconds.toString().padStart(2, '0')} (~${Math.ceil(totalSeconds / 60)} min at 1.5x)`);
  }

  // Wait for video to end
  console.log('Watch the video. Press ENTER when done.\n');

  let videoEnded = false;
  const startTime = Date.now();

  let userPressedEnter = false;
  const videoRl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  videoRl.on('line', () => {
    userPressedEnter = true;
  });

  while (!videoEnded && !userPressedEnter) {
    let videoFrame = null;
    for (const frame of page.frames()) {
      try {
        if (frame.url().includes('panopto')) {
          videoFrame = frame;
          break;
        }
      } catch (e) {
        // Frame detached
      }
    }

    let videoStatus = { ended: false, currentTime: 0, duration: 0 };

    try {
      if (videoFrame) {
        videoStatus = await videoFrame.evaluate(() => {
          const video = document.querySelector('video');
          if (video) {
            return {
              ended: video.ended || (video.duration > 0 && video.currentTime >= video.duration - 1),
              currentTime: video.currentTime || 0,
              duration: video.duration || 0
            };
          }
          return { ended: false, currentTime: 0, duration: 0 };
        }).catch(() => ({ ended: false, currentTime: 0, duration: 0 }));
      }

      if (videoStatus.duration === 0) {
        for (const frame of page.frames()) {
          try {
            const status = await frame.evaluate(() => {
              const video = document.querySelector('video');
              if (video && video.duration > 0) {
                return {
                  ended: video.ended || video.currentTime >= video.duration - 1,
                  currentTime: video.currentTime,
                  duration: video.duration
                };
              }
              return null;
            }).catch(() => null);

            if (status && status.duration > 0) {
              videoStatus = status;
              break;
            }
          } catch (e) {
            // Skip
          }
        }
      }
    } catch (e) {
      // Silent
    }

    if (videoStatus.ended) {
      videoEnded = true;
      break;
    }

    if (videoStatus.duration > 0) {
      const remainingSeconds = Math.max(0, Math.ceil(videoStatus.duration - videoStatus.currentTime));
      const remainingMin = Math.floor(remainingSeconds / 60);
      const remainingSec = remainingSeconds % 60;
      const currentMin = Math.floor(videoStatus.currentTime / 60);
      const currentSec = Math.floor(videoStatus.currentTime % 60);
      const totalMin = Math.floor(videoStatus.duration / 60);
      const totalSec = Math.floor(videoStatus.duration % 60);

      const progress2 = Math.min(20, Math.floor((videoStatus.currentTime / videoStatus.duration) * 20));
      const progressBar = '#'.repeat(progress2) + '-'.repeat(20 - progress2);
      process.stdout.write(`\r[${progressBar}] ${currentMin}:${currentSec.toString().padStart(2, '0')} / ${totalMin}:${totalSec.toString().padStart(2, '0')} | ${remainingMin}:${remainingSec.toString().padStart(2, '0')} left    `);
    }

    if (videoTimeoutMs > 0 && (Date.now() - startTime) > videoTimeoutMs) {
      console.log('\nTime limit reached!');
      break;
    }

    await page.waitForTimeout(1000);
  }

  videoRl.close();

  if (userPressedEnter) {
    console.log('\n\nMoving to quiz!');
  } else {
    console.log('\n\nVideo complete!');
  }
  console.log(breakClock());

  // Exit fullscreen
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);

  // Run quiz (3 questions, all must be correct)
  if (quizQuestions && quizQuestions.length > 0) {
    await runQuiz(quizQuestions, notePath, transcript, incompleteItemData.title, progress, currentModule, relevantSections, sessionStats);
  }

  // Post-video action prompt
  await postVideoPrompt(incompleteItemData.title, relevantSections, progress, currentModule, sessionStats);

    // Click "Mark as done" button on Canvas
    try {
      const markDoneBtn = page.locator('button:has-text("Mark as done"), button:has-text("Mark as Done"), .mark-done-btn, [data-testid="mark-done-button"]');
      if (await markDoneBtn.count() > 0) {
        await markDoneBtn.first().click();
        console.log('Clicked "Mark as done" on Canvas');
        await page.waitForTimeout(500);
      }
    } catch (e) {
      // Button may not exist or already marked
    }

    // Mark as done in local list
    if (incompleteItemData && incompleteItemData.title) {
      markAsDone(incompleteItemData.title);
    }

    // Quick stats then continue to next video
    console.log('\n' + '='.repeat(55));
    console.log(`Session: ${sessionStats.videosWatched} videos | +${sessionStats.xpEarned} XP | ${breakClock()}`);
    console.log('='.repeat(55));

    // Check if break is needed
    if (needsBreak()) {
      await forceBreak(BREAK_SETTINGS.BREAK_DURATION);
    }

    console.log('Loading next video...');

    // Brief pause before next video
    await page.waitForTimeout(1000);

  } // End of while(true) loop
}

openCanvas().catch((e) => {
  console.error(`\nError: ${e.message}`);
  console.error('Fix the issue and try again.');
});
