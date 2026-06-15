import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  books, borrowRecords, readingRecords, babyInfo, themes, interactionTypes, rotationPlans,
  sharingCircles, sharedBooks, exchangeInvitations, CURRENT_USER_ID, CURRENT_USER_NAME
} from './data';
import {
  Book, BookStatus, BorrowRecord, ReadingRecord, RotationPlan, RotationItemStatus, RotationPlanStats,
  SharingCircle, SharedBook, ExchangeInvitation, ExchangeInvitationStatus, BookTheme, SharingStats
} from './types';
import { recommendBooks, calculateBabyAgeMonths, isOverdue, getWeekRange, generateRotationPlanItems } from './utils';

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
  
  const newRecord: BorrowRecord = {
    id: uuidv4(),
    bookId,
    bookTitle: book.title,
    borrower,
    borrowerPhone,
    borrowDate: borrowDate || new Date().toISOString().split('T')[0],
    expectedReturnDate,
    status: '借出中',
    notes,
    createdAt: new Date().toISOString()
  };
  
  borrowRecords.push(newRecord);
  book.status = '借出';
  book.updatedAt = new Date().toISOString();
  
  res.status(201).json(newRecord);
});

router.post('/borrow-records/:id/return', (req, res) => {
  const record = borrowRecords.find(b => b.id === req.params.id);
  if (!record) {
    res.status(404).json({ error: '借阅记录不存在' });
    return;
  }
  
  const { returnDate } = req.body;
  record.actualReturnDate = returnDate || new Date().toISOString().split('T')[0];
  record.status = '已归还';
  
  const book = books.find(b => b.id === record.bookId);
  if (book) {
    book.status = '在家';
    book.updatedAt = new Date().toISOString();
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
  
  const durationNum = Math.max(0, Number(duration) || 0);
  const finalReadDate = readDate || new Date().toISOString().split('T')[0];
  
  const newRecord: ReadingRecord = {
    id: uuidv4(),
    bookId,
    bookTitle: book.title,
    readDate: finalReadDate,
    duration: durationNum,
    babyAgeMonths: Number(babyAgeMonths) || calculateBabyAgeMonths(babyInfo.birthDate),
    reaction,
    notes,
    createdAt: new Date().toISOString()
  };
  
  readingRecords.push(newRecord);
  
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
    Number(weekSize) || 5
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
  sharedBooks = sharedBooks.filter(sb => sb.circleId !== circle.id);
  exchangeInvitations = exchangeInvitations.filter(ei => !circleBooksToRemove.includes(ei.targetBookId) && !circleBooksToRemove.includes(ei.offeredBookId));
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
  exchangeInvitations = exchangeInvitations.filter(ei =>
    ei.targetBookId !== sb.id && ei.offeredBookId !== sb.id
  );
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

  refreshSharedBookRefs();
  res.json(invitation);
});

router.get('/sharing/current-user', (req, res) => {
  res.json({
    userId: CURRENT_USER_ID,
    userName: CURRENT_USER_NAME
  });
});

export default router;
