import { v4 as uuidv4 } from 'uuid';
import { Book, BorrowRecord, ReadingRecord, BabyInfo, BookTheme, InteractionType, RotationPlan, SharingCircle, SharedBook, ExchangeInvitation, AssessmentReport, BookCareProfile, DamageRecord, RepairRecord, CareReminder, BookCondition, DamageType, DamageRiskLevel } from './types';

export const babyInfo: BabyInfo = {
  name: '小宝',
  birthDate: '2024-06-15',
  gender: '男'
};

export let books: Book[] = [
  {
    id: uuidv4(),
    title: '好饿的毛毛虫',
    author: '艾瑞·卡尔',
    theme: '认知启蒙',
    minMonth: 6,
    maxMonth: 24,
    interactionType: '翻翻',
    purchaseDate: '2024-08-01',
    status: '在家',
    coverUrl: '',
    description: '一本经典的洞洞书，讲述毛毛虫变成蝴蝶的故事',
    createdAt: '2024-08-01T00:00:00.000Z',
    updatedAt: '2024-08-01T00:00:00.000Z'
  },
  {
    id: uuidv4(),
    title: '猜猜我有多爱你',
    author: '山姆·麦克布雷尼',
    theme: '情绪管理',
    minMonth: 12,
    maxMonth: 48,
    interactionType: '普通',
    purchaseDate: '2024-09-10',
    status: '在家',
    coverUrl: '',
    description: '关于爱的经典绘本',
    createdAt: '2024-09-10T00:00:00.000Z',
    updatedAt: '2024-09-10T00:00:00.000Z'
  },
  {
    id: uuidv4(),
    title: '噼里啪啦系列-我要拉粑粑',
    author: '佐佐木洋子',
    theme: '习惯养成',
    minMonth: 8,
    maxMonth: 24,
    interactionType: '翻翻',
    purchaseDate: '2024-10-01',
    status: '借出',
    coverUrl: '',
    description: '帮助宝宝养成良好习惯的翻翻书',
    createdAt: '2024-10-01T00:00:00.000Z',
    updatedAt: '2024-10-01T00:00:00.000Z'
  },
  {
    id: uuidv4(),
    title: '小熊宝宝绘本-你好',
    author: '佐佐木洋子',
    theme: '品格培养',
    minMonth: 6,
    maxMonth: 24,
    interactionType: '普通',
    purchaseDate: '2024-07-15',
    status: '在家',
    coverUrl: '',
    description: '教宝宝懂礼貌的小熊宝宝系列',
    createdAt: '2024-07-15T00:00:00.000Z',
    updatedAt: '2024-07-15T00:00:00.000Z'
  },
  {
    id: uuidv4(),
    title: '偷偷看里面-农场',
    author: '英国尤斯伯恩',
    theme: '自然科普',
    minMonth: 10,
    maxMonth: 36,
    interactionType: '翻翻',
    purchaseDate: '2024-11-01',
    status: '预留',
    coverUrl: '',
    description: '洞洞翻翻书，探索农场里的小动物',
    createdAt: '2024-11-01T00:00:00.000Z',
    updatedAt: '2024-11-01T00:00:00.000Z'
  },
  {
    id: uuidv4(),
    title: '听，什么声音？',
    author: '步步联盟',
    theme: '认知启蒙',
    minMonth: 3,
    maxMonth: 18,
    interactionType: '发声',
    purchaseDate: '2024-06-01',
    status: '在家',
    coverUrl: '',
    description: '触摸发声书，认识各种声音',
    createdAt: '2024-06-01T00:00:00.000Z',
    updatedAt: '2024-06-01T00:00:00.000Z'
  },
  {
    id: uuidv4(),
    title: '晚安，月亮',
    author: '玛格丽特·怀兹·布朗',
    theme: '习惯养成',
    minMonth: 6,
    maxMonth: 36,
    interactionType: '普通',
    purchaseDate: '2024-05-20',
    status: '转送',
    coverUrl: '',
    description: '经典睡前绘本',
    createdAt: '2024-05-20T00:00:00.000Z',
    updatedAt: '2024-05-20T00:00:00.000Z'
  },
  {
    id: uuidv4(),
    title: '脸，脸，各种各样的脸',
    author: '柳原良平',
    theme: '情绪管理',
    minMonth: 4,
    maxMonth: 18,
    interactionType: '触摸',
    purchaseDate: '2024-07-01',
    status: '在家',
    coverUrl: '',
    description: '认识各种表情的脸',
    createdAt: '2024-07-01T00:00:00.000Z',
    updatedAt: '2024-07-01T00:00:00.000Z'
  }
];

const bookIds = books.map(b => b.id);

export let borrowRecords: BorrowRecord[] = [
  {
    id: uuidv4(),
    bookId: bookIds[2],
    bookTitle: '噼里啪啦系列-我要拉粑粑',
    borrower: '小明妈妈',
    borrowerPhone: '13800138001',
    borrowDate: '2025-06-01',
    expectedReturnDate: '2025-06-15',
    status: '借出中',
    notes: '宝宝很喜欢',
    createdAt: '2025-06-01T00:00:00.000Z'
  },
  {
    id: uuidv4(),
    bookId: bookIds[0],
    bookTitle: '好饿的毛毛虫',
    borrower: '小红爸爸',
    borrowerPhone: '13900139001',
    borrowDate: '2025-05-10',
    expectedReturnDate: '2025-05-25',
    actualReturnDate: '2025-05-23',
    status: '已归还',
    notes: '按时归还',
    createdAt: '2025-05-10T00:00:00.000Z'
  },
  {
    id: uuidv4(),
    bookId: bookIds[1],
    bookTitle: '猜猜我有多爱你',
    borrower: '小华妈妈',
    borrowerPhone: '13700137001',
    borrowDate: '2025-05-01',
    expectedReturnDate: '2025-05-15',
    actualReturnDate: '2025-05-20',
    status: '逾期',
    notes: '晚了几天还',
    createdAt: '2025-05-01T00:00:00.000Z'
  }
];

export let readingRecords: ReadingRecord[] = [
  {
    id: uuidv4(),
    bookId: bookIds[0],
    bookTitle: '好饿的毛毛虫',
    readDate: '2025-06-01',
    duration: 15,
    babyAgeMonths: 11,
    reaction: '很喜欢，用手去抠洞洞',
    notes: '',
    createdAt: '2025-06-01T20:00:00.000Z'
  },
  {
    id: uuidv4(),
    bookId: bookIds[3],
    bookTitle: '小熊宝宝绘本-你好',
    readDate: '2025-06-02',
    duration: 10,
    babyAgeMonths: 11,
    reaction: '听得很认真',
    notes: '',
    createdAt: '2025-06-02T20:00:00.000Z'
  },
  {
    id: uuidv4(),
    bookId: bookIds[5],
    bookTitle: '听，什么声音？',
    readDate: '2025-06-03',
    duration: 8,
    babyAgeMonths: 11,
    reaction: '对发声按钮很感兴趣',
    notes: '',
    createdAt: '2025-06-03T20:00:00.000Z'
  },
  {
    id: uuidv4(),
    bookId: bookIds[0],
    bookTitle: '好饿的毛毛虫',
    readDate: '2025-06-05',
    duration: 12,
    babyAgeMonths: 11,
    reaction: '',
    notes: '',
    createdAt: '2025-06-05T20:00:00.000Z'
  },
  {
    id: uuidv4(),
    bookId: bookIds[7],
    bookTitle: '脸，脸，各种各样的脸',
    readDate: '2025-06-08',
    duration: 10,
    babyAgeMonths: 12,
    reaction: '会模仿表情了',
    notes: '',
    createdAt: '2025-06-08T20:00:00.000Z'
  },
  {
    id: uuidv4(),
    bookId: bookIds[1],
    bookTitle: '猜猜我有多爱你',
    readDate: '2025-05-20',
    duration: 20,
    babyAgeMonths: 11,
    reaction: '不太能理解',
    notes: '',
    createdAt: '2025-05-20T20:00:00.000Z'
  }
];

export const themes: BookTheme[] = [
  '认知启蒙',
  '情绪管理',
  '习惯养成',
  '自然科普',
  '安全教育',
  '品格培养',
  '想象力',
  '数学逻辑',
  '语言启蒙',
  '艺术审美'
];

export const interactionTypes: InteractionType[] = ['翻翻', '触摸', '发声', '普通'];

export let rotationPlans: RotationPlan[] = [];

export const CURRENT_USER_ID = 'user-self';
export const CURRENT_USER_NAME = '小宝妈妈';

export let sharingCircles: SharingCircle[] = [
  {
    id: uuidv4(),
    name: '小区亲友绘本共享圈',
    description: '小区邻居和亲友们的绘本共享交流平台',
    creatorId: CURRENT_USER_ID,
    creatorName: CURRENT_USER_NAME,
    members: [
      { id: CURRENT_USER_ID, name: CURRENT_USER_NAME, role: '创建者', joinedAt: '2025-05-01T00:00:00.000Z' },
      { id: 'user-2', name: '小明妈妈', role: '成员', joinedAt: '2025-05-05T00:00:00.000Z' },
      { id: 'user-3', name: '小红爸爸', role: '成员', joinedAt: '2025-05-10T00:00:00.000Z' },
      { id: 'user-4', name: '小华妈妈', role: '成员', joinedAt: '2025-05-15T00:00:00.000Z' }
    ],
    createdAt: '2025-05-01T00:00:00.000Z',
    updatedAt: '2025-05-01T00:00:00.000Z'
  }
];

export let sharedBooks: SharedBook[] = [
  {
    id: uuidv4(),
    circleId: sharingCircles[0].id,
    bookId: bookIds[0],
    book: books[0],
    ownerId: CURRENT_USER_ID,
    ownerName: CURRENT_USER_NAME,
    borrowCycleDays: 14,
    preferredExchangeThemes: ['认知启蒙', '自然科普'],
    acceptTransfer: false,
    notes: '书本保持完好，无涂鸦',
    borrowStatus: '可借',
    addedAt: '2025-05-02T00:00:00.000Z',
    updatedAt: '2025-05-02T00:00:00.000Z'
  },
  {
    id: uuidv4(),
    circleId: sharingCircles[0].id,
    bookId: bookIds[1],
    book: books[1],
    ownerId: CURRENT_USER_ID,
    ownerName: CURRENT_USER_NAME,
    borrowCycleDays: 7,
    preferredExchangeThemes: ['情绪管理', '品格培养'],
    acceptTransfer: true,
    notes: '可接受转送',
    borrowStatus: '可借',
    addedAt: '2025-05-03T00:00:00.000Z',
    updatedAt: '2025-05-03T00:00:00.000Z'
  },
  {
    id: uuidv4(),
    circleId: sharingCircles[0].id,
    bookId: bookIds[3],
    book: books[3],
    ownerId: CURRENT_USER_ID,
    ownerName: CURRENT_USER_NAME,
    borrowCycleDays: 10,
    preferredExchangeThemes: ['品格培养', '习惯养成'],
    acceptTransfer: false,
    borrowStatus: '可借',
    addedAt: '2025-05-04T00:00:00.000Z',
    updatedAt: '2025-05-04T00:00:00.000Z'
  },
  {
    id: uuidv4(),
    circleId: sharingCircles[0].id,
    bookId: bookIds[5],
    book: books[5],
    ownerId: 'user-2',
    ownerName: '小明妈妈',
    borrowCycleDays: 7,
    preferredExchangeThemes: ['认知启蒙', '语言启蒙'],
    acceptTransfer: false,
    notes: '发声功能完好',
    borrowStatus: '可借',
    addedAt: '2025-05-08T00:00:00.000Z',
    updatedAt: '2025-05-08T00:00:00.000Z'
  },
  {
    id: uuidv4(),
    circleId: sharingCircles[0].id,
    bookId: bookIds[7],
    book: books[7],
    ownerId: 'user-3',
    ownerName: '小红爸爸',
    borrowCycleDays: 14,
    preferredExchangeThemes: ['情绪管理', '艺术审美'],
    acceptTransfer: true,
    borrowStatus: '借出中',
    currentBorrowerId: CURRENT_USER_ID,
    currentBorrowerName: CURRENT_USER_NAME,
    addedAt: '2025-05-12T00:00:00.000Z',
    updatedAt: '2025-06-05T00:00:00.000Z'
  }
];

export let exchangeInvitations: ExchangeInvitation[] = [
  {
    id: uuidv4(),
    circleId: sharingCircles[0].id,
    initiatorId: 'user-2',
    initiatorName: '小明妈妈',
    targetBookId: sharedBooks[0].id,
    targetBook: sharedBooks[0],
    offeredBookId: sharedBooks[3].id,
    offeredBook: sharedBooks[3],
    expectedExchangeDate: '2025-06-20',
    message: '我家宝宝很喜欢毛毛虫，想换一下看看',
    status: '待确认',
    createdAt: '2025-06-10T00:00:00.000Z',
    updatedAt: '2025-06-10T00:00:00.000Z'
  },
  {
    id: uuidv4(),
    circleId: sharingCircles[0].id,
    initiatorId: CURRENT_USER_ID,
    initiatorName: CURRENT_USER_NAME,
    targetBookId: sharedBooks[3].id,
    targetBook: sharedBooks[3],
    offeredBookId: sharedBooks[1].id,
    offeredBook: sharedBooks[1],
    expectedExchangeDate: '2025-06-18',
    message: '想借这本发声书给宝宝听听',
    status: '已接受',
    responseAt: '2025-06-12T00:00:00.000Z',
    createdAt: '2025-06-08T00:00:00.000Z',
    updatedAt: '2025-06-12T00:00:00.000Z'
  }
];

export let assessmentReports: AssessmentReport[] = [];

export const bookConditions: BookCondition[] = ['全新', '良好', '一般', '较差', '破损'];
export const damageTypes: DamageType[] = ['污渍', '缺页', '发声失灵', '撕页', '涂鸦', '装订松散', '书脊损坏', '封面磨损', '其他'];
export const damageRiskLevels: DamageRiskLevel[] = ['低', '中', '高', '极高'];

export const generateInitialCareProfiles = (): BookCareProfile[] => {
  const profiles: BookCareProfile[] = [];
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    const borrowCount = borrowRecords.filter(br => br.bookId === book.id).length;
    const readCount = readingRecords.filter(rr => rr.bookId === book.id).length;

    let condition: BookCondition = '良好';
    let riskLevel: DamageRiskLevel = '低';
    let isPaused = false;
    const reasons: string[] = [];
    const damageRecords: DamageRecord[] = [];
    const repairRecords: RepairRecord[] = [];
    const reminders: CareReminder[] = [];

    if (borrowCount >= 3) {
      condition = '一般';
      riskLevel = '中';
      reasons.push('借阅次数较多');
    }
    if (readCount >= 5) {
      condition = '一般';
      riskLevel = '中';
      reasons.push('阅读频次较高');
    }
    if (book.interactionType === '翻翻') {
      reasons.push('翻翻书损耗风险较高');
    }
    if (book.interactionType === '发声') {
      riskLevel = borrowCount >= 2 ? '高' : '中';
      reasons.push('发声书电子元件易损坏');
    }
    if (reasons.length === 0) {
      reasons.push('状态良好，风险较低');
    }

    if (i === 0) {
      damageRecords.push({
        id: uuidv4(),
        bookId: book.id,
        bookTitle: book.title,
        damageType: '污渍',
        severity: '轻微',
        description: '封面有轻微的果汁污渍',
        location: '封面右下角',
        discoveredDate: '2025-05-20',
        discoveredBy: CURRENT_USER_NAME,
        resolved: false,
        createdAt: '2025-05-20T00:00:00.000Z',
        updatedAt: '2025-05-20T00:00:00.000Z'
      });
      condition = '一般';
      riskLevel = '中';
      reasons.push('存在未处理的轻微污渍');
    }

    if (i === 5) {
      damageRecords.push({
        id: uuidv4(),
        bookId: book.id,
        bookTitle: book.title,
        damageType: '发声失灵',
        severity: '严重',
        description: '两个发声按钮失灵',
        location: '第3页和第5页',
        discoveredDate: '2025-06-05',
        discoveredBy: CURRENT_USER_NAME,
        resolved: false,
        createdAt: '2025-06-05T00:00:00.000Z',
        updatedAt: '2025-06-05T00:00:00.000Z'
      });
      repairRecords.push({
        id: uuidv4(),
        bookId: book.id,
        bookTitle: book.title,
        repairType: '更换电池/检查电路',
        description: '尝试更换电池',
        repairDate: '2025-06-06',
        repairedBy: CURRENT_USER_NAME,
        status: '处理中',
        createdAt: '2025-06-06T00:00:00.000Z',
        updatedAt: '2025-06-06T00:00:00.000Z'
      });
      condition = '较差';
      riskLevel = '高';
      isPaused = true;
      reasons.length = 0;
      reasons.push('发声功能严重故障');
      reasons.push('维修中');

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      reminders.push({
        id: uuidv4(),
        bookId: book.id,
        bookTitle: book.title,
        type: '维修跟进',
        title: '发声书维修跟进',
        description: '检查发声功能维修情况复查',
        scheduledDate: nextWeek.toISOString().split('T')[0],
        isCompleted: false,
        priority: 'high',
        createdAt: now,
        updatedAt: now
      });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    reminders.push({
      id: uuidv4(),
      bookId: book.id,
      bookTitle: book.title,
      type: '清洁消毒',
      title: '定期清洁消毒',
      description: '建议每30天进行一次清洁消毒',
      scheduledDate: thirtyDaysAgo.toISOString().split('T')[0],
      isCompleted: i < 3,
      completedAt: i < 3 ? thirtyDaysAgo.toISOString().split('T')[0] : undefined,
      priority: 'medium',
      createdAt: thirtyDaysAgo.toISOString(),
      updatedAt: thirtyDaysAgo.toISOString()
    });

    if (!reminders.some(r => r.type === '损耗复查' && !r.isCompleted)) {
      const twoWeeksLater = new Date();
      twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
      reminders.push({
        id: uuidv4(),
        bookId: book.id,
        bookTitle: book.title,
        type: '损耗复查',
        title: '定期损耗检查',
        description: '检查绘本是否有新增损耗',
        scheduledDate: twoWeeksLater.toISOString().split('T')[0],
        isCompleted: false,
        priority: 'low',
        createdAt: now,
        updatedAt: now
      });
    }

    profiles.push({
      id: uuidv4(),
      bookId: book.id,
      bookTitle: book.title,
      currentCondition: condition,
      lastCleanDate: i < 3 ? thirtyDaysAgo.toISOString().split('T')[0] : undefined,
      lastInspectionDate: i < 5 ? twoWeeksAgo.toISOString().split('T')[0] : undefined,
      totalBorrowCount: borrowCount,
      totalReadCount: readCount,
      damageRiskLevel: riskLevel,
      damageRiskReasons: reasons,
      isCirculationPaused: isPaused,
      pauseReason: isPaused ? '维修中' : undefined,
      expectedResumeDate: isPaused ? new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0] : undefined,
      damageRecords,
      repairRecords,
      reminders,
      createdAt: now,
      updatedAt: now
    });
  }

  return profiles;
};

export let bookCareProfiles: BookCareProfile[] = generateInitialCareProfiles();
