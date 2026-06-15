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
  sharingStats: SharingStats;
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

export type SharingMemberRole = '创建者' | '成员';

export interface SharingCircleMember {
  id: string;
  name: string;
  role: SharingMemberRole;
  joinedAt: string;
  avatar?: string;
}

export interface SharingCircle {
  id: string;
  name: string;
  description?: string;
  creatorId: string;
  creatorName: string;
  members: SharingCircleMember[];
  createdAt: string;
  updatedAt: string;
}

export type SharedBookBorrowStatus = '可借' | '借出中' | '已预留' | '已转送';

export interface SharedBook {
  id: string;
  circleId: string;
  bookId: string;
  book: Book;
  ownerId: string;
  ownerName: string;
  borrowCycleDays: number;
  preferredExchangeThemes: BookTheme[];
  acceptTransfer: boolean;
  notes?: string;
  borrowStatus: SharedBookBorrowStatus;
  currentBorrowerId?: string;
  currentBorrowerName?: string;
  addedAt: string;
  updatedAt: string;
}

export type ExchangeInvitationStatus = '待确认' | '已接受' | '已拒绝' | '已完成' | '已取消';

export interface ExchangeInvitation {
  id: string;
  circleId: string;
  initiatorId: string;
  initiatorName: string;
  targetBookId: string;
  targetBook: SharedBook;
  offeredBookId: string;
  offeredBook: SharedBook;
  expectedExchangeDate: string;
  message?: string;
  status: ExchangeInvitationStatus;
  rejectReason?: string;
  responseAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SharingStats {
  sharedBooksCount: number;
  exchangeCompletionRate: number;
  popularExchangeThemes: ThemeStats[];
  pendingInvitationsCount: number;
  activeCirclesCount: number;
  totalExchangesCount: number;
  completedExchangesCount: number;
}

export type AssessmentPeriodType = 'week' | 'month';
export type AssessmentReportStatus = 'draft' | 'locked';

export interface AssessmentDimensionScore {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  level: '优秀' | '良好' | '一般' | '需关注';
  detail: string;
}

export interface AssessmentAlert {
  type: 'warning' | 'danger' | 'info';
  dimension: string;
  message: string;
}

export interface InterventionSuggestion {
  dimension: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionType: string;
  relatedBookIds: string[];
  status: 'pending' | 'in_progress' | 'done';
}

export interface AssessmentSnapshot {
  totalReadingRecords: number;
  totalReadingDuration: number;
  readingDays: number;
  uniqueBooks: number;
  themeDistribution: { theme: string; count: number }[];
  interactionDistribution: { type: string; count: number }[];
  ageMatchedCount: number;
  ageMismatchedCount: number;
  rotationCompletionRate: number;
  exchangeCompletedCount: number;
  exchangeTotalCount: number;
  sharedBooksCount: number;
}

export interface AssessmentReport {
  id: string;
  periodType: AssessmentPeriodType;
  periodStart: string;
  periodEnd: string;
  babyAgeMonths: number;
  status: AssessmentReportStatus;
  overallScore: number;
  overallLevel: string;
  dimensions: AssessmentDimensionScore[];
  alerts: AssessmentAlert[];
  interventions: InterventionSuggestion[];
  relatedBookIds: string[];
  parentNotes: string[];
  snapshotData: AssessmentSnapshot;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentOverview {
  hasReport: boolean;
  latestId?: string;
  latestScore: number;
  latestLevel: string;
  latestPeriodType?: AssessmentPeriodType;
  latestPeriodStart?: string;
  latestPeriodEnd?: string;
  reportCount: number;
  activeAlerts: number;
  pendingInterventions: number;
  dimensions?: AssessmentDimensionScore[];
}
