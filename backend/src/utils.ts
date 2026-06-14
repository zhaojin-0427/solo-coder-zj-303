import { BabyInfo, Book, Recommendation, RotationPlanItem, BookTheme } from './types';

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
  return date.toISOString().split('T')[0];
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
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0]
  };
}

export function generateRotationPlanItems(
  books: Book[],
  babyAgeMonths: number,
  readingRecords: { bookId: string; readDate: string }[],
  weekSize: number = 5
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
