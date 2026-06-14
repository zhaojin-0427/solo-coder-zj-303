<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { readingApi, bookApi, babyApi } from '@/api'
import type { ReadingRecord, Book, BabyInfo } from '@/types'
import { getLocalDateString } from '@/utils/date'

const records = ref<ReadingRecord[]>([])
const books = ref<Book[]>([])
const babyInfo = ref<BabyInfo | null>(null)
const loading = ref(false)

const showModal = ref(false)
const newRecord = ref({
  bookId: '',
  readDate: getLocalDateString(),
  duration: 15,
  reaction: '',
  notes: ''
})

const loadData = async () => {
  loading.value = true
  try {
    const [recs, bks, baby] = await Promise.all([
      readingApi.getList(),
      bookApi.getList(),
      babyApi.getInfo()
    ])
    records.value = recs
    books.value = bks
    babyInfo.value = baby
  } catch (e) {
    console.error('加载数据失败', e)
  } finally {
    loading.value = false
  }
}

const openAddModal = () => {
  newRecord.value = {
    bookId: books.value[0]?.id || '',
    readDate: getLocalDateString(),
    duration: 15,
    reaction: '',
    notes: ''
  }
  showModal.value = true
}

const submitRecord = async () => {
  if (!newRecord.value.bookId) {
    alert('请选择绘本')
    return
  }
  try {
    await readingApi.create({
      ...newRecord.value,
      babyAgeMonths: babyInfo.value?.ageMonths
    })
    showModal.value = false
    loadData()
  } catch (e) {
    console.error('打卡失败', e)
  }
}

const deleteRecord = async (id: string) => {
  if (!confirm('确定要删除这条阅读记录吗？')) return
  try {
    await readingApi.delete(id)
    loadData()
  } catch (e) {
    console.error('删除失败', e)
  }
}

const stats = computed(() => {
  const totalCount = records.value.length
  const totalTime = records.value.reduce((sum, r) => sum + r.duration, 0)
  
  const thisMonth = new Date().getMonth()
  const thisMonthRecords = records.value.filter(r => {
    const d = new Date(r.readDate)
    return d.getMonth() === thisMonth && d.getFullYear() === new Date().getFullYear()
  })
  
  const uniqueDays = new Set(thisMonthRecords.map(r => r.readDate)).size
  
  const streak = calculateStreak()
  
  return { totalCount, totalTime, monthlyCount: thisMonthRecords.length, uniqueDays, streak }
})

const calculateStreak = () => {
  if (records.value.length === 0) return 0
  
  const dates = new Set(records.value.map(r => r.readDate))
  let streak = 0
  let today = new Date()
  
  const getDateStr = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  for (let i = 0; i < 365; i++) {
    const dateStr = getDateStr(today)
    if (dates.has(dateStr)) {
      streak++
      today.setDate(today.getDate() - 1)
    } else if (i === 0) {
      today.setDate(today.getDate() - 1)
    } else {
      break
    }
  }
  
  return streak
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${month}月${day}日 ${weekdays[d.getDay()]}`
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="reading-page">
    <div class="page-header">
      <h1 class="page-title">📝 阅读打卡</h1>
      <button class="btn btn-primary" @click="openAddModal">
        + 今日打卡
      </button>
    </div>

    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-icon">🔥</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.streak }}</div>
          <div class="stat-label">连续打卡</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📅</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.uniqueDays }}</div>
          <div class="stat-label">本月阅读天数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⏱️</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.totalTime }}</div>
          <div class="stat-label">累计阅读(分钟)</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📚</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.totalCount }}</div>
          <div class="stat-label">总打卡次数</div>
        </div>
      </div>
    </div>

    <h3 class="section-title">📖 阅读记录</h3>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else class="record-timeline">
      <div
        v-for="record in records"
        :key="record.id"
        class="timeline-item"
      >
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="date-badge">{{ formatDate(record.readDate) }}</span>
            <span class="age-tag">{{ record.babyAgeMonths }}月龄</span>
          </div>
          <div class="record-card-inner">
            <div class="record-book-info">
              <h4 class="book-title">{{ record.bookTitle }}</h4>
              <div class="record-detail">
                <span class="duration">⏱️ 阅读 {{ record.duration }} 分钟</span>
              </div>
              <div v-if="record.reaction" class="record-reaction">
                <span class="label">宝宝反应：</span>
                <span class="content">{{ record.reaction }}</span>
              </div>
              <div v-if="record.notes" class="record-notes">
                <span class="label">备注：</span>
                <span class="content">{{ record.notes }}</span>
              </div>
            </div>
            <button class="delete-btn" @click="deleteRecord(record.id)" title="删除">
              🗑️
            </button>
          </div>
        </div>
      </div>

      <div v-if="records.length === 0" class="empty-state">
        <span class="empty-icon">📝</span>
        <p>还没有阅读记录</p>
        <p class="sub">点击上方按钮开始第一次打卡吧</p>
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>阅读打卡</h3>
          <button class="close-btn" @click="showModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>选择绘本 *</label>
            <select v-model="newRecord.bookId">
              <option value="">请选择绘本</option>
              <option v-for="book in books" :key="book.id" :value="book.id">
                {{ book.title }} ({{ book.theme }})
              </option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>阅读日期</label>
              <input v-model="newRecord.readDate" type="date" />
            </div>
            <div class="form-group">
              <label>阅读时长(分钟)</label>
              <input v-model.number="newRecord.duration" type="number" min="1" />
            </div>
          </div>
          <div class="form-group">
            <label>宝宝反应</label>
            <input
              v-model="newRecord.reaction"
              type="text"
              placeholder="例如：很喜欢、不太感兴趣..."
            />
          </div>
          <div class="form-group">
            <label>备注</label>
            <textarea v-model="newRecord.notes" rows="3" placeholder="选填"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showModal = false">取消</button>
          <button class="btn btn-primary" @click="submitRecord">打卡</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reading-page {
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-default {
  background: #f5f5f5;
  color: #666;
}

.btn-default:hover {
  background: #eee;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 28px;
}

.stat-card {
  background: white;
  padding: 18px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  gap: 14px;
}

.stat-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.stat-content {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #333;
  margin-bottom: 2px;
}

.stat-label {
  font-size: 12px;
  color: #999;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 16px;
}

.loading {
  text-align: center;
  padding: 60px;
  color: #999;
}

.record-timeline {
  position: relative;
  padding-left: 24px;
}

.record-timeline::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: #e8e8e8;
}

.timeline-item {
  position: relative;
  margin-bottom: 20px;
}

.timeline-dot {
  position: absolute;
  left: -20px;
  top: 24px;
  width: 12px;
  height: 12px;
  background: #667eea;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 0 0 2px #667eea;
}

.timeline-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.timeline-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
}

.date-badge {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.age-tag {
  font-size: 12px;
  padding: 2px 8px;
  background: #e6f7ff;
  color: #1890ff;
  border-radius: 10px;
}

.record-card-inner {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.record-book-info {
  flex: 1;
  min-width: 0;
}

.book-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.record-detail {
  margin-bottom: 8px;
}

.duration {
  font-size: 13px;
  color: #666;
}

.record-reaction,
.record-notes {
  font-size: 13px;
  margin-top: 6px;
}

.record-reaction .label,
.record-notes .label {
  color: #999;
}

.record-reaction .content,
.record-notes .content {
  color: #666;
}

.delete-btn {
  font-size: 18px;
  opacity: 0.6;
  padding: 4px;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.delete-btn:hover {
  opacity: 1;
}

.empty-state {
  text-align: center;
  padding: 60px;
  color: #999;
  background: white;
  border-radius: 12px;
  margin-left: -24px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  display: block;
}

.empty-state .sub {
  font-size: 13px;
  margin-top: 4px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 12px;
  width: 480px;
  max-width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.close-btn {
  font-size: 24px;
  color: #999;
  line-height: 1;
  cursor: pointer;
}

.close-btn:hover {
  color: #666;
}

.modal-body {
  padding: 20px 24px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #666;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: #667eea;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid #f0f0f0;
}
</style>
