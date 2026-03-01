import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HOMEWORK_DIR = path.join(__dirname, '..', 'homework');

/**
 * Parse homework file and extract sections with points
 * @param {number} moduleNumber - The module number
 * @returns {Array} Array of section objects {id, title, points, description}
 */
export function parseHomework(moduleNumber) {
  const homeworkFile = path.join(HOMEWORK_DIR, `module_${moduleNumber}.txt`);

  if (!fs.existsSync(homeworkFile)) {
    return [];
  }

  const content = fs.readFileSync(homeworkFile, 'utf-8');

  // Skip template files
  if (content.includes('Paste your homework content here') && content.length < 300) {
    return [];
  }

  const sections = [];
  const lines = content.split('\n');

  // Pattern: ## Section X.X - Title (X points) or (X-Y points) - use max value for ranges
  const sectionPattern = /^##\s*(Section\s*)?(\d+\.?\d*)\s*[-:]\s*(.+?)\s*\((\d+)(?:-(\d+))?\s*points?\)/i;

  let currentSection = null;

  for (const line of lines) {
    const match = line.match(sectionPattern);
    if (match) {
      // Save previous section
      if (currentSection) {
        sections.push(currentSection);
      }

      // Use max value if range (e.g., "5-15 points" -> 15)
      const minPoints = parseInt(match[4]);
      const maxPoints = match[5] ? parseInt(match[5]) : minPoints;

      currentSection = {
        id: match[2].trim(),
        title: match[3].trim(),
        points: maxPoints,  // Use max value for ranges
        description: ''
      };
    } else if (currentSection && line.trim() && !line.startsWith('#')) {
      // Add to current section description
      currentSection.description += (currentSection.description ? ' ' : '') + line.trim();
    }
  }

  // Don't forget the last section
  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Get total points for a module's homework
 * @param {number} moduleNumber - The module number
 * @returns {number} Total points
 */
export function getTotalPoints(moduleNumber) {
  const sections = parseHomework(moduleNumber);
  return sections.reduce((sum, s) => sum + s.points, 0);
}

/**
 * Map homework sections to relevant videos using AI
 * @param {Array} sections - Parsed homework sections
 * @param {Array} availableVideos - List of available video titles
 * @param {string} openaiApiKey - OpenAI API key
 * @returns {Promise<Object>} Mapping of section IDs to video recommendations
 */
export async function mapSectionsToVideos(sections, availableVideos, openaiApiKey) {
  if (!openaiApiKey || sections.length === 0 || availableVideos.length === 0) {
    return {};
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });

  const prompt = `You are analyzing a homework assignment and a list of lecture videos.
Map each homework section to the most relevant videos that would help complete it.

HOMEWORK SECTIONS:
${sections.map(s => `- Section ${s.id}: ${s.title} (${s.points} pts)\n  ${s.description}`).join('\n\n')}

AVAILABLE VIDEOS:
${availableVideos.map((v, i) => `${i + 1}. ${v}`).join('\n')}

Return a JSON object mapping section IDs to arrays of video titles (exact match from the list).
Also include a "skip" array of videos that are NOT needed for any homework section (like intros, reviews).

Example format:
{
  "mapping": {
    "1.5": ["Video Title 1", "Video Title 2"],
    "2.2": ["Video Title 3"]
  },
  "skip": ["Introduction to Module 3", "Review video"],
  "priority": ["2.2", "1.5", "3"]
}

The priority array should list section IDs in order of importance (highest points first, then complexity).
Only return valid JSON, no other text.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that maps homework sections to relevant lecture videos. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result;
  } catch (e) {
    console.log(`AI mapping failed: ${e.message}`);
    return { mapping: {}, skip: [], priority: sections.map(s => s.id) };
  }
}

/**
 * Get priority-ordered sections (by points, descending)
 * @param {Array} sections - Parsed homework sections
 * @returns {Array} Sections sorted by points descending
 */
export function getPriorityOrder(sections) {
  return [...sections].sort((a, b) => b.points - a.points);
}

/**
 * Generate homework-focused questions for a video
 * @param {string} transcript - Video transcript
 * @param {string} videoTitle - Video title
 * @param {Array} relevantSections - Homework sections this video helps with
 * @param {string} openaiApiKey - OpenAI API key
 * @returns {Promise<Object>} {questions: [], focusPoints: []}
 */
export async function generateHomeworkQuestions(transcript, videoTitle, relevantSections, openaiApiKey) {
  if (!openaiApiKey || !transcript || transcript.length < 50) {
    return { questions: [], focusPoints: [] };
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });

  const sectionsContext = relevantSections.length > 0
    ? `This video helps with:\n${relevantSections.map(s => `- Section ${s.id}: ${s.title} (${s.points} pts)\n  ${s.description}`).join('\n')}`
    : 'General lecture content';

  const prompt = `Create 2 homework-focused Yes/No questions for this lecture.

${sectionsContext}

LECTURE: ${videoTitle}

TRANSCRIPT (first 3000 chars):
${transcript.substring(0, 3000)}

FORMAT (exactly like this):
FOCUS_BEFORE:
1. [What to look for while watching that helps with homework]
2. [Another key thing to look for]

QUESTIONS_AFTER:
Q1: [Yes/No question directly related to homework section]
Q2: [Yes/No question about applying concepts to homework]

Keep questions practical and homework-focused. The student should be able to use their answer to complete their homework.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a study assistant. Generate concise, homework-focused questions.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500
    });

    const content = response.choices[0].message.content;

    // Parse focus points
    const focusMatch = content.match(/FOCUS_BEFORE:[\s\S]*?(?=QUESTIONS_AFTER:|$)/);
    const focusPoints = focusMatch
      ? focusMatch[0].split('\n').filter(l => l.match(/^\d+\./)).map(l => l.replace(/^\d+\.\s*/, '').trim())
      : [];

    // Parse questions
    const questionsMatch = content.match(/QUESTIONS_AFTER:[\s\S]*/);
    const questions = questionsMatch
      ? questionsMatch[0].split('\n').filter(l => l.match(/^Q\d:/)).map(l => l.replace(/^Q\d:\s*/, '').trim())
      : [];

    return { questions, focusPoints };
  } catch (e) {
    console.log(`Question generation failed: ${e.message}`);
    return { questions: [], focusPoints: [] };
  }
}

/**
 * Analyze homework and provide a summary
 * @param {number} moduleNumber - Module number
 * @returns {Object} {sections, totalPoints, summary}
 */
export function analyzeHomework(moduleNumber) {
  const sections = parseHomework(moduleNumber);
  const totalPoints = getTotalPoints(moduleNumber);

  return {
    sections,
    totalPoints,
    priorityOrder: getPriorityOrder(sections),
    sectionCount: sections.length
  };
}

/**
 * Display homework analysis in console
 * @param {number} moduleNumber - Module number
 */
export function displayHomeworkAnalysis(moduleNumber) {
  const { sections, totalPoints, priorityOrder } = analyzeHomework(moduleNumber);

  if (sections.length === 0) {
    console.log(`\nNo homework found for Module ${moduleNumber}.`);
    console.log(`Add homework to: homework/module_${moduleNumber}.txt`);
    return null;
  }

  console.log('\n' + '='.repeat(55));
  console.log(`HOMEWORK MISSION: Module ${moduleNumber}`);
  console.log('='.repeat(55));
  console.log('\nYOUR DELIVERABLES:');

  for (const section of sections) {
    console.log(`   [ ] Section ${section.id}: ${section.title} (${section.points} pts)`);
  }

  console.log(`\nTotal points: ${totalPoints}`);
  console.log('\nPRIORITY ORDER (by points):');

  priorityOrder.forEach((s, i) => {
    console.log(`   ${i + 1}. Section ${s.id} (${s.points} pts) - ${s.title}`);
  });

  return { sections, totalPoints, priorityOrder };
}
