import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadProgress, getHomeworkProgress, getAccuracy } from './progress.js';
import { parseHomework } from './homework-analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORTS_DIR = path.join(__dirname, '..', 'reports');

// Create reports directory if it doesn't exist
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

/**
 * Generate a daily learning report
 * @param {Object} sessionStats - Stats from this session
 * @returns {Object} {report, filePath}
 */
export function generateDailyReport(sessionStats = {}) {
  const progress = loadProgress();
  const moduleNumber = progress.currentModule;
  const sections = parseHomework(moduleNumber);
  const hwProgress = getHomeworkProgress(progress, moduleNumber);
  const accuracy = getAccuracy(progress);

  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const timeStr = today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // Calculate session stats
  const videosToday = sessionStats.videosWatched || 0;
  const questionsToday = sessionStats.questionsAnswered || 0;
  const correctToday = sessionStats.questionsCorrect || 0;
  const xpToday = sessionStats.xpEarned || 0;
  const sectionsStarted = sessionStats.sectionsStarted || 0;
  const sectionsCompleted = sessionStats.sectionsCompleted || 0;

  // Homework status
  const incompleteSections = sections.filter(s => !hwProgress.sections[s.id]?.done);
  const sectionsNeedingVideos = sections.filter(s => !hwProgress.sections[s.id]?.videoWatched);

  // Build the report
  let report = '';

  // Header
  report += `# Daily Learning Report\n`;
  report += `Date: ${dateStr} ${timeStr}\n\n`;

  // Streak & XP
  report += `## Status\n`;
  report += `- Streak: ${progress.streak} days\n`;
  report += `- Level: ${progress.level} (${progress.xp} XP total)\n`;
  report += `- Quiz Accuracy: ${accuracy}%\n\n`;

  // Today's Session
  report += `## Today's Session\n`;
  if (videosToday > 0 || questionsToday > 0 || xpToday > 0) {
    report += `- Videos watched: ${videosToday}\n`;
    report += `- Questions answered: ${questionsToday} (${correctToday} correct)\n`;
    report += `- XP earned: +${xpToday}\n`;
    if (sectionsStarted > 0) report += `- Sections started: ${sectionsStarted}\n`;
    if (sectionsCompleted > 0) report += `- Sections completed: ${sectionsCompleted}\n`;
  } else {
    report += `- No learning activity recorded yet today.\n`;
  }
  report += `\n`;

  // Homework Progress
  report += `## Homework: Module ${moduleNumber}\n`;
  report += `- Progress: ${hwProgress.completedCount}/${hwProgress.totalCount} sections (${hwProgress.percentComplete}%)\n`;
  report += `- Points: ${hwProgress.earnedPoints}/${hwProgress.totalPoints}\n\n`;

  if (incompleteSections.length > 0) {
    report += `### Remaining Sections\n`;
    for (const section of incompleteSections) {
      const status = hwProgress.sections[section.id] || {};
      const videoStatus = status.videoWatched ? 'video done' : 'need video';
      const quizStatus = status.quizPassed ? 'quiz passed' : 'quiz pending';
      report += `- Section ${section.id}: ${section.title} (${section.points} pts) [${videoStatus}, ${quizStatus}]\n`;
    }
    report += `\n`;
  }

  // Recommendations
  report += `## What to Do Next\n`;

  if (sectionsNeedingVideos.length > 0) {
    const nextVideo = sectionsNeedingVideos[0];
    report += `1. Watch video for Section ${nextVideo.id}: ${nextVideo.title}\n`;
  }

  const sectionsReadyToStart = sections.filter(s => {
    const status = hwProgress.sections[s.id];
    return status?.videoWatched && status?.quizPassed && !status?.started;
  });

  if (sectionsReadyToStart.length > 0) {
    report += `2. Start working on Section ${sectionsReadyToStart[0].id} (video + quiz done!)\n`;
  }

  const sectionsInProgress = sections.filter(s => {
    const status = hwProgress.sections[s.id];
    return status?.started && !status?.done;
  });

  if (sectionsInProgress.length > 0) {
    report += `3. Finish Section ${sectionsInProgress[0].id} (already started)\n`;
  }

  if (progress.streak > 0) {
    report += `\nKeep the ${progress.streak}-day streak alive!\n`;
  }

  // Bot-friendly summary (for parsing)
  report += `\n---\n`;
  report += `## Bot Summary\n`;
  report += `STREAK=${progress.streak}\n`;
  report += `LEVEL=${progress.level}\n`;
  report += `XP=${progress.xp}\n`;
  report += `ACCURACY=${accuracy}\n`;
  report += `MODULE=${moduleNumber}\n`;
  report += `HW_PROGRESS=${hwProgress.percentComplete}\n`;
  report += `SECTIONS_LEFT=${incompleteSections.length}\n`;
  report += `VIDEOS_NEEDED=${sectionsNeedingVideos.length}\n`;

  // Save to file
  const fileName = `report_${dateStr}.md`;
  const filePath = path.join(REPORTS_DIR, fileName);
  fs.writeFileSync(filePath, report);

  // Also save as latest.md for easy access
  const latestPath = path.join(REPORTS_DIR, 'latest.md');
  fs.writeFileSync(latestPath, report);

  return { report, filePath };
}

/**
 * Generate a compact reminder message for bots
 * @returns {string} Compact reminder text
 */
export function generateReminderMessage() {
  const progress = loadProgress();
  const moduleNumber = progress.currentModule;
  const sections = parseHomework(moduleNumber);
  const hwProgress = getHomeworkProgress(progress, moduleNumber);
  const accuracy = getAccuracy(progress);

  const incompleteSections = sections.filter(s => !hwProgress.sections[s.id]?.done);
  const sectionsNeedingVideos = sections.filter(s => !hwProgress.sections[s.id]?.videoWatched);

  let msg = '';

  // Streak warning
  if (progress.streak > 0) {
    msg += `Your ${progress.streak}-day streak is on the line! `;
  }

  // Progress summary
  msg += `Module ${moduleNumber}: ${hwProgress.percentComplete}% done (${hwProgress.completedCount}/${hwProgress.totalCount} sections). `;

  // What's next
  if (sectionsNeedingVideos.length > 0) {
    msg += `Watch ${sectionsNeedingVideos.length} more video(s). `;
  }

  if (incompleteSections.length > 0) {
    const nextSection = incompleteSections[0];
    msg += `Next up: Section ${nextSection.id} (${nextSection.points} pts). `;
  }

  // Motivation based on accuracy
  if (accuracy >= 80) {
    msg += `Quiz accuracy: ${accuracy}% - you're crushing it!`;
  } else if (accuracy >= 60) {
    msg += `Quiz accuracy: ${accuracy}% - solid, keep it up!`;
  } else if (accuracy > 0) {
    msg += `Quiz accuracy: ${accuracy}% - review the material!`;
  }

  return msg.trim();
}

/**
 * Display the report in console
 * @param {string} report - The report content
 */
export function displayReport(report) {
  console.log('\n' + '='.repeat(55));
  console.log('DAILY LEARNING REPORT');
  console.log('='.repeat(55));
  console.log(report);
  console.log('='.repeat(55));
}

/**
 * Get today's report if it exists
 * @returns {string|null} Report content or null
 */
export function getTodayReport() {
  const today = new Date().toISOString().split('T')[0];
  const filePath = path.join(REPORTS_DIR, `report_${today}.md`);

  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return null;
}

/**
 * Append session stats to today's report
 * @param {Object} sessionStats - Stats to append
 */
export function appendToTodayReport(sessionStats) {
  const today = new Date().toISOString().split('T')[0];
  const filePath = path.join(REPORTS_DIR, `report_${today}.md`);

  let existingReport = '';
  if (fs.existsSync(filePath)) {
    existingReport = fs.readFileSync(filePath, 'utf-8');
  }

  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const sessionEntry = `
### Session at ${timeStr}
- Videos: ${sessionStats.videosWatched || 0}
- Questions: ${sessionStats.questionsAnswered || 0} (${sessionStats.questionsCorrect || 0} correct)
- XP: +${sessionStats.xpEarned || 0}
`;

  // Insert before Bot Summary section
  if (existingReport.includes('## Bot Summary')) {
    existingReport = existingReport.replace('## Bot Summary', sessionEntry + '\n## Bot Summary');
  } else {
    existingReport += sessionEntry;
  }

  fs.writeFileSync(filePath, existingReport);

  // Regenerate the report with updated totals
  generateDailyReport(sessionStats);
}
