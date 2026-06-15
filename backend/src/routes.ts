import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  books, borrowRecords, readingRecords, babyInfo, themes, interactionTypes, rotationPlans,
  sharingCircles, sharedBooks, exchangeInvitations, CURRENT_USER_ID, CURRENT_USER_NAME, assessmentReports,
  bookCareProfiles, bookConditions, damageTypes, damageRiskLevels
} from './data';
import {
  Book, BookStatus, BorrowRecord, ReadingRecord, RotationPlan, RotationItemStatus, RotationPlanStats,
  SharingCircle, SharedBook, ExchangeInvitation, ExchangeInvitationStatus, BookTheme, SharingStats,
  AssessmentReport, AssessmentPeriodType, AssessmentReportStatus,
  BookCareProfile, DamageRecord, RepairRecord, CareReminder, BookCondition, DamageType, DamageRiskLevel,
  RepairStatus, CareStats
} from './types';
import { recommendBooks, calculateBabyAgeMonths, isOverdue, getWeekRange, generateRotationPlanItems,
  calculateReadingStability, calculateThemeBalance, calculateAgeMatch, calculateInteractionParticipation,
  calculateRotationCompletion, calculateExchangeExpansion, generateAlerts, generateInterventions,
  buildSnapshot, getOverallLevel, getPeriodRange, updateCareProfileOnAction, calculateDamageRiskLevel,
  calculateBookCondition, generateCleaningReminder, isDateValid, isDateRangeValid,
  isValidBookCondition, isValidDamageType, isValidSeverity, isValidRepairStatus, formatDate
} from './utils';

const router = Router();

router.get('/baby-info', (req, res) => {
  const age = calculateBabyAgeMonths(babyInfo.birthDate);
  res.json({ ...babyInfo, ageMonths: age });
});

router.put('/baby-info', (req, res) => {
  const { name, birthDate, gender } = req.body;
  if (name !== undefined) babyInfo.name = name;
  if (birthDate !== undefined) babyInfo.birthDate = birthDate;
  if (gender !== undefined) babyInfo.gender = gender;
  const age = calculateBabyAgeMonths(babyInfo.birthDate);
  res.json({ ...babyInfo, ageMonths: age });
});

router.get('/books', (req, res) => {
  const { status, theme, search } = req.query;
  let filtered = [...books];
  
  if (status) {
    filtered = filtered.filter(b => b.status === status);
  }
  if (theme) {
    filtered = filtered.filter(b => b.theme === theme);
  }
  if (search) {
    const s = String(search).toLowerCase();
    filtered = filtered.filter(b => 
      b.title.toLowerCase().includes(s) || 
      b.author.toLowerCase().includes(s)
    );
  }
  
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(filtered);
});

router.get('/books/:id', (req, res) => {
  const book = books.find(b => b.id === req.params.id);
  if (!book) {
    res.status(404).json({ error: '绘本不存在' });
    return;
  }
  res.json(book);
});

router.post('/books', (req, res) => {
  const { title } = req.body;
  if (!title || !String(title).trim()) {
    res.status(400).json({ error: '绘本名称不能为空' });
    return;
  }
  const now = new Date().toISOString();
  const newBook: Book = {
    id: uuidv4(),
    ...req.body,
    title: String(title).trim(),
    status: req.body.status || '在家',
    createdAt: now,
    updatedAt: now
  };
  books.push(newBook);
  res.status(201).json(newBook);
});

router.put('/books/:id', (req, res) => {
  const index = books.findIndex(b => b.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: '绘本不存在' });
    return;
  }
  if (req.body.title !== undefined && !String(req.body.title).trim()) {
    res.status(400).json({ error: '绘本名称不能为空' });
    return;
  }
  books[index] = {
    ...books[index],
    ...req.body,
    id: books[index].id,
    createdAt: books[index].createdAt,
    updatedAt: new Date().toISOString()
  };
  res.json(books[index]);
});

router.delete('/books/:id', (req, res) => {
  const index = books.findIndex(b => b.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: '绘本不存在' });
    return;
  }
  books.splice(index, 1);
  res.json({ message: '删除成功' });
});

router.patch('/books/:id/status', (req, res) => {
  const { status } = req.body;
  const book = books.find(b => b.id === req.params.id);
  if (!book) {
    res.status(404).json({ error: '绘本不存在' });
    return;
  }
  book.status = status as BookStatus;
  book.updatedAt = new Date().toISOString();
  res.json(book);
});

router.get('/borrow-records', (req, res) => {
  const { status, bookId } = req.query;
  let records = [...borrowRecords];
  
  for (const record of records) {
    if (record.actualReturnDate) {
      record.status = '已归还';
    } else if (record.status === '借出中' && isOverdue(record.expectedReturnDate)) {
      record.status = '逾期';
    }
  }
  
  if (status) {
    records = records.filter(b => b.status === status);
  }
  if (bookId) {
    records = records.filter(b => b.bookId === bookId);
  }
  
  records.sort((a, b) => new Date(b.borrowDate).getTime() - new Date(a.borrowDate).getTime());
  res.json(records);
});

router.post('/borrow-records', (req, res) => {
  const { bookId, borrower, borrowerPhone, borrowDate, expectedReturnDate, notes } = req.body;
  
  const book = books.find(b => b.id === bookId);
  if (!book) {
    res.status(404).json({ error: '绘本不存在' });
    return;
  }
  if (book.status !== '在家') {
    res.status(400).json({ error: '绘本当前状态不可借出' });
    return;
  }

  const careProfile = bookCareProfiles.find(p => p.bookId === bookId);
  if (careProfile) {
    if (careProfile.isCirculationPaused) {
      res.status(400).json({ error: `该绘本已暂停流转${careProfile.pauseReason ? '：' + careProfile.pauseReason : ''}，预计恢复时间：${careProfile.expectedResumeDate || '待定'}` });
      return;
    }
    if (careProfile.damageRiskLevel === '极高') {
      res.status(400).json({ error: `该绘本损耗风险等级为"极高"，暂不可借出，请先进行养护处理` });
      return;
    }
  }

  if (!borrower || !String(borrower).trim()) {
    res.status(400).json({ error: '借阅人不能为空' });
    return;
  }
  if (!expectedReturnDate || !isDateValid(String(expectedReturnDate))) {
    res.status(400).json({ error: '预计归还日期格式无效' });
    return;
  }
  const finalBorrowDate = borrowDate || new Date().toISOString().split('T')[0];
  if (!isDateValid(String(finalBorrowDate))) {
    res.status(400).json({ error: '借出日期格式无效' });
    return;
  }
  if (String(expectedReturnDate) < String(finalBorrowDate)) {
    res.status(400).json({ error: '预计归还日期不能早于借出日期' });
    return;
  }
  
  const newRecord: BorrowRecord = {
    id: uuidv4(),
    bookId,
    bookTitle: book.title,
    borrower: String(borrower).trim(),
    borrowerPhone: borrowerPhone ? String(borrowerPhone).trim() : undefined,
    borrowDate: finalBorrowDate,
    expectedReturnDate: String(expectedReturnDate),
    status: '借出中',
    notes: notes ? String(notes).trim() : undefined,
    createdAt: new Date().toISOString()
  };
  
  borrowRecords.push(newRecord);
  book.status = '借出';
  book.updatedAt = new Date().toISOString();

  if (careProfile) {
    updateCareProfileOnAction(careProfile, book, 'borrow');
  }
  
  res.status(201).json(newRecord);
});

router.post('/borrow-records/:id/return', (req, res) => {
  const record = borrowRecords.find(b => b.id === req.params.id);
  if (!record) {
    res.status(404).json({ error: '借阅记录不存在' });
    return;
  }
  
  const { returnDate } = req.body;
  const finalReturnDate = returnDate || new Date().toISOString().split('T')[0];
  if (!isDateValid(String(finalReturnDate))) {
    res.status(400).json({ error: '归还日期格式无效' });
    return;
  }
  if (String(finalReturnDate) < record.borrowDate) {
    res.status(400).json({ error: '归还日期不能早于借出日期' });
    return;
  }

  record.actualReturnDate = finalReturnDate;
  record.status = '已归还';
  
  const book = books.find(b => b.id === record.bookId);
  if (book) {
    book.status = '在家';
    book.updatedAt = new Date().toISOString();

    const careProfile = bookCareProfiles.find(p => p.bookId === book.id);
    if (careProfile) {
      updateCareProfileOnAction(careProfile, book, 'return');
    }
  }
  
  res.json(record);
});

router.delete('/borrow-records/:id', (req, res) => {
  const index = borrowRecords.findIndex(b => b.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: '借阅记录不存在' });
    return;
  }
  borrowRecords.splice(index, 1);
  res.json({ message: '删除成功' });
});

router.get('/reading-records', (req, res) => {
  let filtered = [...readingRecords];
  filtered.sort((a, b) => new Date(b.readDate).getTime() - new Date(a.readDate).getTime());
  res.json(filtered);
});

router.post('/reading-records', (req, res) => {
  const { bookId, readDate, duration, babyAgeMonths, reaction, notes } = req.body;
  
  const book = books.find(b => b.id === bookId);
  if (!book) {
    res.status(404).json({ error: '绘本不存在' });
    return;
  }

  if (duration === undefined || duration === null) {
    res.status(400).json({ error: '阅读时长为必填项' });
    return;
  }
  const durationNum = Math.max(0, Number(duration) || 0);
  const finalReadDate = readDate || new Date().toISOString().split('T')[0];
  if (!isDateValid(String(finalReadDate))) {
    res.status(400).json({ error: '阅读日期格式无效' });
    return;
  }
  
  const newRecord: ReadingRecord = {
    id: uuidv4(),
    bookId,
    bookTitle: book.title,
    readDate: finalReadDate,
    duration: durationNum,
    babyAgeMonths: Number(babyAgeMonths) || calculateBabyAgeMonths(babyInfo.birthDate),
    reaction: reaction ? String(reaction).trim() : undefined,
    notes: notes ? String(notes).trim() : undefined,
    createdAt: new Date().toISOString()
  };
  
  readingRecords.push(newRecord);

  const careProfile = bookCareProfiles.find(p => p.bookId === bookId);
  if (careProfile) {
    updateCareProfileOnAction(careProfile, book, 'reading');
  }
  
  const { start, end } = getWeekRange(new Date());
  const currentPlan = rotationPlans.find(p => 
    p.weekStartDate === start && p.weekEndDate === end && p.status === 'active'
  );
  
  if (currentPlan) {
    const planItem = currentPlan.items.find(i => i.bookId === bookId && i.status !== '已读' && i.status !== '跳过');
    if (planItem) {
      planItem.status = '已读';
      planItem.readDate = finalReadDate;
      planItem.readingRecordId = newRecord.id;
      planItem.updatedAt = new Date().toISOString();
      currentPlan.updatedAt = new Date().toISOString();
      
      const allCompleted = currentPlan.items.every(i => i.status === '已读' || i.status === '跳过');
      if (allCompleted) {
        currentPlan.status = 'completed';
      }
    }
  }
  
  res.status(201).json(newRecord);
});

router.delete('/reading-records/:id', (req, res) => {
  const index = readingRecords.findIndex(r => r.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: '阅读记录不存在' });
    return;
  }
  readingRecords.splice(index, 1);
  res.json({ message: '删除成功' });
});

router.get('/recommendations', (req, res) => {
  const babyAge = calculateBabyAgeMonths(babyInfo.birthDate);
  const readBookIds = [...new Set(readingRecords.map(r => r.bookId))];
  
  const themeCount: { [key: string]: number } = {};
  for (const record of readingRecords) {
    const book = books.find(b => b.id === record.bookId);
    if (book) {
      themeCount[book.theme] = (themeCount[book.theme] || 0) + 1;
    }
  }
  const themePreferences = Object.entries(themeCount)
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count);
  
  const recommendations = recommendBooks(books, babyAge, readBookIds, themePreferences);
  
  res.json({
    babyAgeMonths: babyAge,
    themePreferences,
    recommendations
  });
});

router.get('/statistics', (req, res) => {
  refreshSharedBookRefs();
  const totalBooks = books.length;
  const borrowedBooksCount = books.filter(b => b.status === '借出').length;
  const totalBorrows = borrowRecords.length;
  
  const returnedCount = borrowRecords.filter(b => b.status === '已归还').length;
  const closedBorrows = borrowRecords.filter(b => b.status !== '借出中').length;
  const returnRate = closedBorrows > 0 ? Math.round((returnedCount / closedBorrows) * 100) : 0;
  
  const totalReadingTime = readingRecords.reduce((sum, r) => sum + Math.max(0, r.duration), 0);
  
  const monthlyReadingFrequency: { month: number; count: number }[] = [];
  const monthMap: { [key: number]: number } = {};
  for (const record of readingRecords) {
    const month = record.babyAgeMonths;
    monthMap[month] = (monthMap[month] || 0) + 1;
  }
  for (const [month, count] of Object.entries(monthMap)) {
    monthlyReadingFrequency.push({ month: Number(month), count });
  }
  monthlyReadingFrequency.sort((a, b) => a.month - b.month);
  
  const popularThemes: { theme: string; count: number }[] = [];
  const themeMap: { [key: string]: number } = {};
  for (const record of readingRecords) {
    const book = books.find(b => b.id === record.bookId);
    if (book) {
      themeMap[book.theme] = (themeMap[book.theme] || 0) + 1;
    }
  }
  for (const [theme, count] of Object.entries(themeMap)) {
    popularThemes.push({ theme: theme as any, count });
  }
  popularThemes.sort((a, b) => b.count - a.count);
  
  const now = new Date();
  const idleBooks = books.filter(book => {
    const lastRead = readingRecords
      .filter(r => r.bookId === book.id)
      .sort((a, b) => new Date(b.readDate).getTime() - new Date(a.readDate).getTime())[0];
    
    if (!lastRead) {
      const purchaseDate = new Date(book.purchaseDate);
      const daysSincePurchase = (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSincePurchase > 60 && book.status === '在家';
    }
    
    const lastReadDate = new Date(lastRead.readDate);
    const daysSinceLastRead = (now.getTime() - lastReadDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLastRead > 60 && book.status === '在家';
  });

  const sharedBooksCount = sharedBooks.length;
  const totalExchangesCount = exchangeInvitations.length;
  const completedExchangesCount = exchangeInvitations.filter(i => i.status === '已完成').length;
  const exchangeCompletionRate = totalExchangesCount > 0
    ? Math.round((completedExchangesCount / totalExchangesCount) * 100)
    : 0;
  const pendingInvitationsCount = exchangeInvitations.filter(i =>
    i.status === '待确认' &&
    (i.targetBook.ownerId === CURRENT_USER_ID || i.initiatorId === CURRENT_USER_ID)
  ).length;
  const activeCirclesCount = sharingCircles.length;

  const popularExchangeThemeMap: { [key: string]: number } = {};
  for (const sb of sharedBooks) {
    for (const theme of sb.preferredExchangeThemes) {
      popularExchangeThemeMap[theme] = (popularExchangeThemeMap[theme] || 0) + 1;
    }
  }
  const popularExchangeThemes = Object.entries(popularExchangeThemeMap)
    .map(([theme, count]) => ({ theme: theme as BookTheme, count }))
    .sort((a, b) => b.count - a.count);

  const sharingStats: SharingStats = {
    sharedBooksCount,
    exchangeCompletionRate,
    popularExchangeThemes,
    pendingInvitationsCount,
    activeCirclesCount,
    totalExchangesCount,
    completedExchangesCount
  };
  
  res.json({
    totalBooks,
    totalBorrows,
    returnRate,
    totalReadingTime,
    monthlyReadingFrequency,
    popularThemes,
    idleBooks,
    borrowedBooksCount,
    sharingStats
  });
});

router.get('/themes', (req, res) => {
  res.json(themes);
});

router.get('/interaction-types', (req, res) => {
  res.json(interactionTypes);
});

router.get('/rotation-plans', (req, res) => {
  const sorted = [...rotationPlans].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  res.json(sorted);
});

router.get('/rotation-plans/current', (req, res) => {
  const { start, end } = getWeekRange(new Date());
  
  let currentPlan = rotationPlans.find(p => 
    p.weekStartDate === start && p.weekEndDate === end && (p.status === 'active' || p.status === 'completed')
  );
  
  if (!currentPlan) {
    currentPlan = rotationPlans
      .filter(p => p.status === 'active')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }
  
  if (currentPlan) {
    res.json(currentPlan);
  } else {
    res.status(404).json({ error: '暂无有效的轮换计划，请先生成' });
  }
});

router.get('/rotation-plans/:id', (req, res) => {
  const plan = rotationPlans.find(p => p.id === req.params.id);
  if (!plan) {
    res.status(404).json({ error: '轮换计划不存在' });
    return;
  }
  res.json(plan);
});

router.post('/rotation-plans/generate', (req, res) => {
  const { weekSize = 5 } = req.body;
  const { start, end } = getWeekRange(new Date());
  const babyAge = calculateBabyAgeMonths(babyInfo.birthDate);
  
  const existingPlan = rotationPlans.find(p => 
    p.weekStartDate === start && p.weekEndDate === end
  );
  
  if (existingPlan) {
    res.status(400).json({ error: '本周轮换计划已存在' });
    return;
  }
  
  const items = generateRotationPlanItems(
    books,
    babyAge,
    readingRecords.map(r => ({ bookId: r.bookId, readDate: r.readDate })),
    Number(weekSize) || 5,
    bookCareProfiles
  );
  
  if (items.length === 0) {
    res.status(400).json({ error: '没有可用于轮换的绘本，请检查绘本状态' });
    return;
  }
  
  const now = new Date().toISOString();
  const newPlan: RotationPlan = {
    id: uuidv4(),
    weekStartDate: start,
    weekEndDate: end,
    babyAgeMonths: babyAge,
    status: 'active',
    items: items.map(item => ({
      ...item,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    })),
    createdAt: now,
    updatedAt: now
  };
  
  rotationPlans.push(newPlan);
  res.status(201).json(newPlan);
});

router.patch('/rotation-plans/:planId/items/:itemId/focus', (req, res) => {
  const plan = rotationPlans.find(p => p.id === req.params.planId);
  if (!plan) {
    res.status(404).json({ error: '轮换计划不存在' });
    return;
  }
  
  const item = plan.items.find(i => i.id === req.params.itemId);
  if (!item) {
    res.status(404).json({ error: '计划项不存在' });
    return;
  }
  
  const { isFocus } = req.body;
  item.isFocus = isFocus !== undefined ? Boolean(isFocus) : !item.isFocus;
  item.updatedAt = new Date().toISOString();
  plan.updatedAt = new Date().toISOString();
  
  res.json(item);
});

router.patch('/rotation-plans/:planId/items/:itemId/skip', (req, res) => {
  const plan = rotationPlans.find(p => p.id === req.params.planId);
  if (!plan) {
    res.status(404).json({ error: '轮换计划不存在' });
    return;
  }
  
  const item = plan.items.find(i => i.id === req.params.itemId);
  if (!item) {
    res.status(404).json({ error: '计划项不存在' });
    return;
  }
  
  const { skipReason } = req.body;
  const reason = String(skipReason || '').trim();
  if (!reason) {
    res.status(400).json({ error: '跳过原因不能为空' });
    return;
  }
  
  item.status = '跳过';
  item.skipReason = reason;
  item.updatedAt = new Date().toISOString();
  plan.updatedAt = new Date().toISOString();
  
  res.json(item);
});

router.patch('/rotation-plans/:planId/items/:itemId/unskip', (req, res) => {
  const plan = rotationPlans.find(p => p.id === req.params.planId);
  if (!plan) {
    res.status(404).json({ error: '轮换计划不存在' });
    return;
  }
  
  const item = plan.items.find(i => i.id === req.params.itemId);
  if (!item) {
    res.status(404).json({ error: '计划项不存在' });
    return;
  }
  
  item.status = '待读';
  item.skipReason = undefined;
  item.updatedAt = new Date().toISOString();
  plan.updatedAt = new Date().toISOString();
  
  res.json(item);
});

router.patch('/rotation-plans/:planId/items/:itemId/status', (req, res) => {
  const plan = rotationPlans.find(p => p.id === req.params.planId);
  if (!plan) {
    res.status(404).json({ error: '轮换计划不存在' });
    return;
  }
  
  const item = plan.items.find(i => i.id === req.params.itemId);
  if (!item) {
    res.status(404).json({ error: '计划项不存在' });
    return;
  }
  
  const { status, readingRecordId, readDate } = req.body;
  const validStatuses: RotationItemStatus[] = ['待读', '已读', '跳过', '重点'];
  if (!validStatuses.includes(status as RotationItemStatus)) {
    res.status(400).json({ error: '无效的状态值，必须为：待读、已读、跳过、重点' });
    return;
  }
  
  item.status = status as RotationItemStatus;
  if (readingRecordId) item.readingRecordId = readingRecordId;
  if (readDate) item.readDate = readDate;
  item.updatedAt = new Date().toISOString();
  plan.updatedAt = new Date().toISOString();
  
  const allCompleted = plan.items.every(i => i.status === '已读' || i.status === '跳过');
  if (allCompleted) {
    plan.status = 'completed';
  }
  
  res.json(item);
});

router.get('/rotation-plans/stats/summary', (req, res) => {
  const { start, end } = getWeekRange(new Date());
  
  let currentPlan = rotationPlans.find(p => 
    p.weekStartDate === start && p.weekEndDate === end
  );
  
  if (!currentPlan) {
    currentPlan = rotationPlans
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }
  
  if (!currentPlan) {
    res.json({
      hasPlan: false,
      completionRate: 0,
      hitRate: 0,
      readCount: 0,
      totalCount: 0,
      skippedCount: 0,
      skippedThemes: []
    });
    return;
  }
  
  const items = currentPlan.items;
  const totalCount = items.length;
  const readCount = items.filter(i => i.status === '已读').length;
  const skippedCount = items.filter(i => i.status === '跳过').length;
  const nonSkippedCount = totalCount - skippedCount;
  
  const completionRate = totalCount > 0 
    ? Math.round((readCount / totalCount) * 100) 
    : 0;
  
  const hitRate = nonSkippedCount > 0 
    ? Math.round((readCount / nonSkippedCount) * 100) 
    : 0;
  
  const skippedThemesMap: { [key: string]: number } = {};
  items.filter(i => i.status === '跳过').forEach(i => {
    const theme = i.book.theme;
    skippedThemesMap[theme] = (skippedThemesMap[theme] || 0) + 1;
  });
  
  const skippedThemes = Object.entries(skippedThemesMap)
    .map(([theme, count]) => ({ theme: theme as any, count }))
    .sort((a, b) => b.count - a.count);
  
  res.json({
    hasPlan: true,
    planId: currentPlan.id,
    weekStartDate: currentPlan.weekStartDate,
    weekEndDate: currentPlan.weekEndDate,
    totalCount,
    readCount,
    skippedCount,
    completionRate,
    hitRate,
    skippedThemes
  });
});

// ==================== 共享模块辅助函数 ====================

const refreshSharedBookRefs = () => {
  for (const sb of sharedBooks) {
    const freshBook = books.find(b => b.id === sb.bookId);
    if (freshBook) sb.book = freshBook;
  }
  for (const ei of exchangeInvitations) {
    const t = sharedBooks.find(sb => sb.id === ei.targetBookId);
    const o = sharedBooks.find(sb => sb.id === ei.offeredBookId);
    if (t) ei.targetBook = t;
    if (o) ei.offeredBook = o;
  }
};

// ==================== 共享圈 API ====================

router.get('/sharing/circles', (req, res) => {
  const myCircles = sharingCircles.filter(c =>
    c.members.some(m => m.id === CURRENT_USER_ID)
  );
  const sorted = [...myCircles].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  res.json(sorted);
});

router.get('/sharing/circles/:id', (req, res) => {
  const circle = sharingCircles.find(c => c.id === req.params.id);
  if (!circle) {
    res.status(404).json({ error: '共享圈不存在' });
    return;
  }
  if (!circle.members.some(m => m.id === CURRENT_USER_ID)) {
    res.status(403).json({ error: '您不是该共享圈成员' });
    return;
  }
  res.json(circle);
});

router.post('/sharing/circles', (req, res) => {
  const { name, description } = req.body;
  const circleName = String(name || '').trim();
  if (!circleName) {
    res.status(400).json({ error: '共享圈名称不能为空' });
    return;
  }
  const now = new Date().toISOString();
  const newCircle: SharingCircle = {
    id: uuidv4(),
    name: circleName,
    description: description ? String(description).trim() : undefined,
    creatorId: CURRENT_USER_ID,
    creatorName: CURRENT_USER_NAME,
    members: [
      { id: CURRENT_USER_ID, name: CURRENT_USER_NAME, role: '创建者', joinedAt: now }
    ],
    createdAt: now,
    updatedAt: now
  };
  sharingCircles.push(newCircle);
  res.status(201).json(newCircle);
});

router.post('/sharing/circles/:id/join', (req, res) => {
  const circle = sharingCircles.find(c => c.id === req.params.id);
  if (!circle) {
    res.status(404).json({ error: '共享圈不存在' });
    return;
  }
  const { memberName } = req.body;
  const name = String(memberName || '').trim();
  if (!name) {
    res.status(400).json({ error: '成员名称不能为空' });
    return;
  }
  if (circle.members.some(m => m.name === name)) {
    res.status(400).json({ error: '该成员已在共享圈中' });
    return;
  }
  const now = new Date().toISOString();
  const newMemberId = 'user-' + uuidv4().slice(0, 8);
  circle.members.push({
    id: newMemberId,
    name,
    role: '成员',
    joinedAt: now
  });
  circle.updatedAt = now;
  res.status(201).json(circle);
});

router.delete('/sharing/circles/:id', (req, res) => {
  const index = sharingCircles.findIndex(c => c.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: '共享圈不存在' });
    return;
  }
  const circle = sharingCircles[index];
  if (circle.creatorId !== CURRENT_USER_ID) {
    res.status(403).json({ error: '只有创建者可以删除共享圈' });
    return;
  }
  const circleBooksToRemove = sharedBooks.filter(sb => sb.circleId === circle.id).map(sb => sb.id);
  const newSharedBooks = sharedBooks.filter(sb => sb.circleId !== circle.id);
  const newExchanges = exchangeInvitations.filter(ei => !circleBooksToRemove.includes(ei.targetBookId) && !circleBooksToRemove.includes(ei.offeredBookId));
  sharedBooks.splice(0, sharedBooks.length, ...newSharedBooks);
  exchangeInvitations.splice(0, exchangeInvitations.length, ...newExchanges);
  sharingCircles.splice(index, 1);
  res.json({ message: '删除成功' });
});

// ==================== 共享书单 API ====================

router.get('/sharing/books', (req, res) => {
  refreshSharedBookRefs();
  const { circleId, theme, minMonth, maxMonth, interactionType, borrowStatus, ownerId } = req.query;
  let myCircles = sharingCircles.filter(c =>
    c.members.some(m => m.id === CURRENT_USER_ID)
  ).map(c => c.id);

  let filtered = sharedBooks.filter(sb => myCircles.includes(sb.circleId));

  if (circleId) {
    filtered = filtered.filter(sb => sb.circleId === String(circleId));
  }
  if (theme) {
    filtered = filtered.filter(sb => sb.book.theme === theme);
  }
  if (minMonth) {
    filtered = filtered.filter(sb => sb.book.maxMonth >= Number(minMonth));
  }
  if (maxMonth) {
    filtered = filtered.filter(sb => sb.book.minMonth <= Number(maxMonth));
  }
  if (interactionType) {
    filtered = filtered.filter(sb => sb.book.interactionType === interactionType);
  }
  if (borrowStatus) {
    filtered = filtered.filter(sb => sb.borrowStatus === borrowStatus);
  }
  if (ownerId) {
    filtered = filtered.filter(sb => sb.ownerId === String(ownerId));
  }

  filtered.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  res.json(filtered);
});

router.get('/sharing/books/mine', (req, res) => {
  refreshSharedBookRefs();
  const mine = sharedBooks
    .filter(sb => sb.ownerId === CURRENT_USER_ID)
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  res.json(mine);
});

router.post('/sharing/books', (req, res) => {
  const {
    circleId, bookId, borrowCycleDays, preferredExchangeThemes, acceptTransfer, notes
  } = req.body;

  if (!circleId || !bookId) {
    res.status(400).json({ error: '共享圈ID和绘本ID不能为空' });
    return;
  }

  const circle = sharingCircles.find(c => c.id === String(circleId));
  if (!circle) {
    res.status(404).json({ error: '共享圈不存在' });
    return;
  }
  if (!circle.members.some(m => m.id === CURRENT_USER_ID)) {
    res.status(403).json({ error: '您不是该共享圈成员' });
    return;
  }

  const book = books.find(b => b.id === String(bookId));
  if (!book) {
    res.status(404).json({ error: '绘本不存在' });
    return;
  }

  if (book.status === '借出' || book.status === '预留' || book.status === '转送') {
    res.status(400).json({ error: '已借出、预留或转送的绘本不能加入共享书单' });
    return;
  }

  const careProfile = bookCareProfiles.find(p => p.bookId === String(bookId));
  if (careProfile) {
    if (careProfile.isCirculationPaused) {
      res.status(400).json({ error: `该绘本已暂停流转${careProfile.pauseReason ? '：' + careProfile.pauseReason : ''}，不能加入共享书单` });
      return;
    }
    if (careProfile.damageRiskLevel === '极高') {
      res.status(400).json({ error: '该绘本损耗风险等级为"极高"，不能加入共享书单，请先进行养护处理' });
      return;
    }
  }

  const exists = sharedBooks.find(sb => sb.circleId === String(circleId) && sb.bookId === String(bookId));
  if (exists) {
    res.status(400).json({ error: '该绘本已在此共享圈中共享' });
    return;
  }

  const cycle = Math.max(1, Number(borrowCycleDays) || 14);
  const themes = Array.isArray(preferredExchangeThemes) ? preferredExchangeThemes as BookTheme[] : [];
  const accept = acceptTransfer !== undefined ? Boolean(acceptTransfer) : false;

  const now = new Date().toISOString();
  const newSharedBook: SharedBook = {
    id: uuidv4(),
    circleId: String(circleId),
    bookId: String(bookId),
    book,
    ownerId: CURRENT_USER_ID,
    ownerName: CURRENT_USER_NAME,
    borrowCycleDays: cycle,
    preferredExchangeThemes: themes,
    acceptTransfer: accept,
    notes: notes ? String(notes).trim() : undefined,
    borrowStatus: '可借',
    addedAt: now,
    updatedAt: now
  };
  sharedBooks.push(newSharedBook);
  res.status(201).json(newSharedBook);
});

router.put('/sharing/books/:id', (req, res) => {
  const index = sharedBooks.findIndex(sb => sb.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: '共享绘本不存在' });
    return;
  }
  const sb = sharedBooks[index];
  if (sb.ownerId !== CURRENT_USER_ID) {
    res.status(403).json({ error: '只有所有者可以编辑共享绘本信息' });
    return;
  }

  const { borrowCycleDays, preferredExchangeThemes, acceptTransfer, notes } = req.body;
  if (borrowCycleDays !== undefined) {
    sb.borrowCycleDays = Math.max(1, Number(borrowCycleDays) || 14);
  }
  if (preferredExchangeThemes !== undefined && Array.isArray(preferredExchangeThemes)) {
    sb.preferredExchangeThemes = preferredExchangeThemes as BookTheme[];
  }
  if (acceptTransfer !== undefined) {
    sb.acceptTransfer = Boolean(acceptTransfer);
  }
  if (notes !== undefined) {
    sb.notes = String(notes).trim() || undefined;
  }
  sb.updatedAt = new Date().toISOString();
  sharedBooks[index] = { ...sb, book: books.find(b => b.id === sb.bookId) || sb.book };
  res.json(sharedBooks[index]);
});

router.delete('/sharing/books/:id', (req, res) => {
  const index = sharedBooks.findIndex(sb => sb.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: '共享绘本不存在' });
    return;
  }
  const sb = sharedBooks[index];
  if (sb.ownerId !== CURRENT_USER_ID) {
    res.status(403).json({ error: '只有所有者可以移除共享绘本' });
    return;
  }
  if (sb.borrowStatus === '借出中') {
    res.status(400).json({ error: '绘本借出中，无法移除' });
    return;
  }
  const pendingInvitations = exchangeInvitations.filter(ei =>
    (ei.targetBookId === sb.id || ei.offeredBookId === sb.id) &&
    (ei.status === '待确认' || ei.status === '已接受')
  );
  if (pendingInvitations.length > 0) {
    res.status(400).json({ error: '存在待处理的换书邀约，无法移除' });
    return;
  }
  sharedBooks.splice(index, 1);
  const filteredExchanges = exchangeInvitations.filter(ei =>
    ei.targetBookId !== sb.id && ei.offeredBookId !== sb.id
  );
  exchangeInvitations.splice(0, exchangeInvitations.length, ...filteredExchanges);
  res.json({ message: '移除成功' });
});

// ==================== 换书邀约 API ====================

router.get('/sharing/exchanges', (req, res) => {
  refreshSharedBookRefs();
  const { status, type } = req.query;

  let filtered = [...exchangeInvitations];

  if (type === 'sent') {
    filtered = filtered.filter(ei => ei.initiatorId === CURRENT_USER_ID);
  } else if (type === 'received') {
    filtered = filtered.filter(ei => ei.targetBook.ownerId === CURRENT_USER_ID);
  } else {
    filtered = filtered.filter(ei =>
      ei.initiatorId === CURRENT_USER_ID || ei.targetBook.ownerId === CURRENT_USER_ID
    );
  }

  if (status) {
    filtered = filtered.filter(ei => ei.status === status);
  }

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(filtered);
});

router.post('/sharing/exchanges', (req, res) => {
  const { circleId, targetBookId, offeredBookId, expectedExchangeDate, message } = req.body;

  if (!circleId || !targetBookId || !offeredBookId || !expectedExchangeDate) {
    res.status(400).json({ error: '共享圈、目标绘本、拟交换绘本、期望交换时间均为必填项' });
    return;
  }

  const targetBook = sharedBooks.find(sb => sb.id === String(targetBookId));
  if (!targetBook) {
    res.status(404).json({ error: '目标绘本不存在' });
    return;
  }

  const offeredBook = sharedBooks.find(sb => sb.id === String(offeredBookId));
  if (!offeredBook) {
    res.status(404).json({ error: '拟交换绘本不存在' });
    return;
  }

  if (targetBookId === offeredBookId) {
    res.status(400).json({ error: '目标绘本和拟交换绘本不能相同' });
    return;
  }

  if (targetBook.circleId !== String(circleId) || offeredBook.circleId !== String(circleId)) {
    res.status(400).json({ error: '两本绘本必须属于同一共享圈' });
    return;
  }

  if (offeredBook.ownerId !== CURRENT_USER_ID) {
    res.status(403).json({ error: '只能使用自己的共享绘本发起邀约' });
    return;
  }

  if (targetBook.ownerId === CURRENT_USER_ID) {
    res.status(400).json({ error: '不能向自己发起换书邀约' });
    return;
  }

  const invalidStatuses = ['借出中', '已预留', '已转送'];
  if (invalidStatuses.includes(targetBook.borrowStatus)) {
    res.status(400).json({ error: '目标绘本已借出、预留或转送，无法发起邀约' });
    return;
  }
  if (invalidStatuses.includes(offeredBook.borrowStatus)) {
    res.status(400).json({ error: '拟交换绘本已借出、预留或转送，无法发起邀约' });
    return;
  }

  const targetCareProfile = bookCareProfiles.find(p => p.bookId === targetBook.bookId);
  if (targetCareProfile) {
    if (targetCareProfile.isCirculationPaused) {
      res.status(400).json({ error: `目标绘本已暂停流转${targetCareProfile.pauseReason ? '：' + targetCareProfile.pauseReason : ''}，无法发起换书邀约` });
      return;
    }
    if (targetCareProfile.damageRiskLevel === '极高') {
      res.status(400).json({ error: '目标绘本损耗风险等级为"极高"，无法发起换书邀约' });
      return;
    }
  }
  const offeredCareProfile = bookCareProfiles.find(p => p.bookId === offeredBook.bookId);
  if (offeredCareProfile) {
    if (offeredCareProfile.isCirculationPaused) {
      res.status(400).json({ error: `拟交换绘本已暂停流转${offeredCareProfile.pauseReason ? '：' + offeredCareProfile.pauseReason : ''}，无法发起换书邀约` });
      return;
    }
    if (offeredCareProfile.damageRiskLevel === '极高') {
      res.status(400).json({ error: '拟交换绘本损耗风险等级为"极高"，无法发起换书邀约' });
      return;
    }
  }

  const duplicatePending = exchangeInvitations.find(ei =>
    ei.targetBookId === String(targetBookId) &&
    ei.offeredBookId === String(offeredBookId) &&
    ei.status === '待确认'
  );
  if (duplicatePending) {
    res.status(400).json({ error: '该邀约已存在且待确认' });
    return;
  }

  const exchangeDate = String(expectedExchangeDate).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exchangeDate)) {
    res.status(400).json({ error: '期望交换时间格式无效' });
    return;
  }

  const now = new Date().toISOString();
  const newInvitation: ExchangeInvitation = {
    id: uuidv4(),
    circleId: String(circleId),
    initiatorId: CURRENT_USER_ID,
    initiatorName: CURRENT_USER_NAME,
    targetBookId: String(targetBookId),
    targetBook: { ...targetBook, book: books.find(b => b.id === targetBook.bookId) || targetBook.book },
    offeredBookId: String(offeredBookId),
    offeredBook: { ...offeredBook, book: books.find(b => b.id === offeredBook.bookId) || offeredBook.book },
    expectedExchangeDate: exchangeDate,
    message: message ? String(message).trim() : undefined,
    status: '待确认',
    createdAt: now,
    updatedAt: now
  };
  exchangeInvitations.push(newInvitation);
  res.status(201).json(newInvitation);
});

router.post('/sharing/exchanges/:id/accept', (req, res) => {
  const invitation = exchangeInvitations.find(ei => ei.id === req.params.id);
  if (!invitation) {
    res.status(404).json({ error: '换书邀约不存在' });
    return;
  }
  if (invitation.targetBook.ownerId !== CURRENT_USER_ID) {
    res.status(403).json({ error: '只有目标绘本所有者可以接受邀约' });
    return;
  }
  if (invitation.status !== '待确认') {
    res.status(400).json({ error: '当前状态不允许接受，邀约状态必须为待确认' });
    return;
  }

  const target = sharedBooks.find(sb => sb.id === invitation.targetBookId);
  const offered = sharedBooks.find(sb => sb.id === invitation.offeredBookId);
  if (!target || !offered) {
    res.status(404).json({ error: '关联的共享绘本不存在' });
    return;
  }

  const invalidStatuses = ['借出中', '已预留', '已转送'];
  if (invalidStatuses.includes(target.borrowStatus)) {
    res.status(400).json({ error: '目标绘本当前不可借' });
    return;
  }
  if (invalidStatuses.includes(offered.borrowStatus)) {
    res.status(400).json({ error: '拟交换绘本当前不可借' });
    return;
  }

  const now = new Date().toISOString();
  invitation.status = '已接受';
  invitation.responseAt = now;
  invitation.updatedAt = now;

  target.borrowStatus = '借出中';
  target.currentBorrowerId = invitation.initiatorId;
  target.currentBorrowerName = invitation.initiatorName;
  target.updatedAt = now;

  offered.borrowStatus = '借出中';
  offered.currentBorrowerId = target.ownerId;
  offered.currentBorrowerName = target.ownerName;
  offered.updatedAt = now;

  const exchangeDateStr = invitation.expectedExchangeDate;
  const cycleTarget = target.borrowCycleDays;
  const cycleOffered = offered.borrowCycleDays;
  const targetReturn = new Date(new Date(exchangeDateStr).getTime() + cycleTarget * 24 * 3600 * 1000).toISOString().split('T')[0];
  const offeredReturn = new Date(new Date(exchangeDateStr).getTime() + cycleOffered * 24 * 3600 * 1000).toISOString().split('T')[0];

  borrowRecords.push({
    id: uuidv4(),
    bookId: target.bookId,
    bookTitle: target.book.title,
    borrower: invitation.initiatorName,
    borrowDate: exchangeDateStr,
    expectedReturnDate: targetReturn,
    status: '借出中',
    notes: `[共享换书] 与 ${offered.ownerName} 交换`,
    createdAt: now
  });
  borrowRecords.push({
    id: uuidv4(),
    bookId: offered.bookId,
    bookTitle: offered.book.title,
    borrower: target.ownerName,
    borrowDate: exchangeDateStr,
    expectedReturnDate: offeredReturn,
    status: '借出中',
    notes: `[共享换书] 与 ${invitation.initiatorName} 交换`,
    createdAt: now
  });

  const tBook = books.find(b => b.id === target.bookId);
  const oBook = books.find(b => b.id === offered.bookId);
  if (tBook) { tBook.status = '借出'; tBook.updatedAt = now; }
  if (oBook) { oBook.status = '借出'; oBook.updatedAt = now; }

  refreshSharedBookRefs();
  res.json(invitation);
});

router.post('/sharing/exchanges/:id/reject', (req, res) => {
  const invitation = exchangeInvitations.find(ei => ei.id === req.params.id);
  if (!invitation) {
    res.status(404).json({ error: '换书邀约不存在' });
    return;
  }
  if (invitation.targetBook.ownerId !== CURRENT_USER_ID) {
    res.status(403).json({ error: '只有目标绘本所有者可以拒绝邀约' });
    return;
  }
  if (invitation.status !== '待确认') {
    res.status(400).json({ error: '当前状态不允许拒绝，邀约状态必须为待确认' });
    return;
  }
  const { rejectReason } = req.body;
  const now = new Date().toISOString();
  invitation.status = '已拒绝';
  invitation.rejectReason = rejectReason ? String(rejectReason).trim() : undefined;
  invitation.responseAt = now;
  invitation.updatedAt = now;
  res.json(invitation);
});

router.post('/sharing/exchanges/:id/cancel', (req, res) => {
  const invitation = exchangeInvitations.find(ei => ei.id === req.params.id);
  if (!invitation) {
    res.status(404).json({ error: '换书邀约不存在' });
    return;
  }
  if (invitation.initiatorId !== CURRENT_USER_ID) {
    res.status(403).json({ error: '只有邀约发起人可以取消' });
    return;
  }
  if (invitation.status !== '待确认') {
    res.status(400).json({ error: '当前状态不允许取消，邀约状态必须为待确认' });
    return;
  }
  const now = new Date().toISOString();
  invitation.status = '已取消';
  invitation.updatedAt = now;
  res.json(invitation);
});

router.post('/sharing/exchanges/:id/complete', (req, res) => {
  const invitation = exchangeInvitations.find(ei => ei.id === req.params.id);
  if (!invitation) {
    res.status(404).json({ error: '换书邀约不存在' });
    return;
  }
  if (invitation.initiatorId !== CURRENT_USER_ID && invitation.targetBook.ownerId !== CURRENT_USER_ID) {
    res.status(403).json({ error: '只有邀约双方可以标记完成' });
    return;
  }
  if (invitation.status !== '已接受') {
    res.status(400).json({ error: '当前状态不允许完成，邀约状态必须为已接受' });
    return;
  }

  const target = sharedBooks.find(sb => sb.id === invitation.targetBookId);
  const offered = sharedBooks.find(sb => sb.id === invitation.offeredBookId);
  const now = new Date().toISOString();

  if (target) {
    target.borrowStatus = '可借';
    target.currentBorrowerId = undefined;
    target.currentBorrowerName = undefined;
    target.updatedAt = now;
    const tBook = books.find(b => b.id === target.bookId);
    if (tBook) { tBook.status = '在家'; tBook.updatedAt = now; }
    const targetBorrow = borrowRecords
      .filter(br => br.bookId === target.bookId && br.status === '借出中')
      .sort((a, b) => new Date(b.borrowDate).getTime() - new Date(a.borrowDate).getTime())[0];
    if (targetBorrow) {
      targetBorrow.actualReturnDate = now.split('T')[0];
      targetBorrow.status = '已归还';
    }
  }

  if (offered) {
    offered.borrowStatus = '可借';
    offered.currentBorrowerId = undefined;
    offered.currentBorrowerName = undefined;
    offered.updatedAt = now;
    const oBook = books.find(b => b.id === offered.bookId);
    if (oBook) { oBook.status = '在家'; oBook.updatedAt = now; }
    const offeredBorrow = borrowRecords
      .filter(br => br.bookId === offered.bookId && br.status === '借出中')
      .sort((a, b) => new Date(b.borrowDate).getTime() - new Date(a.borrowDate).getTime())[0];
    if (offeredBorrow) {
      offeredBorrow.actualReturnDate = now.split('T')[0];
      offeredBorrow.status = '已归还';
    }
  }

  invitation.status = '已完成';
  invitation.completedAt = now;
  invitation.updatedAt = now;

  if (target) {
    const tProfile = bookCareProfiles.find(p => p.bookId === target.bookId);
    const tBook = books.find(b => b.id === target.bookId);
    if (tProfile && tBook) {
      updateCareProfileOnAction(tProfile, tBook, 'exchangeComplete');
    }
  }
  if (offered) {
    const oProfile = bookCareProfiles.find(p => p.bookId === offered.bookId);
    const oBook = books.find(b => b.id === offered.bookId);
    if (oProfile && oBook) {
      updateCareProfileOnAction(oProfile, oBook, 'exchangeComplete');
    }
  }

  refreshSharedBookRefs();
  res.json(invitation);
});

router.get('/sharing/current-user', (req, res) => {
  res.json({
    userId: CURRENT_USER_ID,
    userName: CURRENT_USER_NAME
  });
});

// ==================== 成长评估 API ====================

router.post('/assessments/generate', (req, res) => {
  const { periodType, periodStart, periodEnd } = req.body;

  if (!periodType || !['week', 'month'].includes(periodType)) {
    res.status(400).json({ error: 'periodType 必须为 week 或 month' });
    return;
  }

  let start: string;
  let end: string;

  const hasStart = !!periodStart;
  const hasEnd = !!periodEnd;
  if (hasStart !== hasEnd) {
    res.status(400).json({ error: '日期范围不完整，请同时填写起始日期和结束日期，或都留空自动计算' });
    return;
  }

  if (hasStart && hasEnd) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
      res.status(400).json({ error: '日期格式无效，需为 YYYY-MM-DD' });
      return;
    }
    if (periodStart > periodEnd) {
      res.status(400).json({ error: '起始日期不能晚于结束日期' });
      return;
    }
    start = periodStart;
    end = periodEnd;
  } else {
    const range = getPeriodRange(periodType as AssessmentPeriodType);
    start = range.start;
    end = range.end;
  }

  const existing = assessmentReports.find(r =>
    r.periodType === periodType && r.periodStart === start && r.periodEnd === end && r.status === 'draft'
  );
  if (existing) {
    res.status(400).json({ error: '该时段已有草稿状态的评估报告，请先查看或锁定后再生成新的' });
    return;
  }

  const babyAge = calculateBabyAgeMonths(babyInfo.birthDate);
  if (babyAge < 0 || babyAge > 144) {
    res.status(400).json({ error: '宝宝月龄超出有效范围(0-144个月)' });
    return;
  }

  const dimStability = calculateReadingStability(readingRecords, start, end);
  const dimTheme = calculateThemeBalance(readingRecords, books, themes, start, end);
  const dimAgeMatch = calculateAgeMatch(readingRecords, books, babyAge, start, end);
  const dimInteraction = calculateInteractionParticipation(readingRecords, books, start, end);
  const dimRotation = calculateRotationCompletion(rotationPlans, start, end);
  const dimExchange = calculateExchangeExpansion(exchangeInvitations, sharedBooks, start, end);

  const dimensions = [dimStability, dimTheme, dimAgeMatch, dimInteraction, dimRotation, dimExchange];
  const overallScore = Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length);
  const overallLevel = getOverallLevel(overallScore);

  const alerts = generateAlerts(dimensions);

  const themeDistribution = dimTheme.detail.includes('已覆盖')
    ? readingRecords
        .filter(r => r.readDate >= start && r.readDate <= end)
        .reduce((acc: { theme: string; count: number }[], r) => {
          const book = books.find(b => b.id === r.bookId);
          if (book) {
            const existing = acc.find(a => a.theme === book.theme);
            if (existing) existing.count++;
            else acc.push({ theme: book.theme, count: 1 });
          }
          return acc;
        }, [])
    : [];

  const interventions = generateInterventions(dimensions, books, themes, babyAge, themeDistribution);

  const relatedBookIds = [...new Set(
    readingRecords
      .filter(r => r.readDate >= start && r.readDate <= end)
      .map(r => r.bookId)
  )];

  const rotationCompletionRate = dimRotation.score;
  const exchangeCompletedCount = exchangeInvitations.filter(ei => ei.status === '已完成').length;
  const exchangeTotalCount = exchangeInvitations.length;

  const snapshotData = buildSnapshot(
    readingRecords, books, themes, babyAge,
    rotationCompletionRate, exchangeCompletedCount, exchangeTotalCount, sharedBooks.length,
    start, end
  );

  const now = new Date().toISOString();
  const report: AssessmentReport = {
    id: uuidv4(),
    periodType: periodType as AssessmentPeriodType,
    periodStart: start,
    periodEnd: end,
    babyAgeMonths: babyAge,
    status: 'draft',
    overallScore,
    overallLevel,
    dimensions,
    alerts,
    interventions,
    relatedBookIds,
    parentNotes: [],
    snapshotData,
    createdAt: now,
    updatedAt: now
  };

  assessmentReports.push(report);
  res.status(201).json(report);
});

router.get('/assessments', (req, res) => {
  const { periodType, status } = req.query;
  let filtered = [...assessmentReports];

  if (periodType) {
    filtered = filtered.filter(r => r.periodType === periodType);
  }
  if (status) {
    filtered = filtered.filter(r => r.status === status);
  }

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(filtered);
});

router.get('/assessments/latest', (req, res) => {
  const latest = assessmentReports
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (!latest) {
    res.status(404).json({ error: '暂无评估报告' });
    return;
  }
  res.json(latest);
});

router.get('/assessments/:id', (req, res) => {
  const report = assessmentReports.find(r => r.id === req.params.id);
  if (!report) {
    res.status(404).json({ error: '评估报告不存在' });
    return;
  }
  res.json(report);
});

router.patch('/assessments/:id/lock', (req, res) => {
  const report = assessmentReports.find(r => r.id === req.params.id);
  if (!report) {
    res.status(404).json({ error: '评估报告不存在' });
    return;
  }
  if (report.status === 'locked') {
    res.status(400).json({ error: '报告已锁定，不可重复锁定' });
    return;
  }

  report.status = 'locked';
  report.updatedAt = new Date().toISOString();
  res.json(report);
});

router.patch('/assessments/:id/notes', (req, res) => {
  const report = assessmentReports.find(r => r.id === req.params.id);
  if (!report) {
    res.status(404).json({ error: '评估报告不存在' });
    return;
  }

  const { note } = req.body;
  const noteText = String(note || '').trim();
  if (!noteText) {
    res.status(400).json({ error: '备注内容不能为空' });
    return;
  }

  report.parentNotes.push(noteText);
  report.updatedAt = new Date().toISOString();
  res.json(report);
});

router.patch('/assessments/:id/notes/:noteIndex', (req, res) => {
  const report = assessmentReports.find(r => r.id === req.params.id);
  if (!report) {
    res.status(404).json({ error: '评估报告不存在' });
    return;
  }

  const idx = Number(req.params.noteIndex);
  if (isNaN(idx) || idx < 0 || idx >= report.parentNotes.length) {
    res.status(400).json({ error: '备注索引无效' });
    return;
  }

  const { note } = req.body;
  const noteText = String(note || '').trim();
  if (!noteText) {
    res.status(400).json({ error: '备注内容不能为空' });
    return;
  }

  report.parentNotes[idx] = noteText;
  report.updatedAt = new Date().toISOString();
  res.json(report);
});

router.delete('/assessments/:id/notes/:noteIndex', (req, res) => {
  const report = assessmentReports.find(r => r.id === req.params.id);
  if (!report) {
    res.status(404).json({ error: '评估报告不存在' });
    return;
  }

  const idx = Number(req.params.noteIndex);
  if (isNaN(idx) || idx < 0 || idx >= report.parentNotes.length) {
    res.status(400).json({ error: '备注索引无效' });
    return;
  }

  report.parentNotes.splice(idx, 1);
  report.updatedAt = new Date().toISOString();
  res.json(report);
});

router.patch('/assessments/:id/interventions/:interventionIndex/status', (req, res) => {
  const report = assessmentReports.find(r => r.id === req.params.id);
  if (!report) {
    res.status(404).json({ error: '评估报告不存在' });
    return;
  }

  const idx = Number(req.params.interventionIndex);
  if (isNaN(idx) || idx < 0 || idx >= report.interventions.length) {
    res.status(400).json({ error: '干预建议索引无效' });
    return;
  }

  const { status } = req.body;
  if (!['pending', 'in_progress', 'done'].includes(status)) {
    res.status(400).json({ error: '状态必须为 pending、in_progress 或 done' });
    return;
  }

  report.interventions[idx].status = status;
  report.updatedAt = new Date().toISOString();
  res.json(report);
});

router.get('/assessments/summary/overview', (req, res) => {
  const latest = assessmentReports
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (!latest) {
    res.json({
      hasReport: false,
      latestScore: 0,
      latestLevel: '',
      reportCount: 0,
      activeAlerts: 0,
      pendingInterventions: 0
    });
    return;
  }

  const activeAlerts = latest.alerts.length;
  const pendingInterventions = latest.interventions.filter(i => i.status === 'pending').length;

  res.json({
    hasReport: true,
    latestId: latest.id,
    latestScore: latest.overallScore,
    latestLevel: latest.overallLevel,
    latestPeriodType: latest.periodType,
    latestPeriodStart: latest.periodStart,
    latestPeriodEnd: latest.periodEnd,
    reportCount: assessmentReports.length,
    activeAlerts,
    pendingInterventions,
    dimensions: latest.dimensions
  });
});

// ==================== 绘本养护模块 API ====================

router.get('/care/meta', (req, res) => {
  res.json({
    bookConditions,
    damageTypes,
    damageRiskLevels,
    repairStatuses: ['待处理', '处理中', '已完成', '无法修复'],
    reminderTypes: ['清洁消毒', '损耗复查', '维修跟进'],
    severities: ['轻微', '中度', '严重']
  });
});

router.get('/care/profiles', (req, res) => {
  const { bookId, riskLevel, isPaused, condition, unresolved } = req.query;
  let filtered = [...bookCareProfiles];

  if (bookId) {
    filtered = filtered.filter(p => p.bookId === String(bookId));
  }
  if (riskLevel) {
    filtered = filtered.filter(p => p.damageRiskLevel === riskLevel);
  }
  if (isPaused !== undefined) {
    const wantPaused = String(isPaused) === 'true';
    filtered = filtered.filter(p => p.isCirculationPaused === wantPaused);
  }
  if (condition) {
    filtered = filtered.filter(p => p.currentCondition === condition);
  }
  if (unresolved === 'true') {
    filtered = filtered.filter(p => p.damageRecords.some(d => !d.resolved));
  }

  filtered.sort((a, b) => {
    const riskOrder: Record<string, number> = { '极高': 4, '高': 3, '中': 2, '低': 1 };
    if (a.isCirculationPaused !== b.isCirculationPaused) {
      return a.isCirculationPaused ? -1 : 1;
    }
    return (riskOrder[b.damageRiskLevel] || 0) - (riskOrder[a.damageRiskLevel] || 0);
  });

  res.json(filtered);
});

router.get('/care/profiles/:bookId', (req, res) => {
  const profile = bookCareProfiles.find(p => p.bookId === req.params.bookId);
  if (!profile) {
    const book = books.find(b => b.id === req.params.bookId);
    if (!book) {
      res.status(404).json({ error: '绘本不存在' });
      return;
    }
    const borrowCount = borrowRecords.filter(br => br.bookId === book.id).length;
    const readCount = readingRecords.filter(rr => rr.bookId === book.id).length;
    const now = new Date().toISOString();
    const riskResult = calculateDamageRiskLevel(book, borrowCount, readCount, [], false);
    const newProfile: BookCareProfile = {
      id: uuidv4(),
      bookId: book.id,
      bookTitle: book.title,
      currentCondition: calculateBookCondition([], borrowCount, readCount),
      totalBorrowCount: borrowCount,
      totalReadCount: readCount,
      damageRiskLevel: riskResult.level,
      damageRiskReasons: riskResult.reasons,
      isCirculationPaused: false,
      damageRecords: [],
      repairRecords: [],
      reminders: [generateCleaningReminder(book.id, book.title)],
      createdAt: now,
      updatedAt: now
    };
    bookCareProfiles.push(newProfile);
    res.json(newProfile);
    return;
  }
  res.json(profile);
});

router.post('/care/profiles/:bookId', (req, res) => {
  const book = books.find(b => b.id === req.params.bookId);
  if (!book) {
    res.status(404).json({ error: '绘本不存在' });
    return;
  }

  const existing = bookCareProfiles.find(p => p.bookId === req.params.bookId);
  if (existing) {
    res.status(400).json({ error: '该绘本养护档案已存在' });
    return;
  }

  const borrowCount = borrowRecords.filter(br => br.bookId === book.id).length;
  const readCount = readingRecords.filter(rr => rr.bookId === book.id).length;
  const now = new Date().toISOString();
  const riskResult = calculateDamageRiskLevel(book, borrowCount, readCount, [], false);

  const newProfile: BookCareProfile = {
    id: uuidv4(),
    bookId: book.id,
    bookTitle: book.title,
    currentCondition: calculateBookCondition([], borrowCount, readCount),
    totalBorrowCount: borrowCount,
    totalReadCount: readCount,
    damageRiskLevel: riskResult.level,
    damageRiskReasons: riskResult.reasons,
    isCirculationPaused: false,
    damageRecords: [],
    repairRecords: [],
    reminders: [generateCleaningReminder(book.id, book.title)],
    createdAt: now,
    updatedAt: now
  };

  bookCareProfiles.push(newProfile);
  res.status(201).json(newProfile);
});

router.put('/care/profiles/:bookId', (req, res) => {
  const index = bookCareProfiles.findIndex(p => p.bookId === req.params.bookId);
  if (index === -1) {
    res.status(404).json({ error: '养护档案不存在' });
    return;
  }

  const { currentCondition, conditionDescription, lastCleanDate, lastInspectionDate,
    isCirculationPaused, pauseReason, expectedResumeDate } = req.body;

  const profile = bookCareProfiles[index];

  if (currentCondition !== undefined) {
    if (!isValidBookCondition(String(currentCondition))) {
      res.status(400).json({ error: '无效的品相值' });
      return;
    }
    profile.currentCondition = currentCondition as BookCondition;
  }
  if (conditionDescription !== undefined) {
    profile.conditionDescription = String(conditionDescription).trim() || undefined;
  }
  if (lastCleanDate !== undefined) {
    if (lastCleanDate && !isDateValid(String(lastCleanDate))) {
      res.status(400).json({ error: '最后清洁日期格式无效' });
      return;
    }
    profile.lastCleanDate = lastCleanDate ? String(lastCleanDate) : undefined;
  }
  if (lastInspectionDate !== undefined) {
    if (lastInspectionDate && !isDateValid(String(lastInspectionDate))) {
      res.status(400).json({ error: '最后检查日期格式无效' });
      return;
    }
    profile.lastInspectionDate = lastInspectionDate ? String(lastInspectionDate) : undefined;
  }
  if (isCirculationPaused !== undefined) {
    profile.isCirculationPaused = Boolean(isCirculationPaused);
    if (!profile.isCirculationPaused) {
      profile.pauseReason = undefined;
      profile.expectedResumeDate = undefined;
    }
  }
  if (pauseReason !== undefined && profile.isCirculationPaused) {
    const reason = String(pauseReason).trim();
    if (!reason) {
      res.status(400).json({ error: '暂停原因不能为空' });
      return;
    }
    profile.pauseReason = reason;
  }
  if (expectedResumeDate !== undefined && profile.isCirculationPaused) {
    if (expectedResumeDate && !isDateValid(String(expectedResumeDate))) {
      res.status(400).json({ error: '预计恢复日期格式无效' });
      return;
    }
    profile.expectedResumeDate = expectedResumeDate ? String(expectedResumeDate) : undefined;
  }

  const book = books.find(b => b.id === profile.bookId);
  if (book) {
    const unresolvedDamages = profile.damageRecords.filter(d => !d.resolved);
    const riskResult = calculateDamageRiskLevel(
      book, profile.totalBorrowCount, profile.totalReadCount,
      unresolvedDamages, profile.isCirculationPaused
    );
    profile.damageRiskLevel = riskResult.level;
    profile.damageRiskReasons = riskResult.reasons;
  }

  profile.updatedAt = new Date().toISOString();
  bookCareProfiles[index] = profile;
  res.json(profile);
});

router.patch('/care/profiles/:bookId/pause', (req, res) => {
  const index = bookCareProfiles.findIndex(p => p.bookId === req.params.bookId);
  if (index === -1) {
    res.status(404).json({ error: '养护档案不存在' });
    return;
  }

  const { pauseReason, expectedResumeDate } = req.body;
  const reason = String(pauseReason || '').trim();
  if (!reason) {
    res.status(400).json({ error: '暂停原因不能为空' });
    return;
  }
  if (expectedResumeDate && !isDateValid(String(expectedResumeDate))) {
    res.status(400).json({ error: '预计恢复日期格式无效' });
    return;
  }

  const profile = bookCareProfiles[index];
  profile.isCirculationPaused = true;
  profile.pauseReason = reason;
  profile.expectedResumeDate = expectedResumeDate ? String(expectedResumeDate) : undefined;
  profile.updatedAt = new Date().toISOString();

  const book = books.find(b => b.id === profile.bookId);
  if (book) {
    const riskResult = calculateDamageRiskLevel(
      book, profile.totalBorrowCount, profile.totalReadCount,
      profile.damageRecords.filter(d => !d.resolved), true
    );
    profile.damageRiskLevel = riskResult.level;
    profile.damageRiskReasons = riskResult.reasons;
  }

  res.json(profile);
});

router.patch('/care/profiles/:bookId/resume', (req, res) => {
  const index = bookCareProfiles.findIndex(p => p.bookId === req.params.bookId);
  if (index === -1) {
    res.status(404).json({ error: '养护档案不存在' });
    return;
  }

  const profile = bookCareProfiles[index];
  if (!profile.isCirculationPaused) {
    res.status(400).json({ error: '该绘本未处于暂停流转状态' });
    return;
  }

  profile.isCirculationPaused = false;
  profile.pauseReason = undefined;
  profile.expectedResumeDate = undefined;
  profile.updatedAt = new Date().toISOString();

  const book = books.find(b => b.id === profile.bookId);
  if (book) {
    const riskResult = calculateDamageRiskLevel(
      book, profile.totalBorrowCount, profile.totalReadCount,
      profile.damageRecords.filter(d => !d.resolved), false
    );
    profile.damageRiskLevel = riskResult.level;
    profile.damageRiskReasons = riskResult.reasons;
  }

  res.json(profile);
});

router.post('/care/profiles/:bookId/damages', (req, res) => {
  const profile = bookCareProfiles.find(p => p.bookId === req.params.bookId);
  if (!profile) {
    res.status(404).json({ error: '养护档案不存在' });
    return;
  }

  const { damageType, severity, description, location, discoveredDate, discoveredBy, relatedBorrowRecordId } = req.body;

  if (!damageType || !isValidDamageType(String(damageType))) {
    res.status(400).json({ error: '请选择有效的损耗类型' });
    return;
  }
  if (!severity || !isValidSeverity(String(severity))) {
    res.status(400).json({ error: '请选择有效的损耗严重程度' });
    return;
  }
  if (!description || !String(description).trim()) {
    res.status(400).json({ error: '损耗描述不能为空' });
    return;
  }

  const finalDiscoveredDate = discoveredDate || new Date().toISOString().split('T')[0];
  if (!isDateValid(String(finalDiscoveredDate))) {
    res.status(400).json({ error: '发现日期格式无效' });
    return;
  }

  const now = new Date().toISOString();
  const book = books.find(b => b.id === profile.bookId);

  const newDamage: DamageRecord = {
    id: uuidv4(),
    bookId: profile.bookId,
    bookTitle: profile.bookTitle,
    damageType: damageType as DamageType,
    severity: severity as '轻微' | '中度' | '严重',
    description: String(description).trim(),
    location: location ? String(location).trim() : undefined,
    discoveredDate: String(finalDiscoveredDate),
    discoveredBy: discoveredBy ? String(discoveredBy).trim() : undefined,
    relatedBorrowRecordId: relatedBorrowRecordId ? String(relatedBorrowRecordId) : undefined,
    resolved: false,
    createdAt: now,
    updatedAt: now
  };

  profile.damageRecords.unshift(newDamage);

  if (book) {
    const unresolvedDamages = profile.damageRecords.filter(d => !d.resolved);
    const riskResult = calculateDamageRiskLevel(
      book, profile.totalBorrowCount, profile.totalReadCount,
      unresolvedDamages, profile.isCirculationPaused
    );
    profile.damageRiskLevel = riskResult.level;
    profile.damageRiskReasons = riskResult.reasons;
    profile.currentCondition = calculateBookCondition(
      unresolvedDamages, profile.totalBorrowCount, profile.totalReadCount
    );
  }

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const existingReminder = profile.reminders.find(
    r => r.type === '损耗复查' && !r.isCompleted
  );
  if (!existingReminder) {
    profile.reminders.push({
      id: uuidv4(),
      bookId: profile.bookId,
      bookTitle: profile.bookTitle,
      type: '损耗复查',
      title: `新增${newDamage.severity}${newDamage.damageType}复查`,
      description: `请检查${newDamage.damageType}处理进度`,
      scheduledDate: formatDate(nextWeek),
      isCompleted: false,
      priority: newDamage.severity === '严重' ? 'high' : newDamage.severity === '中度' ? 'medium' : 'low',
      createdAt: now,
      updatedAt: now
    });
  }

  profile.updatedAt = now;
  res.status(201).json(newDamage);
});

router.patch('/care/damages/:damageId/resolve', (req, res) => {
  let found = false;
  let resolvedDamage: DamageRecord | null = null;

  for (const profile of bookCareProfiles) {
    const damageIndex = profile.damageRecords.findIndex(d => d.id === req.params.damageId);
    if (damageIndex !== -1) {
      const { resolutionNote } = req.body;
      const note = String(resolutionNote || '').trim();
      if (!note) {
        res.status(400).json({ error: '处理说明不能为空' });
        return;
      }

      const damage = profile.damageRecords[damageIndex];
      damage.resolved = true;
      damage.resolvedAt = new Date().toISOString();
      damage.resolutionNote = note;
      damage.updatedAt = new Date().toISOString();
      resolvedDamage = damage;
      found = true;

      const book = books.find(b => b.id === profile.bookId);
      if (book) {
        const unresolvedDamages = profile.damageRecords.filter(d => !d.resolved);
        const riskResult = calculateDamageRiskLevel(
          book, profile.totalBorrowCount, profile.totalReadCount,
          unresolvedDamages, profile.isCirculationPaused
        );
        profile.damageRiskLevel = riskResult.level;
        profile.damageRiskReasons = riskResult.reasons;
        profile.currentCondition = calculateBookCondition(
          unresolvedDamages, profile.totalBorrowCount, profile.totalReadCount
        );
      }
      profile.updatedAt = new Date().toISOString();
      break;
    }
  }

  if (!found) {
    res.status(404).json({ error: '损耗记录不存在' });
    return;
  }

  res.json(resolvedDamage);
});

router.post('/care/profiles/:bookId/repairs', (req, res) => {
  const profile = bookCareProfiles.find(p => p.bookId === req.params.bookId);
  if (!profile) {
    res.status(404).json({ error: '养护档案不存在' });
    return;
  }

  const { damageRecordId, repairType, description, repairDate, repairedBy, cost, status, notes } = req.body;

  if (!repairType || !String(repairType).trim()) {
    res.status(400).json({ error: '维修类型不能为空' });
    return;
  }
  if (!description || !String(description).trim()) {
    res.status(400).json({ error: '维修描述不能为空' });
    return;
  }

  const finalRepairDate = repairDate || new Date().toISOString().split('T')[0];
  if (!isDateValid(String(finalRepairDate))) {
    res.status(400).json({ error: '维修日期格式无效' });
    return;
  }

  const finalStatus = status && isValidRepairStatus(String(status)) ? status as RepairStatus : '待处理';

  if (damageRecordId) {
    const damage = profile.damageRecords.find(d => d.id === String(damageRecordId));
    if (!damage) {
      res.status(404).json({ error: '关联的损耗记录不存在' });
      return;
    }
  }

  const now = new Date().toISOString();
  const newRepair: RepairRecord = {
    id: uuidv4(),
    bookId: profile.bookId,
    bookTitle: profile.bookTitle,
    damageRecordId: damageRecordId ? String(damageRecordId) : undefined,
    repairType: String(repairType).trim(),
    description: String(description).trim(),
    repairDate: String(finalRepairDate),
    repairedBy: repairedBy ? String(repairedBy).trim() : undefined,
    cost: cost !== undefined ? Number(cost) : undefined,
    status: finalStatus,
    notes: notes ? String(notes).trim() : undefined,
    createdAt: now,
    updatedAt: now
  };

  profile.repairRecords.unshift(newRepair);

  const threeDaysLater = new Date();
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);
  if (finalStatus !== '已完成' && finalStatus !== '无法修复') {
    const existingReminder = profile.reminders.find(
      r => r.type === '维修跟进' && !r.isCompleted
    );
    if (!existingReminder) {
      profile.reminders.push({
        id: uuidv4(),
        bookId: profile.bookId,
        bookTitle: profile.bookTitle,
        type: '维修跟进',
        title: `${newRepair.repairType}进度跟进`,
        description: `请检查维修进度`,
        scheduledDate: formatDate(threeDaysLater),
        isCompleted: false,
        priority: 'medium',
        createdAt: now,
        updatedAt: now
      });
    }
  }

  profile.updatedAt = now;
  res.status(201).json(newRepair);
});

router.patch('/care/repairs/:repairId/status', (req, res) => {
  const { status } = req.body;
  if (!status || !isValidRepairStatus(String(status))) {
    res.status(400).json({ error: '无效的维修状态' });
    return;
  }

  let found = false;
  let updatedRepair: RepairRecord | null = null;

  for (const profile of bookCareProfiles) {
    const repairIndex = profile.repairRecords.findIndex(r => r.id === req.params.repairId);
    if (repairIndex !== -1) {
      const repair = profile.repairRecords[repairIndex];
      const oldStatus = repair.status;
      repair.status = status as RepairStatus;
      repair.updatedAt = new Date().toISOString();
      updatedRepair = repair;
      found = true;

      if (repair.damageRecordId && (status === '已完成' || status === '无法修复')) {
        const damage = profile.damageRecords.find(d => d.id === repair.damageRecordId);
        if (damage && !damage.resolved) {
          damage.resolved = true;
          damage.resolvedAt = new Date().toISOString();
          damage.resolutionNote = status === '已完成' ? `维修完成：${repair.repairType}` : '无法修复';
          damage.updatedAt = new Date().toISOString();
        }
      }

      if ((oldStatus === '待处理' || oldStatus === '处理中') && (status === '已完成' || status === '无法修复')) {
        for (const rem of profile.reminders) {
          if (rem.type === '维修跟进' && !rem.isCompleted) {
            rem.isCompleted = true;
            rem.completedAt = new Date().toISOString();
            rem.updatedAt = new Date().toISOString();
          }
        }
      }

      const book = books.find(b => b.id === profile.bookId);
      if (book) {
        const unresolvedDamages = profile.damageRecords.filter(d => !d.resolved);
        const riskResult = calculateDamageRiskLevel(
          book, profile.totalBorrowCount, profile.totalReadCount,
          unresolvedDamages, profile.isCirculationPaused
        );
        profile.damageRiskLevel = riskResult.level;
        profile.damageRiskReasons = riskResult.reasons;
        profile.currentCondition = calculateBookCondition(
          unresolvedDamages, profile.totalBorrowCount, profile.totalReadCount
        );
      }
      profile.updatedAt = new Date().toISOString();
      break;
    }
  }

  if (!found) {
    res.status(404).json({ error: '维修记录不存在' });
    return;
  }

  res.json(updatedRepair);
});

router.get('/care/reminders', (req, res) => {
  const { isCompleted, type, priority, overdue } = req.query;
  let allReminders: (CareReminder & { profile?: BookCareProfile })[] = [];

  for (const profile of bookCareProfiles) {
    for (const rem of profile.reminders) {
      allReminders.push({ ...rem, profile });
    }
  }

  if (isCompleted !== undefined) {
    const wantCompleted = String(isCompleted) === 'true';
    allReminders = allReminders.filter(r => r.isCompleted === wantCompleted);
  }
  if (type) {
    allReminders = allReminders.filter(r => r.type === type);
  }
  if (priority) {
    allReminders = allReminders.filter(r => r.priority === priority);
  }
  if (overdue === 'true') {
    const today = new Date().toISOString().split('T')[0];
    allReminders = allReminders.filter(r => !r.isCompleted && r.scheduledDate < today);
  }

  allReminders.sort((a, b) => {
    const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    if ((priorityOrder[b.priority] || 0) !== (priorityOrder[a.priority] || 0)) {
      return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    }
    return a.scheduledDate.localeCompare(b.scheduledDate);
  });

  res.json(allReminders.map(r => {
    const { profile, ...rest } = r;
    return rest;
  }));
});

router.patch('/care/reminders/:reminderId/complete', (req, res) => {
  let found = false;
  let updatedReminder: CareReminder | null = null;

  for (const profile of bookCareProfiles) {
    const remIndex = profile.reminders.findIndex(r => r.id === req.params.reminderId);
    if (remIndex !== -1) {
      const reminder = profile.reminders[remIndex];
      if (reminder.isCompleted) {
        res.status(400).json({ error: '该提醒已完成' });
        return;
      }
      reminder.isCompleted = true;
      reminder.completedAt = new Date().toISOString();
      reminder.updatedAt = new Date().toISOString();
      updatedReminder = reminder;
      found = true;

      if (reminder.type === '清洁消毒') {
        profile.lastCleanDate = new Date().toISOString().split('T')[0];
        const nextMonth = new Date();
        nextMonth.setDate(nextMonth.getDate() + 30);
        profile.reminders.push({
          id: uuidv4(),
          bookId: profile.bookId,
          bookTitle: profile.bookTitle,
          type: '清洁消毒',
          title: '定期清洁消毒提醒',
          description: '建议对绘本进行清洁消毒',
          scheduledDate: formatDate(nextMonth),
          isCompleted: false,
          priority: 'medium',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      profile.updatedAt = new Date().toISOString();
      break;
    }
  }

  if (!found) {
    res.status(404).json({ error: '提醒不存在' });
    return;
  }

  res.json(updatedReminder);
});

router.get('/care/stats', (req, res) => {
  const totalProfiles = bookCareProfiles.length;
  const highRiskCount = bookCareProfiles.filter(p => p.damageRiskLevel === '高' || p.damageRiskLevel === '极高').length;
  const pausedCount = bookCareProfiles.filter(p => p.isCirculationPaused).length;

  let pendingDamagesCount = 0;
  let pendingRepairsCount = 0;
  let pendingCleaningCount = 0;
  let overdueRemindersCount = 0;
  const today = new Date().toISOString().split('T')[0];

  const conditionMap: Record<string, number> = {};
  const riskMap: Record<string, number> = {};
  const damageTypeMap: Record<string, number> = {};
  const themeDamageMap: Record<string, number> = {};

  for (const profile of bookCareProfiles) {
    conditionMap[profile.currentCondition] = (conditionMap[profile.currentCondition] || 0) + 1;
    riskMap[profile.damageRiskLevel] = (riskMap[profile.damageRiskLevel] || 0) + 1;

    const book = books.find(b => b.id === profile.bookId);

    for (const dmg of profile.damageRecords) {
      if (!dmg.resolved) {
        pendingDamagesCount++;
        damageTypeMap[dmg.damageType] = (damageTypeMap[dmg.damageType] || 0) + 1;
        if (book) {
          themeDamageMap[book.theme] = (themeDamageMap[book.theme] || 0) + 1;
        }
      }
    }

    for (const repair of profile.repairRecords) {
      if (repair.status === '待处理' || repair.status === '处理中') {
        pendingRepairsCount++;
      }
    }

    for (const rem of profile.reminders) {
      if (!rem.isCompleted) {
        if (rem.type === '清洁消毒') pendingCleaningCount++;
        if (rem.scheduledDate < today) overdueRemindersCount++;
      }
    }
  }

  const conditionDistribution = bookConditions.map(c => ({ condition: c, count: conditionMap[c] || 0 }));
  const riskDistribution = damageRiskLevels.map(r => ({ risk: r, count: riskMap[r] || 0 }));
  const damageTypeDistribution = Object.entries(damageTypeMap)
    .map(([type, count]) => ({ type: type as DamageType, count }))
    .sort((a, b) => b.count - a.count);
  const themeDamageDistribution = Object.entries(themeDamageMap)
    .map(([theme, count]) => ({ theme: theme as BookTheme, count }))
    .sort((a, b) => b.count - a.count);

  const stats: CareStats = {
    totalProfiles,
    highRiskCount,
    pausedCount,
    pendingDamagesCount,
    pendingRepairsCount,
    pendingCleaningCount,
    overdueRemindersCount,
    conditionDistribution,
    riskDistribution,
    damageTypeDistribution,
    themeDamageDistribution
  };

  res.json(stats);
});

export default router;
