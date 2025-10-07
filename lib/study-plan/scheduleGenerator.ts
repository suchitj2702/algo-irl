/**
 * Schedule Generator
 *
 * Distributes selected problems across study days by:
 * 1. Calculating daily time budget (hoursPerDay)
 * 2. Prioritizing by hotness score (highest priority first)
 * 3. Spacing similar topics across different days
 * 4. Ensuring each day doesn't exceed time budget
 *
 * The generator balances hotness priority with practical time constraints.
 */

import { EnrichedProblemInternal } from './types';

/**
 * Internal daily plan structure (before conversion to API format)
 */
export interface DailyPlanInternal {
  day: number;
  date: string;
  problems: EnrichedProblemInternal[];
  estimatedHours: number;
  topics: string[];
}

/**
 * Extract unique topics from problems
 * Combines data structures and algorithm patterns into a single set
 */
function extractUniqueTopics(problems: EnrichedProblemInternal[]): Set<string> {
  const topics = new Set<string>();
  for (const p of problems) {
    for (const t of p.enrichedTopics.dataStructures) topics.add(t);
    for (const t of p.enrichedTopics.algorithmPatterns) topics.add(t);
  }
  return topics;
}

/**
 * Sort problems by hotness score (descending)
 * Strategy: Show highest priority problems first
 */
function sortByHotness(
  problems: EnrichedProblemInternal[]
): EnrichedProblemInternal[] {
  return [...problems].sort((a, b) => b.hotnessScore - a.hotnessScore);
}

/**
 * Calculate topic diversity score between two problems
 * Higher score = more different topics
 */
function calculateTopicDiversity(
  p1: EnrichedProblemInternal,
  p2: EnrichedProblemInternal
): number {
  const topics1 = new Set([
    ...p1.enrichedTopics.dataStructures,
    ...p1.enrichedTopics.algorithmPatterns
  ]);

  const topics2 = new Set([
    ...p2.enrichedTopics.dataStructures,
    ...p2.enrichedTopics.algorithmPatterns
  ]);

  // Count unique topics (topics in p2 not in p1)
  let uniqueTopics = 0;
  for (const topic of topics2) {
    if (!topics1.has(topic)) {
      uniqueTopics++;
    }
  }

  return uniqueTopics;
}

/**
 * Check if adding a problem would exceed daily time budget
 */
function wouldExceedBudget(
  currentDayProblems: EnrichedProblemInternal[],
  newProblem: EnrichedProblemInternal,
  dailyBudgetMinutes: number
): boolean {
  const currentTime = currentDayProblems.reduce(
    (sum, p) => sum + p.estimatedTimeMinutes,
    0
  );

  return currentTime + newProblem.estimatedTimeMinutes > dailyBudgetMinutes;
}

/**
 * Internal day structure during distribution
 */
interface InternalDay {
  dayNumber: number;
  problems: EnrichedProblemInternal[];
  totalEstimatedMinutes: number;
}

/**
 * Distribute problems across days using greedy algorithm with topic spacing
 *
 * Algorithm:
 * 1. Sort problems by hotness score (highest first)
 * 2. For each problem, assign to earliest day that:
 *    - Has time budget remaining
 *    - Maximizes topic diversity (prefer days with different topics)
 * 3. If no day has space, create new day
 */
function distributeProblemsToDays(
  problems: EnrichedProblemInternal[],
  timeline: number,
  dailyBudgetMinutes: number
): InternalDay[] {
  const sortedProblems = sortByHotness(problems);
  const days: InternalDay[] = [];

  for (const problem of sortedProblems) {
    let bestDayIndex = -1;
    let bestDiversityScore = -1;

    // Find best day to add this problem
    for (let i = 0; i < days.length && i < timeline; i++) {
      // Check if day has time budget
      if (wouldExceedBudget(days[i].problems, problem, dailyBudgetMinutes)) {
        continue;
      }

      // Calculate diversity score (how different is this problem from existing ones)
      let diversityScore = 0;
      for (const existingProblem of days[i].problems) {
        diversityScore += calculateTopicDiversity(existingProblem, problem);
      }

      // Prefer days with higher diversity (different topics)
      if (diversityScore > bestDiversityScore) {
        bestDiversityScore = diversityScore;
        bestDayIndex = i;
      }
    }

    // If found a suitable day, add problem to it
    if (bestDayIndex !== -1) {
      days[bestDayIndex].problems.push(problem);
    } else {
      // Create new day if within timeline
      if (days.length < timeline) {
        days.push({
          dayNumber: days.length + 1,
          problems: [problem],
          totalEstimatedMinutes: 0 // Will be calculated later
        });
      } else {
        // Timeline exhausted but still have problems
        // Add to last day (user will need to adjust timeline)
        if (days.length > 0) {
          days[days.length - 1].problems.push(problem);
        }
      }
    }
  }

  // Calculate total time for each day
  for (const day of days) {
    day.totalEstimatedMinutes = day.problems.reduce(
      (sum, p) => sum + p.estimatedTimeMinutes,
      0
    );
  }

  return days;
}

/**
 * Balance days to distribute workload more evenly
 *
 * If some days are much lighter than others, try to move problems
 * from heavy days to light days (while maintaining topic diversity)
 */
function balanceDays(
  days: InternalDay[],
  dailyBudgetMinutes: number
): InternalDay[] {
  if (days.length <= 1) return days;

  const avgTime =
    days.reduce((sum, d) => sum + d.totalEstimatedMinutes, 0) / days.length;

  // Find overloaded and underloaded days
  const overloadedDays = days.filter(d => d.totalEstimatedMinutes > avgTime * 1.3);
  const underloadedDays = days.filter(d => d.totalEstimatedMinutes < avgTime * 0.7);

  // Try to move problems from overloaded to underloaded days
  for (const overloadedDay of overloadedDays) {
    for (const underloadedDay of underloadedDays) {
      // Find smallest problem in overloaded day that fits in underloaded day
      const sortedProblems = [...overloadedDay.problems].sort(
        (a, b) => a.estimatedTimeMinutes - b.estimatedTimeMinutes
      );

      for (const problem of sortedProblems) {
        const newUnderloadedTime =
          underloadedDay.totalEstimatedMinutes + problem.estimatedTimeMinutes;
        const newOverloadedTime =
          overloadedDay.totalEstimatedMinutes - problem.estimatedTimeMinutes;

        // Check if move improves balance and doesn't exceed budget
        if (
          newUnderloadedTime <= dailyBudgetMinutes &&
          newOverloadedTime >= avgTime * 0.7 &&
          newUnderloadedTime <= avgTime * 1.3
        ) {
          // Move problem
          const problemIndex = overloadedDay.problems.indexOf(problem);
          overloadedDay.problems.splice(problemIndex, 1);
          underloadedDay.problems.push(problem);

          // Update times
          overloadedDay.totalEstimatedMinutes = newOverloadedTime;
          underloadedDay.totalEstimatedMinutes = newUnderloadedTime;

          break; // Try next overloaded day
        }
      }
    }
  }

  return days;
}

/**
 * Generate study schedule from selected problems
 *
 * @param problems - Problems selected by problemSelector
 * @param timeline - Number of days available
 * @param hoursPerDay - Hours available per day
 * @param startDate - Optional start date (defaults to today)
 * @returns Daily schedule with problems distributed across days (internal format)
 */
export function generateSchedule(
  problems: EnrichedProblemInternal[],
  timeline: number,
  hoursPerDay: number,
  startDate: Date = new Date()
): DailyPlanInternal[] {
  console.log(`\n${'='.repeat(60)}`);
  console.log('📅 SCHEDULE GENERATION');
  console.log('='.repeat(60));
  console.log(`Timeline: ${timeline} days`);
  console.log(`Budget: ${hoursPerDay} hours/day (${hoursPerDay * 60} min/day)`);
  console.log(`Problems: ${problems.length}\n`);

  const dailyBudgetMinutes = hoursPerDay * 60;

  // 1. Calculate total time needed
  const totalTime = problems.reduce((sum, p) => sum + p.estimatedTimeMinutes, 0);
  const totalAvailableTime = timeline * dailyBudgetMinutes;

  console.log(`📊 Time analysis:`);
  console.log(`   Total needed: ${totalTime} min (${(totalTime / 60).toFixed(1)} hrs)`);
  console.log(
    `   Total available: ${totalAvailableTime} min (${(totalAvailableTime / 60).toFixed(1)} hrs)`
  );

  if (totalTime > totalAvailableTime) {
    console.log(
      `   ⚠️  Warning: Need ${((totalTime - totalAvailableTime) / 60).toFixed(1)} more hours`
    );
  }

  // 2. Distribute problems to days
  console.log(`\n📦 Distributing problems...`);
  let internalDays = distributeProblemsToDays(problems, timeline, dailyBudgetMinutes);

  // 3. Balance workload across days
  console.log(`⚖️  Balancing workload...`);
  internalDays = balanceDays(internalDays, dailyBudgetMinutes);

  // 4. Convert to DailyPlanInternal format with dates and topics
  const dailyPlans: DailyPlanInternal[] = internalDays.map((internalDay, index) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + index);

    // Extract unique topics for this day
    const topics = extractUniqueTopics(internalDay.problems);

    // Set dayAssigned on each problem
    internalDay.problems.forEach(p => {
      p.dayAssigned = internalDay.dayNumber;
    });

    return {
      day: internalDay.dayNumber,
      date: date.toISOString(),
      problems: internalDay.problems,
      estimatedHours: internalDay.totalEstimatedMinutes / 60,
      topics: Array.from(topics)
    };
  });

  // 5. Calculate statistics
  const avgProblemsPerDay =
    internalDays.reduce((sum, d) => sum + d.problems.length, 0) / internalDays.length;
  const avgTimePerDay =
    internalDays.reduce((sum, d) => sum + d.totalEstimatedMinutes, 0) / internalDays.length;
  const maxTime = Math.max(...internalDays.map(d => d.totalEstimatedMinutes));
  const minTime = Math.min(...internalDays.map(d => d.totalEstimatedMinutes));

  console.log(`\n📈 Schedule statistics:`);
  console.log(`   Days used: ${dailyPlans.length} / ${timeline}`);
  console.log(`   Avg problems/day: ${avgProblemsPerDay.toFixed(1)}`);
  console.log(`   Avg time/day: ${avgTimePerDay.toFixed(0)} min`);
  console.log(`   Max day: ${maxTime.toFixed(0)} min`);
  console.log(`   Min day: ${minTime.toFixed(0)} min`);

  // 6. Show per-day breakdown
  console.log(`\n📋 Day-by-day breakdown:`);
  for (const day of internalDays) {
    const isOverBudget = day.totalEstimatedMinutes > dailyBudgetMinutes;
    const status = isOverBudget ? '⚠️ ' : '✅';

    console.log(
      `   ${status} Day ${day.dayNumber}: ${day.problems.length} problems, ${day.totalEstimatedMinutes} min`
    );

    // Show difficulty distribution
    const easy = day.problems.filter(p => p.difficulty === 'Easy').length;
    const medium = day.problems.filter(p => p.difficulty === 'Medium').length;
    const hard = day.problems.filter(p => p.difficulty === 'Hard').length;

    console.log(`      Difficulty: E=${easy}, M=${medium}, H=${hard}`);

    // Show unique topics for the day
    const uniqueTopics = extractUniqueTopics(day.problems);
    console.log(`      Topics: ${uniqueTopics.size} unique`);
  }

  console.log('='.repeat(60) + '\n');

  return dailyPlans;
}
