import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROGRESS_FILE = path.join(__dirname, '..', 'progress.json');

// XP rewards
const XP_REWARDS = {
  WATCH_VIDEO: 50,
  QUIZ_CORRECT: 25,
  QUIZ_FAST_BONUS: 15,    // Answer within 5 seconds
  QUIZ_MEDIUM_BONUS: 5,   // Answer within 10 seconds
  SECTION_STARTED: 50,
  SECTION_DONE: 200,
  HOMEWORK_COMPLETE: 500,
  STREAK_BONUS: 25,
  SKIP_NONESSENTIAL: 10
};

// Quiz settings
const QUIZ_SETTINGS = {
  TIME_LIMIT: 30,         // Seconds per question (30s is reasonable)
  FAST_THRESHOLD: 8,      // Seconds for fast bonus
  MEDIUM_THRESHOLD: 15    // Seconds for medium bonus
};

// Achievements definitions
const ACHIEVEMENTS = {
  FIRST_SECTION: { id: 'first_section', name: 'First Section', desc: 'Complete 1 homework section', check: (p) => p.stats.sectionsCompleted >= 1 },
  FULL_MARKS: { id: 'full_marks', name: 'Full Marks', desc: 'Get 100% on a homework', check: (p) => p.stats.perfectHomeworks >= 1 },
  SPEED_RUNNER: { id: 'speed_runner', name: 'Speed Runner', desc: 'Finish homework in <2 hours total', check: (p) => p.stats.fastCompletions >= 1 },
  EFFICIENT: { id: 'efficient', name: 'Efficient Learner', desc: 'Skip 3+ non-essential videos', check: (p) => p.stats.videosSkipped >= 3 },
  STREAK_3: { id: 'streak_3', name: 'On Fire', desc: 'Maintain a 3-day streak', check: (p) => p.maxStreak >= 3 },
  STREAK_7: { id: 'streak_7', name: 'Unstoppable', desc: 'Maintain a 7-day streak', check: (p) => p.maxStreak >= 7 },
  LEVEL_5: { id: 'level_5', name: 'Scholar', desc: 'Reach level 5', check: (p) => p.level >= 5 },
  QUICK_DRAW: { id: 'quick_draw', name: 'Quick Draw', desc: 'Answer 10 questions in under 5 seconds', check: (p) => p.stats.fastAnswers >= 10 },
  SHARPSHOOTER: { id: 'sharpshooter', name: 'Sharpshooter', desc: 'Maintain 80%+ accuracy over 20 questions', check: (p) => p.stats.questionsAnswered >= 20 && (p.stats.questionsCorrect / p.stats.questionsAnswered) >= 0.8 },
  NEVER_TIMEOUT: { id: 'never_timeout', name: 'Never Timeout', desc: 'Answer 20 questions without any timeouts', check: (p) => p.stats.questionsAnswered >= 20 && p.stats.timeouts === 0 }
};

/**
 * Get default progress structure
 */
function getDefaultProgress() {
  return {
    xp: 0,
    level: 1,
    streak: 0,
    maxStreak: 0,
    lastActiveDate: null,
    currentModule: 1,
    homework: {},
    achievements: [],
    stats: {
      videosWatched: 0,
      quizzesPassed: 0,
      questionsAnswered: 0,
      questionsCorrect: 0,
      fastAnswers: 0,
      timeouts: 0,
      sectionsCompleted: 0,
      homeworksCompleted: 0,
      perfectHomeworks: 0,
      fastCompletions: 0,
      videosSkipped: 0,
      totalTimeSpent: 0
    }
  };
}

/**
 * Load progress from file
 * @returns {Object} Progress object
 */
export function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const content = fs.readFileSync(PROGRESS_FILE, 'utf-8');
      const progress = JSON.parse(content);
      // Merge with defaults to ensure all fields exist
      return { ...getDefaultProgress(), ...progress };
    }
  } catch (e) {
    console.log(`Warning: Could not load progress.json: ${e.message}`);
  }
  return getDefaultProgress();
}

/**
 * Save progress to file
 * @param {Object} progress - Progress object to save
 */
export function saveProgress(progress) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (e) {
    console.log(`Warning: Could not save progress.json: ${e.message}`);
  }
}

/**
 * Calculate level from XP (level = 1 + floor(xp/500))
 * @param {number} xp - Current XP
 * @returns {number} Level
 */
export function calculateLevel(xp) {
  return 1 + Math.floor(xp / 500);
}

/**
 * Get XP needed for next level
 * @param {number} currentXp - Current XP
 * @returns {number} XP needed
 */
export function xpToNextLevel(currentXp) {
  const currentLevel = calculateLevel(currentXp);
  const nextLevelXp = currentLevel * 500;
  return nextLevelXp - currentXp;
}

/**
 * Add XP and update level
 * @param {Object} progress - Progress object
 * @param {number} amount - XP to add
 * @param {string} reason - Reason for XP (for display)
 * @returns {Object} {newXp, levelUp, newLevel}
 */
export function addXP(progress, amount, reason = '') {
  const oldLevel = progress.level;
  progress.xp += amount;
  progress.level = calculateLevel(progress.xp);
  const levelUp = progress.level > oldLevel;

  if (reason) {
    console.log(`+${amount} XP${reason ? ` (${reason})` : ''}`);
  }

  if (levelUp) {
    console.log(`\nLEVEL UP! You are now Level ${progress.level}!`);
  }

  saveProgress(progress);
  return { newXp: progress.xp, levelUp, newLevel: progress.level };
}

/**
 * Update streak based on activity
 * @param {Object} progress - Progress object
 * @returns {Object} {streak, isNewDay, streakBroken}
 */
export function updateStreak(progress) {
  const today = new Date().toISOString().split('T')[0];
  const lastActive = progress.lastActiveDate;

  let streakBroken = false;
  let isNewDay = false;

  if (!lastActive) {
    // First time
    progress.streak = 1;
    isNewDay = true;
  } else if (lastActive === today) {
    // Same day, no change
  } else {
    const lastDate = new Date(lastActive);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Consecutive day
      progress.streak += 1;
      isNewDay = true;
    } else if (diffDays > 1) {
      // Streak broken
      streakBroken = true;
      progress.streak = 1;
      isNewDay = true;
    }
  }

  progress.lastActiveDate = today;
  if (progress.streak > progress.maxStreak) {
    progress.maxStreak = progress.streak;
  }

  saveProgress(progress);
  return { streak: progress.streak, isNewDay, streakBroken };
}

/**
 * Initialize homework tracking for a module
 * @param {Object} progress - Progress object
 * @param {number} moduleNumber - Module number
 * @param {Array} sections - Parsed homework sections
 */
export function initHomeworkTracking(progress, moduleNumber, sections) {
  const key = `module_${moduleNumber}`;

  if (!progress.homework[key]) {
    progress.homework[key] = {
      sections: {},
      totalPoints: 0,
      earnedPoints: 0,
      startedAt: null,
      completedAt: null
    };
  }

  // Add any new sections and update points for existing ones
  for (const section of sections) {
    if (!progress.homework[key].sections[section.id]) {
      progress.homework[key].sections[section.id] = {
        videoWatched: false,
        quizPassed: false,
        started: false,
        done: false,
        points: section.points
      };
    } else {
      // Update points in case homework was re-parsed with corrections
      progress.homework[key].sections[section.id].points = section.points;
    }
  }

  progress.homework[key].totalPoints = sections.reduce((sum, s) => sum + s.points, 0);
  progress.currentModule = moduleNumber;

  saveProgress(progress);
}

/**
 * Update section progress
 * @param {Object} progress - Progress object
 * @param {number} moduleNumber - Module number
 * @param {string} sectionId - Section ID (e.g., "1.5")
 * @param {Object} updates - {videoWatched, quizPassed, started, done}
 * @returns {Object} XP earned and celebration info
 */
export function updateSectionProgress(progress, moduleNumber, sectionId, updates) {
  const key = `module_${moduleNumber}`;
  const hw = progress.homework[key];

  if (!hw || !hw.sections[sectionId]) {
    return { xpEarned: 0 };
  }

  const section = hw.sections[sectionId];
  let xpEarned = 0;
  let celebration = null;

  // Track what changed
  if (updates.videoWatched && !section.videoWatched) {
    section.videoWatched = true;
    xpEarned += XP_REWARDS.WATCH_VIDEO;
    progress.stats.videosWatched++;
  }

  if (updates.quizPassed && !section.quizPassed) {
    section.quizPassed = true;
    xpEarned += XP_REWARDS.QUIZ_CORRECT;
    progress.stats.quizzesPassed++;
  }

  if (updates.started && !section.started) {
    section.started = true;
    xpEarned += XP_REWARDS.SECTION_STARTED;
    if (!hw.startedAt) {
      hw.startedAt = new Date().toISOString();
    }
  }

  if (updates.done && !section.done) {
    section.done = true;
    xpEarned += XP_REWARDS.SECTION_DONE;
    progress.stats.sectionsCompleted++;
    celebration = 'section';

    // Check if all sections are done
    const allDone = Object.values(hw.sections).every(s => s.done);
    if (allDone) {
      hw.completedAt = new Date().toISOString();
      xpEarned += XP_REWARDS.HOMEWORK_COMPLETE;
      progress.stats.homeworksCompleted++;
      celebration = 'homework';

      // Check for fast completion
      if (hw.startedAt) {
        const elapsed = new Date() - new Date(hw.startedAt);
        if (elapsed < 2 * 60 * 60 * 1000) { // Less than 2 hours
          progress.stats.fastCompletions++;
        }
      }
    }
  }

  if (xpEarned > 0) {
    addXP(progress, xpEarned);
  }

  // Check achievements
  checkAchievements(progress);

  saveProgress(progress);
  return { xpEarned, celebration };
}

/**
 * Check and award new achievements
 * @param {Object} progress - Progress object
 */
export function checkAchievements(progress) {
  for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
    if (!progress.achievements.includes(id) && achievement.check(progress)) {
      progress.achievements.push(id);
      console.log(`\nACHIEVEMENT UNLOCKED: ${achievement.name}!`);
      console.log(`   ${achievement.desc}`);
    }
  }
  saveProgress(progress);
}

/**
 * Get homework progress summary for a module
 * @param {Object} progress - Progress object
 * @param {number} moduleNumber - Module number
 * @returns {Object} Progress summary
 */
export function getHomeworkProgress(progress, moduleNumber) {
  const key = `module_${moduleNumber}`;
  const hw = progress.homework[key];

  if (!hw) {
    return {
      sections: {},
      completedCount: 0,
      totalCount: 0,
      percentComplete: 0,
      earnedPoints: 0,
      totalPoints: 0
    };
  }

  const sections = hw.sections;
  const completed = Object.values(sections).filter(s => s.done).length;
  const total = Object.keys(sections).length;
  const earned = Object.values(sections)
    .filter(s => s.done)
    .reduce((sum, s) => sum + (s.points || 0), 0);

  return {
    sections,
    completedCount: completed,
    totalCount: total,
    percentComplete: total > 0 ? Math.round((completed / total) * 100) : 0,
    earnedPoints: earned,
    totalPoints: hw.totalPoints
  };
}

/**
 * Display progress dashboard
 * @param {Object} progress - Progress object
 * @param {number} moduleNumber - Current module number
 */
export function displayProgressDashboard(progress, moduleNumber) {
  const hwProgress = getHomeworkProgress(progress, moduleNumber);

  console.log('\n' + '='.repeat(55));
  console.log('PROGRESS DASHBOARD');
  console.log('='.repeat(55));

  // Stats bar
  console.log(`\nLevel ${progress.level} | ${progress.xp} XP | Streak: ${progress.streak} days`);
  console.log(`XP to next level: ${xpToNextLevel(progress.xp)}`);

  // Homework progress
  console.log(`\nHOMEWORK TRACKER - Module ${moduleNumber}`);
  console.log('-'.repeat(55));

  for (const [sectionId, status] of Object.entries(hwProgress.sections)) {
    const readiness = calculateReadiness(status);
    const bar = createProgressBar(readiness, 10);
    const checks = [
      status.videoWatched ? 'V' : ' ',
      status.quizPassed ? 'Q' : ' ',
      status.started ? 'S' : ' ',
      status.done ? 'D' : ' '
    ].join('');
    console.log(`Section ${sectionId}: ${bar} ${readiness}% [${checks}]`);
  }

  console.log(`\nProgress: ${hwProgress.completedCount}/${hwProgress.totalCount} sections (${hwProgress.percentComplete}%)`);
  console.log(`Points: ${hwProgress.earnedPoints}/${hwProgress.totalPoints} secured`);

  // Achievements
  if (progress.achievements.length > 0) {
    console.log(`\nAchievements: ${progress.achievements.map(a => ACHIEVEMENTS[a]?.name || a).join(', ')}`);
  }

  console.log('='.repeat(55));
}

/**
 * Calculate section readiness percentage
 * @param {Object} status - Section status
 * @returns {number} Readiness percentage
 */
function calculateReadiness(status) {
  let score = 0;
  if (status.videoWatched) score += 30;
  if (status.quizPassed) score += 30;
  if (status.started) score += 20;
  if (status.done) score += 20;
  return score;
}

/**
 * Create ASCII progress bar
 * @param {number} percent - Percentage (0-100)
 * @param {number} width - Bar width
 * @returns {string} Progress bar string
 */
function createProgressBar(percent, width = 10) {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '[' + '#'.repeat(filled) + '-'.repeat(empty) + ']';
}

/**
 * Display celebration for completing a section
 * @param {string} sectionId - Section ID
 * @param {number} xpEarned - XP earned
 * @param {Object} hwProgress - Homework progress
 */
export function celebrateSection(sectionId, xpEarned, hwProgress) {
  console.log('\n' + '='.repeat(55));
  console.log(`SECTION ${sectionId} COMPLETE!`);
  console.log('='.repeat(55));
  console.log(`+${xpEarned} XP earned!`);
  console.log(`Homework Progress: ${hwProgress.completedCount}/${hwProgress.totalCount} sections done (${hwProgress.percentComplete}%)`);

  if (hwProgress.completedCount < hwProgress.totalCount) {
    const remaining = hwProgress.totalCount - hwProgress.completedCount;
    console.log(`\nOnly ${remaining} section${remaining > 1 ? 's' : ''} left! Keep going!`);
  }
  console.log('='.repeat(55));
}

/**
 * Display celebration for completing homework
 * @param {number} moduleNumber - Module number
 * @param {Object} progress - Progress object
 */
export function celebrateHomework(moduleNumber, progress) {
  const hwProgress = getHomeworkProgress(progress, moduleNumber);

  console.log('\n' + '*'.repeat(55));
  console.log('*' + ' '.repeat(53) + '*');
  console.log('*   HOMEWORK COMPLETE! MODULE ' + moduleNumber + ' CONQUERED!   *');
  console.log('*' + ' '.repeat(53) + '*');
  console.log('*'.repeat(55));
  console.log(`\nTotal XP earned: ${progress.xp}`);
  console.log(`Points secured: ${hwProgress.earnedPoints}/${hwProgress.totalPoints}`);
  console.log(`Level: ${progress.level}`);
  console.log(`Homeworks completed: ${progress.stats.homeworksCompleted}`);

  if (hwProgress.earnedPoints === hwProgress.totalPoints) {
    console.log('\nPERFECT SCORE! You got all the points!');
  }

  console.log('\n' + '*'.repeat(55));
}

/**
 * Get quiz accuracy percentage
 * @param {Object} progress - Progress object
 * @returns {number} Accuracy percentage (0-100)
 */
export function getAccuracy(progress) {
  const { questionsAnswered, questionsCorrect } = progress.stats;
  if (questionsAnswered === 0) return 0;
  return Math.round((questionsCorrect / questionsAnswered) * 100);
}

/**
 * Record a quiz answer
 * @param {Object} progress - Progress object
 * @param {boolean} correct - Whether answer was correct
 * @param {number} responseTime - Time taken to answer in seconds
 * @param {boolean} timedOut - Whether the question timed out
 * @returns {Object} {xpEarned, speedBonus}
 */
export function recordQuizAnswer(progress, correct, responseTime, timedOut = false) {
  progress.stats.questionsAnswered++;
  let xpEarned = 0;
  let speedBonus = 0;

  if (timedOut) {
    progress.stats.timeouts++;
    console.log('TIME OUT! No points this round.');
  } else if (correct) {
    progress.stats.questionsCorrect++;
    xpEarned = XP_REWARDS.QUIZ_CORRECT;

    if (responseTime <= QUIZ_SETTINGS.FAST_THRESHOLD) {
      speedBonus = XP_REWARDS.QUIZ_FAST_BONUS;
      progress.stats.fastAnswers++;
      console.log(`FAST! +${XP_REWARDS.QUIZ_CORRECT} XP +${speedBonus} speed bonus!`);
    } else if (responseTime <= QUIZ_SETTINGS.MEDIUM_THRESHOLD) {
      speedBonus = XP_REWARDS.QUIZ_MEDIUM_BONUS;
      console.log(`Good speed! +${XP_REWARDS.QUIZ_CORRECT} XP +${speedBonus} bonus`);
    } else {
      console.log(`+${XP_REWARDS.QUIZ_CORRECT} XP`);
    }

    xpEarned += speedBonus;
    addXP(progress, xpEarned);
  }

  saveProgress(progress);
  return { xpEarned, speedBonus };
}

/**
 * Display accuracy stats
 * @param {Object} progress - Progress object
 */
export function displayAccuracyStats(progress) {
  const accuracy = getAccuracy(progress);
  const { questionsAnswered, questionsCorrect, fastAnswers, timeouts } = progress.stats;

  console.log('\nQUIZ STATS:');
  console.log(`   Accuracy: ${accuracy}% (${questionsCorrect}/${questionsAnswered})`);
  console.log(`   Fast answers: ${fastAnswers}`);
  console.log(`   Timeouts: ${timeouts}`);

  // Performance feedback
  if (questionsAnswered >= 5) {
    if (accuracy >= 90) {
      console.log('   Rating: CRUSHING IT! Questions might be too easy...');
    } else if (accuracy >= 70) {
      console.log('   Rating: Solid performance!');
    } else if (accuracy >= 50) {
      console.log('   Rating: Keep grinding!');
    } else {
      console.log('   Rating: Rewatch those videos!');
    }
  }
}

export { XP_REWARDS, ACHIEVEMENTS, QUIZ_SETTINGS };
