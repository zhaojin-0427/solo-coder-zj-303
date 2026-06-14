import { BabyInfo, Book, Recommendation } from './types';

export function calculateBabyAgeMonths(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  return years * 12 + months;
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

export function isOverdue(expectedReturnDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expected = new Date(expectedReturnDate);
  expected.setHours(0, 0, 0, 0);
  return today > expected;
}
