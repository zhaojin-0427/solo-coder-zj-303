import { BabyInfo, Book, Recommendation, RotationPlanItem, BookTheme, AssessmentDimensionScore, AssessmentAlert, InterventionSuggestion, AssessmentSnapshot, InteractionType, BookCareProfile, DamageRecord, DamageRiskLevel, BookCondition, CareReminder } from './types';

export function calculateBabyAgeMonths(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  const days = now.getDate() - birth.getDate();
  
  if (days < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  
  return Math.max(0, years * 12 + months);
}

export function getBabyInfo(): BabyInfo {
  return {
    name: '小宝',
    birthDate: '2024-06-15',
    gender: '男'
  };
}

export function recommendBooks(
  books: Book[],
  babyAgeMonths: number,
  readBookIds: string[],
  themePreferences: { theme: string; count: number }[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  const availableBooks = books.filter(b => b.status === '在家' && !readBookIds.includes(b.id));

  for (const book of availableBooks) {
    let score = 0;
    const reasons: string[] = [];

    if (babyAgeMonths >= book.minMonth && babyAgeMonths <= book.maxMonth) {
      score += 40;
      reasons.push('适合当前月龄');
    } else if (babyAgeMonths < book.minMonth) {
      const diff = book.minMonth - babyAgeMonths;
      if (diff <= 3) {
        score += 20;
        reasons.push('接近适龄范围，可以提前接触');
      }
    } else {
      score += 10;
    }

    const themePref = themePreferences.find(t => t.theme === book.theme);
    if (themePref) {
      const themeScore = Math.min(themePref.count * 5, 25);
      score += themeScore;
      reasons.push(`宝宝喜欢${book.theme}类绘本`);
    }

    if (book.interactionType === '翻翻') {
      score += 10;
      reasons.push('互动性强的翻翻书');
    } else if (book.interactionType === '触摸') {
      score += 8;
      reasons.push('触感体验丰富');
    } else if (book.interactionType === '发声') {
      score += 12;
      reasons.push('有声书，促进感官发育');
    }

    if (score > 30) {
      recommendations.push({
        bookId: book.id,
        bookTitle: book.title,
        matchScore: Math.min(score, 100),
        reasons,
        book
      });
    }
  }

  recommendations.sort((a, b) => b.matchScore - a.matchScore);
  return recommendations.slice(0, 10);
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isOverdue(expectedReturnDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expected = new Date(expectedReturnDate);
  expected.setHours(0, 0, 0, 0);
  return today > expected;
}

export function getWeekRange(date: Date): { start: string; end: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: formatDate(monday),
    end: formatDate(sunday)
  };
}

export function generateRotationPlanItems(
  books: Book[],
  babyAgeMonths: number,
  readingRecords: { bookId: string; readDate: string }[],
  weekSize: number = 5,
  careProfiles?: BookCareProfile[]
): Omit<RotationPlanItem, 'id' | 'createdAt' | 'updatedAt'>[] {
  const now = new Date();
  const readBookMap = new Map<string, string[]>();
  for (const record of readingRecords) {
    if (!readBookMap.has(record.bookId)) {
      readBookMap.set(record.bookId, []);
    }
    readBookMap.get(record.bookId)!.push(record.readDate);
  }

  const recentReadBookIds = new Set<string>();
  for (const [bookId, dates] of readBookMap) {
    const lastRead = dates.sort().reverse()[0];
    if (lastRead) {
      const daysSinceLastRead = (now.getTime() - new Date(lastRead).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastRead < 14) {
        recentReadBookIds.add(bookId);
      }
    }
  }

  const availableBooks = books.filter(book => {
    if (book.status !== '在家') return false;
    if (recentReadBookIds.has(book.id)) return false;
    if (careProfiles) {
      const profile = careProfiles.find(p => p.bookId === book.id);
      if (profile) {
        if (profile.isCirculationPaused) return false;
        if (profile.damageRiskLevel === '极高') return false;
      }
    }
    return true;
  });

  const scoredBooks = availableBooks.map(book => {
    let score = 0;
    const reasons: string[] = [];

    if (babyAgeMonths >= book.minMonth && babyAgeMonths <= book.maxMonth) {
      score += 40;
      reasons.push('完全适合当前月龄');
    } else if (babyAgeMonths < book.minMonth) {
      const diff = book.minMonth - babyAgeMonths;
      if (diff <= 2) {
        score += 25;
        reasons.push('即将适龄，可以提前接触');
      } else {
        score += 5;
      }
    } else {
      const diff = babyAgeMonths - book.maxMonth;
      if (diff <= 6) {
        score += 20;
        reasons.push('略微超龄，仍有阅读价值');
      } else {
        score += 5;
      }
    }

    const readDates = readBookMap.get(book.id) || [];
    if (readDates.length === 0) {
      const purchaseDate = new Date(book.purchaseDate);
      const daysSincePurchase = (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePurchase > 60) {
        score += 25;
        reasons.push('长期闲置，急需阅读');
      } else if (daysSincePurchase > 30) {
        score += 15;
        reasons.push('购入已久，尚未阅读');
      } else {
        score += 10;
        reasons.push('新书推荐');
      }
    } else {
      const lastRead = readDates.sort().reverse()[0];
      const daysSinceLastRead = (now.getTime() - new Date(lastRead).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastRead > 60) {
        score += 20;
        reasons.push('久未阅读，适合重温');
      } else if (daysSinceLastRead > 30) {
        score += 12;
        reasons.push('间隔合适，适合复习');
      }
    }

    if (book.interactionType === '翻翻') {
      score += 10;
      reasons.push('互动性强的翻翻书');
    } else if (book.interactionType === '触摸') {
      score += 8;
      reasons.push('触感体验丰富');
    } else if (book.interactionType === '发声') {
      score += 12;
      reasons.push('有声书，促进感官发育');
    }

    return { book, score, reasons };
  });

  scoredBooks.sort((a, b) => b.score - a.score);

  const selectedItems: Omit<RotationPlanItem, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  const selectedThemes = new Set<BookTheme>();

  for (const item of scoredBooks) {
    if (selectedItems.length >= weekSize) break;

    const hasUnselectedTheme = !selectedThemes.has(item.book.theme);
    if (selectedItems.length < 3 || hasUnselectedTheme || selectedThemes.size >= 3) {
      selectedThemes.add(item.book.theme);
      selectedItems.push({
        bookId: item.book.id,
        bookTitle: item.book.title,
        book: item.book,
        sortOrder: selectedItems.length + 1,
        status: '待读',
        isFocus: selectedItems.length === 0,
        reasons: item.reasons,
      });
    }
  }

  return selectedItems;
}

function getLevel(score: number, max: number): '优秀' | '良好' | '一般' | '需关注' {
  const ratio = score / max;
  if (ratio >= 0.85) return '优秀';
  if (ratio >= 0.65) return '良好';
  if (ratio >= 0.40) return '一般';
  return '需关注';
}

export function calculateReadingStability(
  readingRecords: { readDate: string; duration: number }[],
  periodStart: string,
  periodEnd: string
): AssessmentDimensionScore {
  const inPeriod = readingRecords.filter(r => {
    const d = r.readDate;
    return d >= periodStart && d <= periodEnd;
  });

  if (inPeriod.length === 0) {
    return {
      key: 'readingStability',
      label: '阅读稳定性',
      score: 0,
      maxScore: 100,
      level: '需关注',
      detail: '该时段内无阅读打卡记录，建议建立每日阅读习惯'
    };
  }

  const readingDays = new Set(inPeriod.map(r => r.readDate)).size;
  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);
  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const frequencyRatio = Math.min(1, readingDays / totalDays);

  const dates = inPeriod.map(r => new Date(r.readDate).getTime()).sort((a, b) => a - b);
  let gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    gaps.push(Math.ceil((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24)));
  }
  const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const consistencyScore = avgGap <= 1 ? 1 : avgGap <= 2 ? 0.85 : avgGap <= 3 ? 0.7 : avgGap <= 5 ? 0.5 : 0.3;

  const durations = inPeriod.map(r => r.duration);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const durationScore = avgDuration >= 15 ? 1 : avgDuration >= 10 ? 0.8 : avgDuration >= 5 ? 0.6 : 0.4;

  const score = Math.round(frequencyRatio * 40 + consistencyScore * 35 + durationScore * 25);
  const level = getLevel(score, 100);

  let detail = `时段内阅读${readingDays}天/共${totalDays}天`;
  if (avgGap > 0) detail += `，平均间隔${avgGap.toFixed(1)}天`;
  detail += `，平均单次${avgDuration.toFixed(0)}分钟`;

  return { key: 'readingStability', label: '阅读稳定性', score, maxScore: 100, level, detail };
}

export function calculateThemeBalance(
  readingRecords: { bookId: string; readDate: string }[],
  books: Book[],
  allThemes: string[],
  periodStart: string,
  periodEnd: string
): AssessmentDimensionScore {
  const inPeriod = readingRecords.filter(r => {
    const d = r.readDate;
    return d >= periodStart && d <= periodEnd;
  });

  const themeCount: { [key: string]: number } = {};
  for (const theme of allThemes) {
    themeCount[theme] = 0;
  }
  for (const record of inPeriod) {
    const book = books.find(b => b.id === record.bookId);
    if (book) {
      themeCount[book.theme] = (themeCount[book.theme] || 0) + 1;
    }
  }

  const coveredThemes = Object.values(themeCount).filter(c => c > 0).length;
  const totalThemes = allThemes.length;
  const coverageRatio = coveredThemes / totalThemes;

  const counts = Object.values(themeCount).filter(c => c > 0);
  const maxCount = counts.length > 0 ? Math.max(...counts) : 0;
  const minCount = counts.length > 0 ? Math.min(...counts) : 0;
  const balanceRatio = maxCount > 0 ? minCount / maxCount : 0;

  const score = Math.round(coverageRatio * 60 + balanceRatio * 40);
  const level = getLevel(score, 100);

  const uncovered = allThemes.filter(t => themeCount[t] === 0);
  let detail = `已覆盖${coveredThemes}/${totalThemes}个主题`;
  if (uncovered.length > 0 && uncovered.length <= 3) {
    detail += `，未覆盖：${uncovered.join('、')}`;
  } else if (uncovered.length > 3) {
    detail += `，${uncovered.length}个主题尚未涉及`;
  }

  return { key: 'themeBalance', label: '主题均衡度', score, maxScore: 100, level, detail };
}

export function calculateAgeMatch(
  readingRecords: { bookId: string; readDate: string }[],
  books: Book[],
  babyAgeMonths: number,
  periodStart: string,
  periodEnd: string
): AssessmentDimensionScore {
  const inPeriod = readingRecords.filter(r => {
    const d = r.readDate;
    return d >= periodStart && d <= periodEnd;
  });

  if (inPeriod.length === 0) {
    return {
      key: 'ageMatch',
      label: '月龄匹配度',
      score: 0,
      maxScore: 100,
      level: '需关注',
      detail: '无阅读记录，无法评估月龄匹配度'
    };
  }

  let matched = 0;
  let closeMatch = 0;
  let mismatched = 0;

  for (const record of inPeriod) {
    const book = books.find(b => b.id === record.bookId);
    if (book) {
      if (babyAgeMonths >= book.minMonth && babyAgeMonths <= book.maxMonth) {
        matched++;
      } else if (Math.abs(babyAgeMonths - book.minMonth) <= 2 || Math.abs(babyAgeMonths - book.maxMonth) <= 2) {
        closeMatch++;
      } else {
        mismatched++;
      }
    }
  }

  const total = inPeriod.length;
  const matchRatio = matched / total;
  const closeRatio = closeMatch / total;
  const mismatchRatio = mismatched / total;

  const score = Math.round(matchRatio * 70 + closeRatio * 20 + (1 - mismatchRatio) * 10);
  const level = getLevel(score, 100);

  let detail = `完全匹配${matched}本，接近适龄${closeMatch}本，超龄/低龄${mismatched}本`;
  if (mismatchRatio > 0.3) {
    detail += '，超龄绘本占比偏高';
  }

  return { key: 'ageMatch', label: '月龄匹配度', score, maxScore: 100, level, detail };
}

export function calculateInteractionParticipation(
  readingRecords: { bookId: string; readDate: string; reaction?: string }[],
  books: Book[],
  periodStart: string,
  periodEnd: string
): AssessmentDimensionScore {
  const inPeriod = readingRecords.filter(r => {
    const d = r.readDate;
    return d >= periodStart && d <= periodEnd;
  });

  if (inPeriod.length === 0) {
    return {
      key: 'interactionParticipation',
      label: '互动参与度',
      score: 0,
      maxScore: 100,
      level: '需关注',
      detail: '无阅读记录，无法评估互动参与度'
    };
  }

  const interactiveTypes: InteractionType[] = ['翻翻', '触摸', '发声'];
  let interactiveCount = 0;
  const interactionTypes = new Set<string>();

  for (const record of inPeriod) {
    const book = books.find(b => b.id === record.bookId);
    if (book && interactiveTypes.includes(book.interactionType)) {
      interactiveCount++;
      interactionTypes.add(book.interactionType);
    }
  }

  const interactiveRatio = interactiveCount / inPeriod.length;
  const diversityRatio = interactionTypes.size / 3;

  const withReaction = inPeriod.filter(r => r.reaction && r.reaction.trim()).length;
  const reactionRatio = withReaction / inPeriod.length;

  const score = Math.round(interactiveRatio * 40 + diversityRatio * 30 + reactionRatio * 30);
  const level = getLevel(score, 100);

  let detail = `互动型绘本占比${Math.round(interactiveRatio * 100)}%`;
  detail += `，涉及${interactionTypes.size}/3种互动形式`;
  detail += `，记录宝宝反应${withReaction}次`;

  return { key: 'interactionParticipation', label: '互动参与度', score, maxScore: 100, level, detail };
}

export function calculateRotationCompletion(
  rotationPlans: { weekStartDate: string; weekEndDate: string; status: string; items: { status: string }[] }[],
  periodStart: string,
  periodEnd: string
): AssessmentDimensionScore {
  const inPeriod = rotationPlans.filter(p => {
    return p.weekStartDate >= periodStart && p.weekStartDate <= periodEnd;
  });

  if (inPeriod.length === 0) {
    return {
      key: 'rotationCompletion',
      label: '轮换计划完成度',
      score: 50,
      maxScore: 100,
      level: '一般',
      detail: '该时段内无轮换计划记录'
    };
  }

  let totalItems = 0;
  let completedItems = 0;
  let completedPlans = 0;

  for (const plan of inPeriod) {
    totalItems += plan.items.length;
    completedItems += plan.items.filter(i => i.status === '已读').length;
    if (plan.status === 'completed') completedPlans++;
  }

  const itemCompletionRate = totalItems > 0 ? completedItems / totalItems : 0;
  const planCompletionRate = completedPlans / inPeriod.length;

  const score = Math.round(itemCompletionRate * 60 + planCompletionRate * 40);
  const level = getLevel(score, 100);

  const detail = `${inPeriod.length}个计划中完成${completedPlans}个，计划项完成率${Math.round(itemCompletionRate * 100)}%`;

  return { key: 'rotationCompletion', label: '轮换计划完成度', score, maxScore: 100, level, detail };
}

export function calculateExchangeExpansion(
  exchangeInvitations: { status: string; createdAt: string }[],
  sharedBooks: { id: string }[],
  periodStart: string,
  periodEnd: string
): AssessmentDimensionScore {
  const inPeriod = exchangeInvitations.filter(ei => {
    const d = ei.createdAt.split('T')[0];
    return d >= periodStart && d <= periodEnd;
  });

  const totalExchanges = inPeriod.length;
  const completedExchanges = inPeriod.filter(ei => ei.status === '已完成').length;
  const acceptedExchanges = inPeriod.filter(ei => ei.status === '已接受').length;

  const completionRate = totalExchanges > 0 ? completedExchanges / totalExchanges : 0;

  let volumeScore = 0;
  if (totalExchanges >= 5) volumeScore = 30;
  else if (totalExchanges >= 3) volumeScore = 25;
  else if (totalExchanges >= 1) volumeScore = 15;

  const sharedScore = sharedBooks.length >= 5 ? 20 : sharedBooks.length >= 2 ? 15 : sharedBooks.length > 0 ? 10 : 0;

  const successScore = Math.round(completionRate * 50);

  const score = volumeScore + sharedScore + successScore;
  const level = getLevel(score, 100);

  let detail = `发起/收到${totalExchanges}次换书邀约，已完成${completedExchanges}次`;
  if (sharedBooks.length > 0) {
    detail += `，共享书单${sharedBooks.length}本`;
  }

  return { key: 'exchangeExpansion', label: '共享换书拓展度', score, maxScore: 100, level, detail };
}

export function generateAlerts(dimensions: AssessmentDimensionScore[]): AssessmentAlert[] {
  const alerts: AssessmentAlert[] = [];

  for (const dim of dimensions) {
    if (dim.level === '需关注') {
      alerts.push({
        type: 'danger',
        dimension: dim.key,
        message: `${dim.label}严重不足：${dim.detail}`
      });
    } else if (dim.level === '一般') {
      alerts.push({
        type: 'warning',
        dimension: dim.key,
        message: `${dim.label}偏低：${dim.detail}`
      });
    }
  }

  return alerts;
}

export function generateInterventions(
  dimensions: AssessmentDimensionScore[],
  books: Book[],
  allThemes: string[],
  babyAgeMonths: number,
  themeDistribution: { theme: string; count: number }[]
): InterventionSuggestion[] {
  const interventions: InterventionSuggestion[] = [];

  const stabilityDim = dimensions.find(d => d.key === 'readingStability');
  if (stabilityDim && (stabilityDim.level === '需关注' || stabilityDim.level === '一般')) {
    interventions.push({
      dimension: 'readingStability',
      priority: stabilityDim.level === '需关注' ? 'high' : 'medium',
      title: '建立每日阅读习惯',
      description: '建议每天固定时间陪宝宝阅读，从5-10分钟开始逐步延长，保持阅读频率的稳定性',
      actionType: 'reading_routine',
      relatedBookIds: books.filter(b => b.status === '在家' && babyAgeMonths >= b.minMonth && babyAgeMonths <= b.maxMonth).slice(0, 3).map(b => b.id),
      status: 'pending'
    });
  }

  const themeDim = dimensions.find(d => d.key === 'themeBalance');
  if (themeDim && (themeDim.level === '需关注' || themeDim.level === '一般')) {
    const uncovered = allThemes.filter(t => !themeDistribution.some(td => td.theme === t && td.count > 0));
    const lowThemes = themeDistribution.filter(td => td.count <= 1).map(td => td.theme);
    const targetThemes = [...uncovered, ...lowThemes].slice(0, 3);

    const relatedBooks = books.filter(b =>
      b.status === '在家' &&
      targetThemes.includes(b.theme) &&
      babyAgeMonths >= b.minMonth &&
      babyAgeMonths <= b.maxMonth
    ).slice(0, 5).map(b => b.id);

    interventions.push({
      dimension: 'themeBalance',
      priority: themeDim.level === '需关注' ? 'high' : 'medium',
      title: '拓宽阅读主题覆盖',
      description: `建议增加${targetThemes.join('、')}主题的绘本阅读，丰富宝宝的认知维度`,
      actionType: 'theme_expand',
      relatedBookIds: relatedBooks,
      status: 'pending'
    });
  }

  const ageDim = dimensions.find(d => d.key === 'ageMatch');
  if (ageDim && (ageDim.level === '需关注' || ageDim.level === '一般')) {
    const matchedBooks = books.filter(b =>
      b.status === '在家' &&
      babyAgeMonths >= b.minMonth &&
      babyAgeMonths <= b.maxMonth
    ).slice(0, 3).map(b => b.id);

    interventions.push({
      dimension: 'ageMatch',
      priority: ageDim.level === '需关注' ? 'high' : 'medium',
      title: '调整月龄适配绘本',
      description: `当前月龄${babyAgeMonths}个月，建议优先选择适龄范围内的绘本，避免过早接触超龄内容`,
      actionType: 'age_adjust',
      relatedBookIds: matchedBooks,
      status: 'pending'
    });
  }

  const interactionDim = dimensions.find(d => d.key === 'interactionParticipation');
  if (interactionDim && (interactionDim.level === '需关注' || interactionDim.level === '一般')) {
    const interactiveBooks = books.filter(b =>
      b.status === '在家' &&
      ['翻翻', '触摸', '发声'].includes(b.interactionType) &&
      babyAgeMonths >= b.minMonth &&
      babyAgeMonths <= b.maxMonth
    ).slice(0, 3).map(b => b.id);

    interventions.push({
      dimension: 'interactionParticipation',
      priority: interactionDim.level === '需关注' ? 'high' : 'medium',
      title: '增加互动型绘本阅读',
      description: '建议多引入翻翻书、触摸书、发声书等互动形式，提升宝宝的阅读参与感',
      actionType: 'interaction_boost',
      relatedBookIds: interactiveBooks,
      status: 'pending'
    });
  }

  const rotationDim = dimensions.find(d => d.key === 'rotationCompletion');
  if (rotationDim && (rotationDim.level === '需关注' || rotationDim.level === '一般')) {
    interventions.push({
      dimension: 'rotationCompletion',
      priority: rotationDim.level === '需关注' ? 'high' : 'low',
      title: '优化轮换计划执行',
      description: '建议坚持执行轮换计划，跳过的绘本可安排到下周重点阅读',
      actionType: 'rotation_improve',
      relatedBookIds: [],
      status: 'pending'
    });
  }

  const exchangeDim = dimensions.find(d => d.key === 'exchangeExpansion');
  if (exchangeDim && (exchangeDim.level === '需关注' || exchangeDim.level === '一般')) {
    interventions.push({
      dimension: 'exchangeExpansion',
      priority: 'low',
      title: '参与共享换书拓展阅读',
      description: '建议加入共享圈参与换书，以低成本拓展宝宝的阅读广度',
      actionType: 'exchange_expand',
      relatedBookIds: [],
      status: 'pending'
    });
  }

  return interventions;
}

export function buildSnapshot(
  readingRecords: { bookId: string; readDate: string; duration: number; reaction?: string }[],
  books: Book[],
  allThemes: string[],
  babyAgeMonths: number,
  rotationCompletionRate: number,
  exchangeCompletedCount: number,
  exchangeTotalCount: number,
  sharedBooksCount: number,
  periodStart: string,
  periodEnd: string
): AssessmentSnapshot {
  const inPeriod = readingRecords.filter(r => {
    const d = r.readDate;
    return d >= periodStart && d <= periodEnd;
  });

  const themeDistribution: { theme: string; count: number }[] = [];
  const themeMap: { [key: string]: number } = {};
  for (const record of inPeriod) {
    const book = books.find(b => b.id === record.bookId);
    if (book) {
      themeMap[book.theme] = (themeMap[book.theme] || 0) + 1;
    }
  }
  for (const [theme, count] of Object.entries(themeMap)) {
    themeDistribution.push({ theme, count });
  }

  const interactionDistribution: { type: string; count: number }[] = [];
  const interactionMap: { [key: string]: number } = {};
  for (const record of inPeriod) {
    const book = books.find(b => b.id === record.bookId);
    if (book) {
      interactionMap[book.interactionType] = (interactionMap[book.interactionType] || 0) + 1;
    }
  }
  for (const [type, count] of Object.entries(interactionMap)) {
    interactionDistribution.push({ type, count });
  }

  let ageMatchedCount = 0;
  let ageMismatchedCount = 0;
  for (const record of inPeriod) {
    const book = books.find(b => b.id === record.bookId);
    if (book) {
      if (babyAgeMonths >= book.minMonth && babyAgeMonths <= book.maxMonth) {
        ageMatchedCount++;
      } else {
        ageMismatchedCount++;
      }
    }
  }

  return {
    totalReadingRecords: inPeriod.length,
    totalReadingDuration: inPeriod.reduce((sum, r) => sum + r.duration, 0),
    readingDays: new Set(inPeriod.map(r => r.readDate)).size,
    uniqueBooks: new Set(inPeriod.map(r => r.bookId)).size,
    themeDistribution,
    interactionDistribution,
    ageMatchedCount,
    ageMismatchedCount,
    rotationCompletionRate,
    exchangeCompletedCount,
    exchangeTotalCount,
    sharedBooksCount
  };
}

export function getOverallLevel(score: number): string {
  if (score >= 85) return '优秀 🌟';
  if (score >= 65) return '良好 👍';
  if (score >= 40) return '一般 📈';
  return '需关注 ⚠️';
}

export function getPeriodRange(type: 'week' | 'month', refDate?: Date): { start: string; end: string } {
  const d = refDate || new Date();
  if (type === 'week') {
    return getWeekRange(d);
  }
  const year = d.getFullYear();
  const month = d.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    start: formatDate(start),
    end: formatDate(end)
  };
}

export function calculateDamageRiskLevel(
  book: Book,
  borrowCount: number,
  readCount: number,
  unresolvedDamages: DamageRecord[],
  isCirculationPaused: boolean
): { level: DamageRiskLevel; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (book.interactionType === '翻翻') {
    score += 15;
    reasons.push('翻翻书机械结构易损耗');
  }
  if (book.interactionType === '发声') {
    score += 25;
    reasons.push('发声书电子元件易损坏');
  }
  if (book.interactionType === '触摸') {
    score += 10;
    reasons.push('触摸书接触面易磨损');
  }

  if (borrowCount >= 5) {
    score += 30;
    reasons.push(`借阅${borrowCount}次，流转频次高`);
  } else if (borrowCount >= 3) {
    score += 20;
    reasons.push(`借阅${borrowCount}次，流转频次较高`);
  } else if (borrowCount >= 1) {
    score += 10;
  }

  if (readCount >= 10) {
    score += 25;
    reasons.push(`被阅读${readCount}次，使用频率高`);
  } else if (readCount >= 5) {
    score += 15;
    reasons.push(`被阅读${readCount}次，使用频率较高`);
  }

  for (const dmg of unresolvedDamages) {
    if (dmg.severity === '严重') {
      score += 40;
      reasons.push(`存在严重损耗：${dmg.damageType}`);
    } else if (dmg.severity === '中度') {
      score += 25;
      reasons.push(`存在中度损耗：${dmg.damageType}`);
    } else {
      score += 10;
      reasons.push(`存在轻微损耗：${dmg.damageType}`);
    }
  }

  if (isCirculationPaused) {
    score += 50;
    reasons.push('已暂停流转');
  }

  let level: DamageRiskLevel;
  if (score >= 80) level = '极高';
  else if (score >= 50) level = '高';
  else if (score >= 25) level = '中';
  else level = '低';

  if (reasons.length === 0) {
    reasons.push('状态良好，风险较低');
  }

  return { level, reasons };
}

export function calculateBookCondition(
  unresolvedDamages: DamageRecord[],
  borrowCount: number,
  readCount: number
): BookCondition {
  const severeCount = unresolvedDamages.filter(d => d.severity === '严重').length;
  const moderateCount = unresolvedDamages.filter(d => d.severity === '中度').length;
  const mildCount = unresolvedDamages.filter(d => d.severity === '轻微').length;

  if (severeCount >= 2) return '破损';
  if (severeCount >= 1) return '较差';
  if (moderateCount >= 2) return '较差';
  if (moderateCount >= 1 || mildCount >= 2) return '一般';
  if (mildCount >= 1 || borrowCount >= 3 || readCount >= 8) return '良好';
  return '全新';
}

export function updateCareProfileOnAction(
  profile: BookCareProfile,
  book: Book,
  action: 'borrow' | 'return' | 'exchangeComplete' | 'reading'
): BookCareProfile {
  const now = new Date().toISOString();

  switch (action) {
    case 'borrow':
      profile.totalBorrowCount += 1;
      break;
    case 'return':
    case 'exchangeComplete':
      profile.totalBorrowCount = Math.max(0, profile.totalBorrowCount);
      profile.lastInspectionDate = now.split('T')[0];
      break;
    case 'reading':
      profile.totalReadCount += 1;
      break;
  }

  const unresolvedDamages = profile.damageRecords.filter(d => !d.resolved);
  const riskResult = calculateDamageRiskLevel(
    book,
    profile.totalBorrowCount,
    profile.totalReadCount,
    unresolvedDamages,
    profile.isCirculationPaused
  );
  profile.damageRiskLevel = riskResult.level;
  profile.damageRiskReasons = riskResult.reasons;
  profile.currentCondition = calculateBookCondition(
    unresolvedDamages,
    profile.totalBorrowCount,
    profile.totalReadCount
  );
  profile.updatedAt = now;

  return profile;
}

export function generateCleaningReminder(bookId: string, bookTitle: string, lastCleanDate?: string): CareReminder {
  const now = new Date();
  let scheduled = new Date();
  if (lastCleanDate) {
    scheduled = new Date(new Date(lastCleanDate).getTime() + 30 * 24 * 3600 * 1000);
    if (scheduled < now) scheduled = now;
  } else {
    scheduled.setDate(scheduled.getDate() + 30);
  }

  return {
    id: '',
    bookId,
    bookTitle,
    type: '清洁消毒',
    title: '定期清洁消毒提醒',
    description: '建议对绘本进行清洁消毒',
    scheduledDate: formatDate(scheduled),
    isCompleted: false,
    priority: 'medium',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
}

export function isDateValid(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

export function isDateRangeValid(start: string, end: string): boolean {
  if (!isDateValid(start) || !isDateValid(end)) return false;
  return start <= end;
}

export function isValidBookCondition(condition: string): condition is BookCondition {
  return ['全新', '良好', '一般', '较差', '破损'].includes(condition);
}

export function isValidDamageType(type: string): boolean {
  return ['污渍', '缺页', '发声失灵', '撕页', '涂鸦', '装订松散', '书脊损坏', '封面磨损', '其他'].includes(type);
}

export function isValidDamageRiskLevel(level: string): level is DamageRiskLevel {
  return ['低', '中', '高', '极高'].includes(level);
}

export function isValidSeverity(severity: string): severity is '轻微' | '中度' | '严重' {
  return ['轻微', '中度', '严重'].includes(severity);
}

export function isValidRepairStatus(status: string): boolean {
  return ['待处理', '处理中', '已完成', '无法修复'].includes(status);
}
