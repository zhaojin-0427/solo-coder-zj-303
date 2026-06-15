<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { sharingApi, bookApi, metaApi } from '@/api'
import type {
  SharingCircle,
  SharedBook,
  ExchangeInvitation,
  BookTheme,
  InteractionType,
  Book,
  SharedBookBorrowStatus,
  ExchangeInvitationStatus
} from '@/types'
import { getLocalDateString } from '@/utils/date'

const loading = ref(false)
const circles = ref<SharingCircle[]>([])
const sharedBooks = ref<SharedBook[]>([])
const mySharedBooks = ref<SharedBook[]>([])
const exchanges = ref<ExchangeInvitation[]>([])
const myBooks = ref<Book[]>([])
const themes = ref<BookTheme[]>([])
const interactionTypes = ref<InteractionType[]>([])
const currentUserId = ref('')
const currentUserName = ref('')

const activeTab = ref<'books' | 'invitations'>('books')
const invitationTab = ref<'sent' | 'received'>('received')

const filterCircle = ref('')
const filterTheme = ref('')
const filterMonth = ref<number | ''>('')
const filterInteraction = ref('')
const filterBorrowStatus = ref('')
const filterOwner = ref<'all' | 'mine' | 'others'>('all')

const showCircleModal = ref(false)
const showJoinCircleModal = ref(false)
const showAddBookModal = ref(false)
const showExchangeModal = ref(false)
const showRejectModal = ref(false)

const newCircleForm = ref({ name: '', description: '' })
const joinCircleForm = ref({ circleId: '', memberName: '' })

const addBookForm = ref({
  circleId: '',
  bookId: '',
  borrowCycleDays: 14,
  preferredExchangeThemes: [] as BookTheme[],
  acceptTransfer: false,
  notes: ''
})

const exchangeForm = ref({
  circleId: '',
  targetBookId: '',
  offeredBookId: '',
  expectedExchangeDate: '',
  message: ''
})
const rejectForm = ref({ exchangeId: '', rejectReason: '' })

const statusColors: Record<SharedBookBorrowStatus, string> = {
  '可借': '#52c41a',
  '借出中': '#faad14',
  '已预留': '#1890ff',
  '已转送': '#8c8c8c'
}

const inviteStatusColors: Record<ExchangeInvitationStatus, string> = {
  '待确认': '#faad14',
  '已接受': '#1890ff',
  '已拒绝': '#ff4d4f',
  '已完成': '#52c41a',
  '已取消': '#8c8c8c'
}

const loadAll = async () => {
  loading.value = true
  try {
    const [u, c, t, it, bs] = await Promise.all([
      sharingApi.getCurrentUser(),
      sharingApi.getCircles(),
      metaApi.getThemes() as Promise<BookTheme[]>,
      metaApi.getInteractionTypes() as Promise<InteractionType[]>,
      bookApi.getList({ status: '在家' })
    ])
    currentUserId.value = u.userId
    currentUserName.value = u.userName
    circles.value = c
    themes.value = t
    interactionTypes.value = it
    myBooks.value = bs
    if (c.length > 0) {
      filterCircle.value = c[0].id
      addBookForm.value.circleId = c[0].id
      joinCircleForm.value.circleId = c[0].id
      exchangeForm.value.circleId = c[0].id
    }
    await loadSharedBooks()
    await loadExchanges()
    await loadMySharedBooks()
  } catch (e) {
    console.error('加载共享数据失败', e)
  } finally {
    loading.value = false
  }
}

const loadSharedBooks = async () => {
  try {
    const params: any = {}
    if (filterCircle.value) params.circleId = filterCircle.value
    if (filterTheme.value) params.theme = filterTheme.value
    if (filterMonth.value !== '') {
      params.minMonth = filterMonth.value
      params.maxMonth = filterMonth.value
    }
    if (filterInteraction.value) params.interactionType = filterInteraction.value
    if (filterBorrowStatus.value) params.borrowStatus = filterBorrowStatus.value
    let list = await sharingApi.getSharedBooks(params)
    if (filterOwner.value === 'mine') {
      list = list.filter(sb => sb.ownerId === currentUserId.value)
    } else if (filterOwner.value === 'others') {
      list = list.filter(sb => sb.ownerId !== currentUserId.value)
    }
    sharedBooks.value = list
  } catch (e) {
    console.error('加载共享书单失败', e)
  }
}

const loadMySharedBooks = async () => {
  try {
    mySharedBooks.value = await sharingApi.getMySharedBooks()
  } catch (e) {
    console.error('加载我的共享书单失败', e)
  }
}

const loadExchanges = async () => {
  try {
    exchanges.value = await sharingApi.getExchanges()
  } catch (e) {
    console.error('加载换书邀约失败', e)
  }
}

const sentInvitations = computed(() =>
  exchanges.value.filter(e => e.initiatorId === currentUserId.value)
)

const receivedInvitations = computed(() =>
  exchanges.value.filter(e => e.targetBook.ownerId === currentUserId.value)
)

const pendingReceivedCount = computed(() =>
  receivedInvitations.value.filter(e => e.status === '待确认').length
)

const pendingSentCount = computed(() =>
  sentInvitations.value.filter(e => e.status === '待确认').length
)

const availableBooksToShare = computed(() => {
  const sharedBookIds = mySharedBooks.value.map(sb => sb.bookId)
  return myBooks.value.filter(b =>
    b.status === '在家' && !sharedBookIds.includes(b.id)
  )
})

const myAvailableSharedBooks = computed(() =>
  mySharedBooks.value.filter(sb =>
    sb.borrowStatus === '可借'
  )
)

const openCircleModal = () => {
  newCircleForm.value = { name: '', description: '' }
  showCircleModal.value = true
}

const createCircle = async () => {
  if (!newCircleForm.value.name.trim()) {
    alert('共享圈名称不能为空')
    return
  }
  try {
    const nc = await sharingApi.createCircle({
      name: newCircleForm.value.name.trim(),
      description: newCircleForm.value.description.trim() || undefined
    })
    circles.value.unshift(nc)
    filterCircle.value = nc.id
    addBookForm.value.circleId = nc.id
    showCircleModal.value = false
    await loadSharedBooks()
  } catch (e: any) {
    alert(e.response?.data?.error || '创建共享圈失败')
  }
}

const openJoinCircleModal = () => {
  joinCircleForm.value = {
    circleId: circles.value[0]?.id || '',
    memberName: ''
  }
  showJoinCircleModal.value = true
}

const joinCircle = async () => {
  if (!joinCircleForm.value.memberName.trim()) {
    alert('成员名称不能为空')
    return
  }
  try {
    await sharingApi.joinCircle(
      joinCircleForm.value.circleId,
      joinCircleForm.value.memberName.trim()
    )
    showJoinCircleModal.value = false
    const updated = await sharingApi.getCircles()
    circles.value = updated
  } catch (e: any) {
    alert(e.response?.data?.error || '加入共享圈失败')
  }
}

const openAddBookModal = () => {
  addBookForm.value = {
    circleId: filterCircle.value || circles.value[0]?.id || '',
    bookId: '',
    borrowCycleDays: 14,
    preferredExchangeThemes: [],
    acceptTransfer: false,
    notes: ''
  }
  showAddBookModal.value = true
}

const toggleThemeSelection = (theme: BookTheme) => {
  const idx = addBookForm.value.preferredExchangeThemes.indexOf(theme)
  if (idx >= 0) {
    addBookForm.value.preferredExchangeThemes.splice(idx, 1)
  } else {
    addBookForm.value.preferredExchangeThemes.push(theme)
  }
}

const addSharedBook = async () => {
  const f = addBookForm.value
  if (!f.circleId) { alert('请选择共享圈'); return }
  if (!f.bookId) { alert('请选择绘本'); return }
  try {
    await sharingApi.addSharedBook({
      circleId: f.circleId,
      bookId: f.bookId,
      borrowCycleDays: f.borrowCycleDays || 14,
      preferredExchangeThemes: f.preferredExchangeThemes,
      acceptTransfer: f.acceptTransfer,
      notes: f.notes.trim() || undefined
    })
    showAddBookModal.value = false
    await loadSharedBooks()
    await loadMySharedBooks()
  } catch (e: any) {
    alert(e.response?.data?.error || '添加共享绘本失败')
  }
}

const removeSharedBook = async (sb: SharedBook) => {
  if (!confirm(`确定要将《${sb.book.title}》从共享书单移除吗？`)) return
  try {
    await sharingApi.removeSharedBook(sb.id)
    await loadSharedBooks()
    await loadMySharedBooks()
  } catch (e: any) {
    alert(e.response?.data?.error || '移除失败')
  }
}

const openExchangeModal = (targetBook: SharedBook) => {
  if (targetBook.ownerId === currentUserId.value) {
    alert('不能发起自己绘本的换书邀约')
    return
  }
  if (targetBook.borrowStatus !== '可借') {
    alert('该绘本当前不可借，无法发起邀约')
    return
  }
  if (myAvailableSharedBooks.value.length === 0) {
    alert('您暂无可交换的共享绘本，请先添加可借的共享绘本')
    return
  }
  exchangeForm.value = {
    circleId: targetBook.circleId,
    targetBookId: targetBook.id,
    offeredBookId: myAvailableSharedBooks.value[0]?.id || '',
    expectedExchangeDate: getLocalDateString(),
    message: ''
  }
  showExchangeModal.value = true
}

const createExchange = async () => {
  const f = exchangeForm.value
  if (!f.circleId) { alert('共享圈不能为空'); return }
  if (!f.targetBookId) { alert('请选择目标绘本'); return }
  if (!f.offeredBookId) { alert('请选择拟交换绘本'); return }
  if (!f.expectedExchangeDate) { alert('请选择期望交换时间'); return }
  if (f.targetBookId === f.offeredBookId) {
    alert('目标绘本和拟交换绘本不能相同')
    return
  }
  try {
    await sharingApi.createExchange({
      circleId: f.circleId,
      targetBookId: f.targetBookId,
      offeredBookId: f.offeredBookId,
      expectedExchangeDate: f.expectedExchangeDate,
      message: f.message.trim() || undefined
    })
    showExchangeModal.value = false
    await loadExchanges()
    await loadSharedBooks()
    alert('换书邀约已发送')
  } catch (e: any) {
    alert(e.response?.data?.error || '发起邀约失败')
  }
}

const acceptExchange = async (inv: ExchangeInvitation) => {
  if (!confirm('确定接受此换书邀约吗？双方绘本将标记为借出中。')) return
  try {
    await sharingApi.acceptExchange(inv.id)
    await loadExchanges()
    await loadSharedBooks()
    await loadMySharedBooks()
  } catch (e: any) {
    alert(e.response?.data?.error || '接受邀约失败')
  }
}

const openRejectModal = (inv: ExchangeInvitation) => {
  rejectForm.value = { exchangeId: inv.id, rejectReason: '' }
  showRejectModal.value = true
}

const rejectExchange = async () => {
  try {
    await sharingApi.rejectExchange(
      rejectForm.value.exchangeId,
      rejectForm.value.rejectReason.trim() || undefined
    )
    showRejectModal.value = false
    await loadExchanges()
  } catch (e: any) {
    alert(e.response?.data?.error || '拒绝邀约失败')
  }
}

const cancelExchange = async (inv: ExchangeInvitation) => {
  if (!confirm('确定取消此换书邀约吗？')) return
  try {
    await sharingApi.cancelExchange(inv.id)
    await loadExchanges()
  } catch (e: any) {
    alert(e.response?.data?.error || '取消邀约失败')
  }
}

const completeExchange = async (inv: ExchangeInvitation) => {
  if (!confirm('标记此换书为已完成？双方绘本将同步归还为可借状态。')) return
  try {
    await sharingApi.completeExchange(inv.id)
    await loadExchanges()
    await loadSharedBooks()
    await loadMySharedBooks()
  } catch (e: any) {
    alert(e.response?.data?.error || '完成邀约失败')
  }
}

const currentCircleName = computed(() => {
  const c = circles.value.find(x => x.id === filterCircle.value)
  return c?.name || ''
})

onMounted(() => {
  loadAll()
})
</script>

<template>
  <div class="sharing-page">
    <div class="page-header">
      <h1 class="page-title">🔄 共享换书</h1>
      <div class="header-actions">
        <button class="btn btn-outline" @click="openCircleModal">+ 创建共享圈</button>
        <button class="btn btn-outline" @click="openJoinCircleModal">👥 邀请成员</button>
        <button class="btn btn-primary" @click="openAddBookModal">+ 加入共享</button>
      </div>
    </div>

    <div class="tabs-bar">
      <div
        class="tab-item"
        :class="{ active: activeTab === 'books' }"
        @click="activeTab = 'books'"
      >
        📚 共享绘本
        <span class="tab-count">{{ sharedBooks.length }}</span>
      </div>
      <div
        class="tab-item"
        :class="{ active: activeTab === 'invitations' }"
        @click="activeTab = 'invitations'"
      >
        💌 换书邀约
        <span v-if="pendingReceivedCount > 0" class="tab-badge">{{ pendingReceivedCount }}</span>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else-if="activeTab === 'books'">
      <div class="filter-bar">
        <select v-model="filterCircle" @change="loadSharedBooks" class="filter-select">
          <option value="">全部共享圈</option>
          <option v-for="c in circles" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <select v-model="filterTheme" @change="loadSharedBooks" class="filter-select">
          <option value="">全部主题</option>
          <option v-for="t in themes" :key="t" :value="t">{{ t }}</option>
        </select>
        <select v-model="filterMonth" @change="loadSharedBooks" class="filter-select">
          <option :value="''">适读月龄(全部)</option>
          <option v-for="m in [3,6,9,12,18,24,36,48]" :key="m" :value="m">{{ m }}月</option>
        </select>
        <select v-model="filterInteraction" @change="loadSharedBooks" class="filter-select">
          <option value="">互动形式(全部)</option>
          <option v-for="it in interactionTypes" :key="it" :value="it">{{ it }}</option>
        </select>
        <select v-model="filterBorrowStatus" @change="loadSharedBooks" class="filter-select">
          <option value="">可借状态(全部)</option>
          <option value="可借">可借</option>
          <option value="借出中">借出中</option>
          <option value="已预留">已预留</option>
          <option value="已转送">已转送</option>
        </select>
        <select v-model="filterOwner" @change="loadSharedBooks" class="filter-select">
          <option value="all">归属(全部)</option>
          <option value="mine">我共享的</option>
          <option value="others">他人共享的</option>
        </select>
        <button class="btn btn-outline refresh-btn" @click="loadSharedBooks">🔄 刷新</button>
      </div>

      <div v-if="circles.length > 0" class="current-circle-tip">
        当前：<strong>{{ currentCircleName || '全部共享圈' }}</strong> · 共 {{ circles[0]?.members?.length || 0 }} 位成员
      </div>

      <div v-if="sharedBooks.length === 0" class="empty-state">
        <span class="empty-icon">📚</span>
        <p>暂无符合条件的共享绘本，点击上方「加入共享」添加您的第一本</p>
      </div>

      <div v-else class="book-grid">
        <div v-for="sb in sharedBooks" :key="sb.id" class="shared-book-card">
          <div class="book-cover">
            <span class="book-emoji">📖</span>
          </div>
          <div class="book-body">
            <div class="book-header">
              <h3 class="book-title" :title="sb.book.title">{{ sb.book.title }}</h3>
              <span
                class="status-badge"
                :style="{ backgroundColor: statusColors[sb.borrowStatus] + '20', color: statusColors[sb.borrowStatus] }"
              >
                {{ sb.borrowStatus }}
              </span>
            </div>
            <div class="book-meta">
              <span class="author">作者：{{ sb.book.author }}</span>
              <span class="owner">· 归属：{{ sb.ownerName }}{{ sb.ownerId === currentUserId ? '(我)' : '' }}</span>
            </div>
            <div class="book-tags">
              <span class="tag theme-tag">{{ sb.book.theme }}</span>
              <span class="tag age-tag">{{ sb.book.minMonth }}-{{ sb.book.maxMonth }}月</span>
              <span class="tag interact-tag">{{ sb.book.interactionType }}</span>
              <span class="tag cycle-tag">可借{{ sb.borrowCycleDays }}天</span>
              <span v-if="sb.acceptTransfer" class="tag transfer-tag">可转送</span>
            </div>
            <div v-if="sb.preferredExchangeThemes.length > 0" class="pref-tags">
              <span class="pref-label">偏好主题：</span>
              <span v-for="pt in sb.preferredExchangeThemes" :key="pt" class="tag pref-tag">{{ pt }}</span>
            </div>
            <div v-if="sb.notes" class="book-notes">📝 {{ sb.notes }}</div>
            <div v-if="sb.currentBorrowerName" class="borrower-info">
              👤 当前借用人：{{ sb.currentBorrowerName }}
            </div>
          </div>
          <div class="card-actions">
            <button
              v-if="sb.ownerId !== currentUserId && sb.borrowStatus === '可借'"
              class="btn btn-primary btn-sm"
              @click="openExchangeModal(sb)"
            >
              发起换书
            </button>
            <button
              v-if="sb.ownerId === currentUserId"
              class="btn btn-danger-outline btn-sm"
              @click="removeSharedBook(sb)"
            >
              移除
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="invitations-section">
      <div class="sub-tabs">
        <div
          class="sub-tab"
          :class="{ active: invitationTab === 'received' }"
          @click="invitationTab = 'received'"
        >
          📥 收到的邀约
          <span v-if="pendingReceivedCount > 0" class="sub-tab-badge">{{ pendingReceivedCount }}</span>
        </div>
        <div
          class="sub-tab"
          :class="{ active: invitationTab === 'sent' }"
          @click="invitationTab = 'sent'"
        >
          📤 发出的邀约
          <span v-if="pendingSentCount > 0" class="sub-tab-badge">{{ pendingSentCount }}</span>
        </div>
      </div>

      <template v-if="invitationTab === 'received'">
        <div v-if="receivedInvitations.length === 0" class="empty-state">
          <span class="empty-icon">📭</span>
          <p>暂无收到的换书邀约</p>
        </div>
        <div v-else class="invitation-list">
          <div v-for="inv in receivedInvitations" :key="inv.id" class="invitation-card">
            <div class="inv-status-row">
              <span class="inv-status" :style="{ backgroundColor: inviteStatusColors[inv.status] + '20', color: inviteStatusColors[inv.status] }">
                {{ inv.status }}
              </span>
              <span class="inv-date">发起于 {{ inv.createdAt.split('T')[0] }}</span>
            </div>
            <div class="inv-swap-row">
              <div class="inv-book-block">
                <div class="inv-label">发起人：{{ inv.initiatorName }}</div>
                <div class="inv-book-title">拟交换：《{{ inv.offeredBook.book.title }}》</div>
                <div class="inv-book-meta">{{ inv.offeredBook.book.theme }} · {{ inv.offeredBook.book.minMonth }}-{{ inv.offeredBook.book.maxMonth }}月</div>
              </div>
              <div class="inv-arrow">↔️</div>
              <div class="inv-book-block">
                <div class="inv-label">我需要出：</div>
                <div class="inv-book-title">《{{ inv.targetBook.book.title }}》</div>
                <div class="inv-book-meta">{{ inv.targetBook.book.theme }} · {{ inv.targetBook.book.minMonth }}-{{ inv.targetBook.book.maxMonth }}月</div>
              </div>
            </div>
            <div class="inv-detail">
              <div>期望交换：{{ inv.expectedExchangeDate }}</div>
              <div v-if="inv.message">留言：{{ inv.message }}</div>
              <div v-if="inv.rejectReason">拒绝原因：{{ inv.rejectReason }}</div>
            </div>
            <div v-if="inv.status === '待确认'" class="inv-actions">
              <button class="btn btn-primary btn-sm" @click="acceptExchange(inv)">✅ 接受</button>
              <button class="btn btn-danger-outline btn-sm" @click="openRejectModal(inv)">❌ 拒绝</button>
            </div>
            <div v-if="inv.status === '已接受'" class="inv-actions">
              <button class="btn btn-success btn-sm" @click="completeExchange(inv)">📦 标记完成</button>
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <div v-if="sentInvitations.length === 0" class="empty-state">
          <span class="empty-icon">📤</span>
          <p>暂无发出的换书邀约，去共享绘本列表发起一个吧</p>
        </div>
        <div v-else class="invitation-list">
          <div v-for="inv in sentInvitations" :key="inv.id" class="invitation-card">
            <div class="inv-status-row">
              <span class="inv-status" :style="{ backgroundColor: inviteStatusColors[inv.status] + '20', color: inviteStatusColors[inv.status] }">
                {{ inv.status }}
              </span>
              <span class="inv-date">发起于 {{ inv.createdAt.split('T')[0] }}</span>
            </div>
            <div class="inv-swap-row">
              <div class="inv-book-block">
                <div class="inv-label">我要换：</div>
                <div class="inv-book-title">《{{ inv.targetBook.book.title }}》</div>
                <div class="inv-book-meta">归属：{{ inv.targetBook.ownerName }}</div>
              </div>
              <div class="inv-arrow">↔️</div>
              <div class="inv-book-block">
                <div class="inv-label">我出：</div>
                <div class="inv-book-title">《{{ inv.offeredBook.book.title }}》</div>
                <div class="inv-book-meta">{{ inv.offeredBook.book.theme }} · {{ inv.offeredBook.book.minMonth }}-{{ inv.offeredBook.book.maxMonth }}月</div>
              </div>
            </div>
            <div class="inv-detail">
              <div>期望交换：{{ inv.expectedExchangeDate }}</div>
              <div v-if="inv.message">留言：{{ inv.message }}</div>
              <div v-if="inv.rejectReason">对方拒绝原因：{{ inv.rejectReason }}</div>
            </div>
            <div class="inv-actions">
              <button v-if="inv.status === '待确认'" class="btn btn-default-outline btn-sm" @click="cancelExchange(inv)">
                取消邀约
              </button>
              <button v-if="inv.status === '已接受'" class="btn btn-success btn-sm" @click="completeExchange(inv)">
                📦 标记完成
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 创建共享圈 Modal -->
    <div v-if="showCircleModal" class="modal-overlay" @click.self="showCircleModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>创建共享圈</h3>
          <button class="close-btn" @click="showCircleModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>共享圈名称 *</label>
            <input v-model="newCircleForm.name" type="text" placeholder="如：小区亲友绘本共享圈" />
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="newCircleForm.description" rows="3" placeholder="共享圈的介绍或说明"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showCircleModal = false">取消</button>
          <button class="btn btn-primary" @click="createCircle">创建</button>
        </div>
      </div>
    </div>

    <!-- 邀请成员 Modal -->
    <div v-if="showJoinCircleModal" class="modal-overlay" @click.self="showJoinCircleModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>邀请成员加入共享圈</h3>
          <button class="close-btn" @click="showJoinCircleModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>选择共享圈 *</label>
            <select v-model="joinCircleForm.circleId">
              <option v-for="c in circles" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>成员姓名/昵称 *</label>
            <input v-model="joinCircleForm.memberName" type="text" placeholder="如：小明妈妈" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showJoinCircleModal = false">取消</button>
          <button class="btn btn-primary" @click="joinCircle">添加成员</button>
        </div>
      </div>
    </div>

    <!-- 添加共享绘本 Modal -->
    <div v-if="showAddBookModal" class="modal-overlay" @click.self="showAddBookModal = false">
      <div class="modal modal-lg">
        <div class="modal-header">
          <h3>将绘本加入共享书单</h3>
          <button class="close-btn" @click="showAddBookModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label>选择共享圈 *</label>
              <select v-model="addBookForm.circleId">
                <option v-for="c in circles" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>可借周期(天) *</label>
              <input v-model.number="addBookForm.borrowCycleDays" type="number" min="1" max="90" />
            </div>
          </div>
          <div class="form-group">
            <label>选择绘本 * <span class="tip">(仅显示状态为「在家」且未共享的绘本)</span></label>
            <select v-model="addBookForm.bookId">
              <option value="">请选择要共享的绘本</option>
              <option v-for="b in availableBooksToShare" :key="b.id" :value="b.id">
                《{{ b.title }}》 - {{ b.theme }} ({{ b.minMonth }}-{{ b.maxMonth }}月)
              </option>
            </select>
            <div v-if="availableBooksToShare.length === 0" class="form-tip">
              暂无可共享的绘本，请先在绘本档案中添加状态为「在家」的绘本
            </div>
          </div>
          <div class="form-group">
            <label>偏好交换主题 <span class="tip">(可多选)</span></label>
            <div class="theme-checkboxes">
              <label v-for="t in themes" :key="t" class="checkbox-item">
                <input
                  type="checkbox"
                  :checked="addBookForm.preferredExchangeThemes.includes(t)"
                  @change="toggleThemeSelection(t)"
                />
                {{ t }}
              </label>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>是否接受转送</label>
              <select v-model="addBookForm.acceptTransfer">
                <option :value="false">不接受</option>
                <option :value="true">接受转送</option>
              </select>
            </div>
            <div class="form-group">&nbsp;</div>
          </div>
          <div class="form-group">
            <label>备注说明</label>
            <textarea v-model="addBookForm.notes" rows="2" placeholder="如：绘本状况、特别说明等"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showAddBookModal = false">取消</button>
          <button class="btn btn-primary" @click="addSharedBook">加入共享</button>
        </div>
      </div>
    </div>

    <!-- 发起换书邀约 Modal -->
    <div v-if="showExchangeModal" class="modal-overlay" @click.self="showExchangeModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>发起换书邀约</h3>
          <button class="close-btn" @click="showExchangeModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>目标绘本</label>
            <div class="selected-book-info">
              {{ (sharedBooks.find(s => s.id === exchangeForm.targetBookId))?.book.title }}
            </div>
          </div>
          <div class="form-group">
            <label>拟交换绘本 * <span class="tip">(我共享的、可借的绘本)</span></label>
            <select v-model="exchangeForm.offeredBookId">
              <option value="">请选择</option>
              <option v-for="sb in myAvailableSharedBooks" :key="sb.id" :value="sb.id">
                《{{ sb.book.title }}》 - {{ sb.book.theme }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>期望交换时间 *</label>
            <input v-model="exchangeForm.expectedExchangeDate" type="date" :min="getLocalDateString()" />
          </div>
          <div class="form-group">
            <label>留言</label>
            <textarea v-model="exchangeForm.message" rows="2" placeholder="给对方留言，说明换书原因等"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showExchangeModal = false">取消</button>
          <button class="btn btn-primary" @click="createExchange">发送邀约</button>
        </div>
      </div>
    </div>

    <!-- 拒绝邀约 Modal -->
    <div v-if="showRejectModal" class="modal-overlay" @click.self="showRejectModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>拒绝换书邀约</h3>
          <button class="close-btn" @click="showRejectModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>拒绝原因(可选)</label>
            <textarea v-model="rejectForm.rejectReason" rows="3" placeholder="简要说明拒绝原因"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showRejectModal = false">取消</button>
          <button class="btn btn-danger" @click="rejectExchange">确认拒绝</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sharing-page {
  max-width: 1280px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}
.btn-primary:hover { opacity: 0.9; }

.btn-outline {
  background: white;
  border: 1px solid #d9d9d9;
  color: #555;
}
.btn-outline:hover { border-color: #667eea; color: #667eea; }

.btn-default {
  background: #f5f5f5;
  color: #666;
}
.btn-default:hover { background: #eee; }

.btn-default-outline {
  background: white;
  border: 1px solid #d9d9d9;
  color: #666;
}
.btn-default-outline:hover { border-color: #999; }

.btn-danger {
  background: #ff4d4f;
  color: white;
}
.btn-danger:hover { background: #ff7875; }

.btn-danger-outline {
  background: white;
  border: 1px solid #ffa39e;
  color: #ff4d4f;
}
.btn-danger-outline:hover { background: #fff1f0; }

.btn-success {
  background: #52c41a;
  color: white;
}
.btn-success:hover { background: #73d13d; }

.btn-sm { padding: 6px 14px; font-size: 13px; }

.tabs-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  background: #f5f5f5;
  padding: 4px;
  border-radius: 10px;
  width: fit-content;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  border-radius: 8px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-item.active {
  background: white;
  color: #333;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.tab-count {
  font-size: 12px;
  background: #e8e8e8;
  padding: 1px 8px;
  border-radius: 10px;
}

.tab-badge {
  font-size: 12px;
  background: #ff4d4f;
  color: white;
  padding: 1px 8px;
  border-radius: 10px;
}

.loading {
  text-align: center;
  padding: 60px;
  color: #999;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
  align-items: center;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  font-size: 13px;
  background: white;
  cursor: pointer;
}

.refresh-btn {
  margin-left: auto;
}

.current-circle-tip {
  font-size: 13px;
  color: #888;
  margin-bottom: 16px;
  padding: 8px 12px;
  background: #f9f9ff;
  border-radius: 6px;
}

.empty-state {
  text-align: center;
  padding: 80px 40px;
  color: #999;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.empty-icon {
  font-size: 56px;
  display: block;
  margin-bottom: 16px;
}

.book-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
}

.shared-book-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  display: flex;
  gap: 14px;
  transition: all 0.2s;
  position: relative;
}

.shared-book-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.book-cover {
  width: 56px;
  height: 74px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.book-emoji { font-size: 26px; }

.book-body { flex: 1; min-width: 0; }

.book-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 4px;
}

.book-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
  flex-shrink: 0;
}

.book-meta {
  font-size: 12px;
  color: #888;
  margin-bottom: 6px;
}

.book-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
}

.theme-tag { background: #e6f7ff; color: #1890ff; }
.age-tag { background: #f6ffed; color: #52c41a; }
.interact-tag { background: #fff7e6; color: #fa8c16; }
.cycle-tag { background: #f9f0ff; color: #722ed1; }
.transfer-tag { background: #fff1f0; color: #f5222d; }

.pref-tags {
  font-size: 12px;
  color: #888;
  margin-bottom: 6px;
  line-height: 1.6;
}

.pref-label { color: #888; }
.pref-tag { background: #e6fffb; color: #13c2c2; }

.book-notes {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
  padding: 4px 8px;
  background: #fffbe6;
  border-radius: 4px;
}

.borrower-info {
  font-size: 12px;
  color: #d46b08;
  margin-top: 4px;
}

.card-actions {
  position: absolute;
  bottom: 12px;
  right: 12px;
}

.invitations-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.sub-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 1px solid #eee;
}

.sub-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all 0.2s;
}

.sub-tab.active {
  color: #667eea;
  border-bottom-color: #667eea;
  font-weight: 600;
}

.sub-tab-badge {
  font-size: 11px;
  background: #ff4d4f;
  color: white;
  padding: 1px 7px;
  border-radius: 10px;
}

.invitation-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.invitation-card {
  border: 1px solid #f0f0f0;
  border-radius: 10px;
  padding: 16px;
  transition: all 0.2s;
}

.invitation-card:hover {
  border-color: #d9d9d9;
  background: #fcfcfc;
}

.inv-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.inv-status {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 10px;
  font-weight: 500;
}

.inv-date { font-size: 12px; color: #999; }

.inv-swap-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
}

.inv-book-block { min-width: 0; }

.inv-label {
  font-size: 11px;
  color: #999;
  margin-bottom: 4px;
}

.inv-book-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.inv-book-meta {
  font-size: 12px;
  color: #888;
}

.inv-arrow {
  font-size: 22px;
  text-align: center;
}

.inv-detail {
  font-size: 13px;
  color: #666;
  line-height: 1.8;
  padding: 0 4px;
  margin-bottom: 12px;
}

.inv-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal {
  background: white;
  border-radius: 12px;
  width: 480px;
  max-width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-lg { width: 620px; }

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.close-btn {
  font-size: 24px;
  color: #999;
  line-height: 1;
  cursor: pointer;
  background: none;
  border: none;
}

.close-btn:hover { color: #555; }

.modal-body { padding: 20px 22px; }

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 22px;
  border-top: 1px solid #f0f0f0;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #555;
  font-weight: 500;
}

.tip { color: #999; font-weight: 400; font-size: 12px; }

.form-tip {
  font-size: 12px;
  color: #faad14;
  margin-top: 6px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 13px;
  transition: border-color 0.2s;
  box-sizing: border-box;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: #667eea;
  outline: none;
}

.selected-book-info {
  padding: 10px 12px;
  background: #f0f5ff;
  border-radius: 6px;
  color: #333;
  font-weight: 500;
  font-size: 13px;
  border: 1px solid #d6e4ff;
}

.theme-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  padding: 8px 0;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #555;
  cursor: pointer;
}

@media (max-width: 900px) {
  .book-grid { grid-template-columns: 1fr; }
  .inv-swap-row { grid-template-columns: 1fr; text-align: center; }
  .inv-arrow { transform: rotate(90deg); }
  .form-row { grid-template-columns: 1fr; }
}
</style>
