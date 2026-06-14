import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { books, borrowRecords, readingRecords, babyInfo, themes, interactionTypes, rotationPlans } from './data';
import { Book, BookStatus, BorrowRecord, ReadingRecord, RotationPlan, RotationItemStatus, RotationPlanStats } from './types';
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
  let filtered = [...borrowRecords];
  
  if (status) {
    filtered = filtered.filter(b => b.status === status);
  }
  if (bookId) {
    filtered = filtered.filter(b => b.bookId === bookId);
  }
  
  for (const record of filtered) {
    if (record.actualReturnDate) {
      record.status = '已归还';
    } else if (record.status === '借出中' && isOverdue(record.expectedReturnDate)) {
      record.status = '逾期';
    }
  }
  
  filtered.sort((a, b) => new Date(b.borrowDate).getTime() - new Date(a.borrowDate).getTime());
  res.json(filtered);
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
  
  res.json({
    totalBooks,
    totalBorrows,
    returnRate,
    totalReadingTime,
    monthlyReadingFrequency,
    popularThemes,
    idleBooks,
    borrowedBooksCount
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
    p.weekStartDate === start && p.weekEndDate === end && p.status === 'active'
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
  item.status = '跳过';
  item.skipReason = String(skipReason || '');
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

export default router;
