export type BookStatus = '在家' | '借出' | '预留' | '转送';
export type InteractionType = '翻翻' | '触摸' | '发声' | '普通';
export type BookTheme = 
  | '认知启蒙'
  | '情绪管理'
  | '习惯养成'
  | '自然科普'
  | '安全教育'
  | '品格培养'
  | '想象力'
  | '数学逻辑'
  | '语言启蒙'
  | '艺术审美';

export interface Book {
  id: string;
  title: string;
  author: string;
  theme: BookTheme;
  minMonth: number;
  maxMonth: number;
  interactionType: InteractionType;
  purchaseDate: string;
  status: BookStatus;
  coverUrl?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BorrowRecord {
  id: string;
  bookId: string;
  bookTitle: string;
  borrower: string;
  borrowerPhone?: string;
  borrowDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  status: '借出中' | '已归还' | '逾期';
  notes?: string;
  createdAt: string;
}

export interface ReadingRecord {
  id: string;
  bookId: string;
  bookTitle: string;
  readDate: string;
  duration: number;
  babyAgeMonths: number;
  reaction?: string;
  notes?: string;
  createdAt: string;
}

export interface BabyInfo {
  name: string;
  birthDate: string;
  gender: '男' | '女' | '保密';
  ageMonths?: number;
}

export interface Recommendation {
  bookId: string;
  bookTitle: string;
  matchScore: number;
  reasons: string[];
  book: Book;
}

export interface MonthlyStats {
  month: number;
  count: number;
}

export interface ThemeStats {
  theme: BookTheme;
  count: number;
}

export interface Statistics {
  totalBooks: number;
  totalBorrows: number;
  returnRate: number;
  totalReadingTime: number;
  monthlyReadingFrequency: MonthlyStats[];
  popularThemes: ThemeStats[];
  idleBooks: Book[];
  borrowedBooksCount: number;
}

export interface RecommendationResponse {
  babyAgeMonths: number;
  themePreferences: { theme: string; count: number }[];
  recommendations: Recommendation[];
}

export type RotationItemStatus = '待读' | '已读' | '跳过' | '重点';
export type RotationPlanStatus = 'active' | 'completed' | 'expired';

export interface RotationPlanItem {
  id: string;
  bookId: string;
  bookTitle: string;
  book: Book;
  sortOrder: number;
  status: RotationItemStatus;
  isFocus: boolean;
  reasons: string[];
  skipReason?: string;
  readDate?: string;
  readingRecordId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RotationPlan {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  babyAgeMonths: number;
  status: RotationPlanStatus;
  items: RotationPlanItem[];
  createdAt: string;
  updatedAt: string;
}

export interface RotationPlanStats {
  hasPlan: boolean;
  planId?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  totalCount: number;
  readCount: number;
  skippedCount: number;
  completionRate: number;
  hitRate: number;
  skippedThemes: ThemeStats[];
}
