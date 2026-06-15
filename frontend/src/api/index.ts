import axios from 'axios';
import type {
  Book,
  BorrowRecord,
  ReadingRecord,
  BabyInfo,
  Statistics,
  RecommendationResponse,
  BookStatus,
  RotationPlan,
  RotationPlanItem,
  RotationPlanStats,
  SharingCircle,
  SharedBook,
  ExchangeInvitation,
  BookTheme,
  AssessmentReport,
  AssessmentOverview,
  AssessmentPeriodType
} from '@/types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

export const babyApi = {
  getInfo: () => api.get<BabyInfo>('/baby-info').then(r => r.data),
  updateInfo: (data: Partial<BabyInfo>) => api.put<BabyInfo>('/baby-info', data).then(r => r.data)
};

export const bookApi = {
  getList: (params?: { status?: string; theme?: string; search?: string }) =>
    api.get<Book[]>('/books', { params }).then(r => r.data),
  getDetail: (id: string) => api.get<Book>(`/books/${id}`).then(r => r.data),
  create: (data: Partial<Book>) => api.post<Book>('/books', data).then(r => r.data),
  update: (id: string, data: Partial<Book>) => api.put<Book>(`/books/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/books/${id}`).then(r => r.data),
  updateStatus: (id: string, status: BookStatus) =>
    api.patch<Book>(`/books/${id}/status`, { status }).then(r => r.data)
};

export const borrowApi = {
  getList: (params?: { status?: string; bookId?: string }) =>
    api.get<BorrowRecord[]>('/borrow-records', { params }).then(r => r.data),
  create: (data: {
    bookId: string;
    borrower: string;
    borrowerPhone?: string;
    borrowDate?: string;
    expectedReturnDate: string;
    notes?: string;
  }) => api.post<BorrowRecord>('/borrow-records', data).then(r => r.data),
  returnBook: (id: string, returnDate?: string) =>
    api.post<BorrowRecord>(`/borrow-records/${id}/return`, { returnDate }).then(r => r.data),
  delete: (id: string) => api.delete(`/borrow-records/${id}`).then(r => r.data)
};

export const readingApi = {
  getList: () => api.get<ReadingRecord[]>('/reading-records').then(r => r.data),
  create: (data: {
    bookId: string;
    readDate?: string;
    duration: number;
    babyAgeMonths?: number;
    reaction?: string;
    notes?: string;
  }) => api.post<ReadingRecord>('/reading-records', data).then(r => r.data),
  delete: (id: string) => api.delete(`/reading-records/${id}`).then(r => r.data)
};

export const recommendApi = {
  getRecommendations: () => api.get<RecommendationResponse>('/recommendations').then(r => r.data)
};

export const statsApi = {
  getStatistics: () => api.get<Statistics>('/statistics').then(r => r.data)
};

export const metaApi = {
  getThemes: () => api.get<string[]>('/themes').then(r => r.data),
  getInteractionTypes: () => api.get<string[]>('/interaction-types').then(r => r.data)
};

export const rotationApi = {
  getList: () => api.get<RotationPlan[]>('/rotation-plans').then(r => r.data),
  getCurrent: () => api.get<RotationPlan>('/rotation-plans/current').then(r => r.data),
  getDetail: (id: string) => api.get<RotationPlan>(`/rotation-plans/${id}`).then(r => r.data),
  generate: (weekSize?: number) => 
    api.post<RotationPlan>('/rotation-plans/generate', { weekSize }).then(r => r.data),
  setFocus: (planId: string, itemId: string, isFocus: boolean) =>
    api.patch<RotationPlanItem>(`/rotation-plans/${planId}/items/${itemId}/focus`, { isFocus }).then(r => r.data),
  skipItem: (planId: string, itemId: string, skipReason: string) =>
    api.patch<RotationPlanItem>(`/rotation-plans/${planId}/items/${itemId}/skip`, { skipReason }).then(r => r.data),
  unskipItem: (planId: string, itemId: string) =>
    api.patch<RotationPlanItem>(`/rotation-plans/${planId}/items/${itemId}/unskip`).then(r => r.data),
  updateItemStatus: (planId: string, itemId: string, status: string, readingRecordId?: string, readDate?: string) =>
    api.patch<RotationPlanItem>(`/rotation-plans/${planId}/items/${itemId}/status`, { status, readingRecordId, readDate }).then(r => r.data),
  getStats: () => api.get<RotationPlanStats>('/rotation-plans/stats/summary').then(r => r.data)
};

export const sharingApi = {
  getCircles: () => api.get<SharingCircle[]>('/sharing/circles').then(r => r.data),
  getCircle: (id: string) => api.get<SharingCircle>(`/sharing/circles/${id}`).then(r => r.data),
  createCircle: (data: { name: string; description?: string }) =>
    api.post<SharingCircle>('/sharing/circles', data).then(r => r.data),
  joinCircle: (circleId: string, memberName: string) =>
    api.post<SharingCircle>(`/sharing/circles/${circleId}/join`, { memberName }).then(r => r.data),
  deleteCircle: (id: string) => api.delete(`/sharing/circles/${id}`).then(r => r.data),

  getSharedBooks: (params?: {
    circleId?: string;
    theme?: string;
    minMonth?: number;
    maxMonth?: number;
    interactionType?: string;
    borrowStatus?: string;
    ownerId?: string;
  }) => api.get<SharedBook[]>('/sharing/books', { params }).then(r => r.data),
  getMySharedBooks: () => api.get<SharedBook[]>('/sharing/books/mine').then(r => r.data),
  addSharedBook: (data: {
    circleId: string;
    bookId: string;
    borrowCycleDays?: number;
    preferredExchangeThemes?: BookTheme[];
    acceptTransfer?: boolean;
    notes?: string;
  }) => api.post<SharedBook>('/sharing/books', data).then(r => r.data),
  updateSharedBook: (id: string, data: {
    borrowCycleDays?: number;
    preferredExchangeThemes?: BookTheme[];
    acceptTransfer?: boolean;
    notes?: string;
  }) => api.put<SharedBook>(`/sharing/books/${id}`, data).then(r => r.data),
  removeSharedBook: (id: string) => api.delete(`/sharing/books/${id}`).then(r => r.data),

  getExchanges: (params?: { status?: string; type?: 'sent' | 'received' }) =>
    api.get<ExchangeInvitation[]>('/sharing/exchanges', { params }).then(r => r.data),
  createExchange: (data: {
    circleId: string;
    targetBookId: string;
    offeredBookId: string;
    expectedExchangeDate: string;
    message?: string;
  }) => api.post<ExchangeInvitation>('/sharing/exchanges', data).then(r => r.data),
  acceptExchange: (id: string) =>
    api.post<ExchangeInvitation>(`/sharing/exchanges/${id}/accept`).then(r => r.data),
  rejectExchange: (id: string, rejectReason?: string) =>
    api.post<ExchangeInvitation>(`/sharing/exchanges/${id}/reject`, { rejectReason }).then(r => r.data),
  cancelExchange: (id: string) =>
    api.post<ExchangeInvitation>(`/sharing/exchanges/${id}/cancel`).then(r => r.data),
  completeExchange: (id: string) =>
    api.post<ExchangeInvitation>(`/sharing/exchanges/${id}/complete`).then(r => r.data),

  getCurrentUser: () =>
    api.get<{ userId: string; userName: string }>('/sharing/current-user').then(r => r.data)
};

export const assessmentApi = {
  generate: (data: { periodType: AssessmentPeriodType; periodStart?: string; periodEnd?: string }) =>
    api.post<AssessmentReport>('/assessments/generate', data).then(r => r.data),
  getList: (params?: { periodType?: string; status?: string }) =>
    api.get<AssessmentReport[]>('/assessments', { params }).then(r => r.data),
  getLatest: () =>
    api.get<AssessmentReport>('/assessments/latest').then(r => r.data),
  getDetail: (id: string) =>
    api.get<AssessmentReport>(`/assessments/${id}`).then(r => r.data),
  lock: (id: string) =>
    api.patch<AssessmentReport>(`/assessments/${id}/lock`).then(r => r.data),
  addNote: (id: string, note: string) =>
    api.patch<AssessmentReport>(`/assessments/${id}/notes`, { note }).then(r => r.data),
  updateNote: (id: string, noteIndex: number, note: string) =>
    api.patch<AssessmentReport>(`/assessments/${id}/notes/${noteIndex}`, { note }).then(r => r.data),
  deleteNote: (id: string, noteIndex: number) =>
    api.delete<AssessmentReport>(`/assessments/${id}/notes/${noteIndex}`).then(r => r.data),
  updateInterventionStatus: (id: string, interventionIndex: number, status: string) =>
    api.patch<AssessmentReport>(`/assessments/${id}/interventions/${interventionIndex}/status`, { status }).then(r => r.data),
  getOverview: () =>
    api.get<AssessmentOverview>('/assessments/summary/overview').then(r => r.data)
};
