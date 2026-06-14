<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { borrowApi, bookApi } from '@/api'
import type { BorrowRecord, Book } from '@/types'

const records = ref<BorrowRecord[]>([])
const books = ref<Book[]>([])
const loading = ref(false)

const filterStatus = ref<string>('')
const showModal = ref(false)
const newBorrow = ref({
  bookId: '',
  borrower: '',
  borrowerPhone: '',
  borrowDate: new Date().toISOString().split('T')[0],
  expectedReturnDate: '',
  notes: ''
})

const statusColors: Record<string, string> = {
  '借出中': '#faad14',
  '已归还': '#52c41a',
  '逾期': '#ff4d4f'
}

const loadRecords = async () => {
  loading.value = true
  try {
    const params: any = {}
    if (filterStatus.value) params.status = filterStatus.value
    records.value = await borrowApi.getList(params)
  } catch (e) {
    console.error('加载借阅记录失败', e)
  } finally {
    loading.value = false
  }
}

const loadBooks = async () => {
  try {
    const list = await bookApi.getList({ status: '在家' })
    books.value = list
  } catch (e) {
    console.error('加载绘本列表失败', e)
  }
}

const openAddModal = () => {
  newBorrow.value = {
    bookId: '',
    borrower: '',
    borrowerPhone: '',
    borrowDate: new Date().toISOString().split('T')[0],
    expectedReturnDate: '',
    notes: ''
  }
  showModal.value = true
}

const submitBorrow = async () => {
  if (!newBorrow.value.bookId || !newBorrow.value.borrower || !newBorrow.value.expectedReturnDate) {
    alert('请填写完整信息')
    return
  }
  try {
    await borrowApi.create(newBorrow.value)
    showModal.value = false
    loadRecords()
    loadBooks()
  } catch (e: any) {
    alert(e.response?.data?.error || '借出失败')
  }
}

const returnBook = async (record: BorrowRecord) => {
  if (!confirm(`确认归还《${record.bookTitle}》？`)) return
  try {
    await borrowApi.returnBook(record.id)
    loadRecords()
    loadBooks()
  } catch (e) {
    console.error('归还失败', e)
  }
}

const deleteRecord = async (id: string) => {
  if (!confirm('确定要删除这条借阅记录吗？')) return
  try {
    await borrowApi.delete(id)
    loadRecords()
  } catch (e) {
    console.error('删除失败', e)
  }
}

const stats = computed(() => {
  const total = records.value.length
  const borrowing = records.value.filter(r => r.status === '借出中').length
  const returned = records.value.filter(r => r.status === '已归还').length
  const overdue = records.value.filter(r => r.status === '逾期').length
  return { total, borrowing, returned, overdue }
})

const formatDate = (dateStr: string) => {
  return dateStr
}

const getDaysRemaining = (expectedReturnDate: string) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expected = new Date(expectedReturnDate)
  expected.setHours(0, 0, 0, 0)
  const diff = Math.ceil((expected.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

onMounted(() => {
  loadRecords()
  loadBooks()
})
</script>

<template>
  <div class="borrow-page">
    <div class="page-header">
      <h1 class="page-title">📖 借阅记录</h1>
      <button class="btn btn-primary" @click="openAddModal">
        + 登记借出
      </button>
    </div>

    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">总借阅次数</div>
      </div>
      <div class="stat-card borrowing">
        <div class="stat-value">{{ stats.borrowing }}</div>
        <div class="stat-label">借出中</div>
      </div>
      <div class="stat-card returned">
        <div class="stat-value">{{ stats.returned }}</div>
        <div class="stat-label">已归还</div>
      </div>
      <div class="stat-card overdue">
        <div class="stat-value">{{ stats.overdue }}</div>
        <div class="stat-label">逾期</div>
      </div>
    </div>

    <div class="filter-bar">
      <select v-model="filterStatus" @change="loadRecords" class="filter-select">
        <option value="">全部状态</option>
        <option value="借出中">借出中</option>
        <option value="已归还">已归还</option>
        <option value="逾期">逾期</option>
      </select>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else class="record-list">
      <div v-for="record in records" :key="record.id" class="record-card">
        <div class="record-main">
          <div class="book-icon">📚</div>
          <div class="record-info">
            <h3 class="book-title">{{ record.bookTitle }}</h3>
            <div class="record-meta">
              <span class="borrower">👤 {{ record.borrower }}</span>
              <span class="phone" v-if="record.borrowerPhone">📞 {{ record.borrowerPhone }}</span>
            </div>
            <div class="record-dates">
              <span>📅 借出: {{ formatDate(record.borrowDate) }}</span>
              <span>📅 预计归还: {{ formatDate(record.expectedReturnDate) }}</span>
              <span v-if="record.actualReturnDate">✅ 实际归还: {{ formatDate(record.actualReturnDate) }}</span>
            </div>
            <div v-if="record.notes" class="record-notes">
              💬 {{ record.notes }}
            </div>
          </div>
        </div>
        <div class="record-side">
          <span
            class="status-badge"
            :style="{ backgroundColor: statusColors[record.status] + '20', color: statusColors[record.status] }"
          >
            {{ record.status }}
          </span>
          <div v-if="record.status === '借出中' || record.status === '逾期'" class="days-info">
            剩余 {{ getDaysRemaining(record.expectedReturnDate) }} 天
          </div>
          <div class="record-actions">
            <button
              v-if="record.status === '借出中' || record.status === '逾期'"
              class="btn btn-small btn-success"
              @click="returnBook(record)"
            >
              确认归还
            </button>
            <button class="btn btn-small btn-danger" @click="deleteRecord(record.id)">
              删除
            </button>
          </div>
        </div>
      </div>
      <div v-if="records.length === 0" class="empty-state">
        <span class="empty-icon">📖</span>
        <p>暂无借阅记录</p>
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>登记借出</h3>
          <button class="close-btn" @click="showModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>选择绘本 *</label>
            <select v-model="newBorrow.bookId">
              <option value="">请选择绘本</option>
              <option v-for="book in books" :key="book.id" :value="book.id">
                {{ book.title }} ({{ book.theme }})
              </option>
            </select>
            <p v-if="books.length === 0" class="form-hint">暂无在家的绘本</p>
          </div>
          <div class="form-group">
            <label>借阅人 *</label>
            <input v-model="newBorrow.borrower" type="text" placeholder="请输入借阅人姓名" />
          </div>
          <div class="form-group">
            <label>联系电话</label>
            <input v-model="newBorrow.borrowerPhone" type="tel" placeholder="请输入联系电话" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>借出日期</label>
              <input v-model="newBorrow.borrowDate" type="date" />
            </div>
            <div class="form-group">
              <label>预计归还日期 *</label>
              <input v-model="newBorrow.expectedReturnDate" type="date" />
            </div>
          </div>
          <div class="form-group">
            <label>备注</label>
            <textarea v-model="newBorrow.notes" rows="3" placeholder="选填"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showModal = false">取消</button>
          <button class="btn btn-primary" @click="submitBorrow">确认借出</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.borrow-page {
  max-width: 900px;
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

.btn-small {
  padding: 6px 14px;
  font-size: 13px;
  border-radius: 6px;
}

.btn-success {
  background: #52c41a;
  color: white;
}

.btn-success:hover {
  background: #49aa19;
}

.btn-danger {
  background: #fff1f0;
  color: #ff4d4f;
}

.btn-danger:hover {
  background: #ffccc7;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #333;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: #999;
}

.stat-card.borrowing .stat-value { color: #faad14; }
.stat-card.returned .stat-value { color: #52c41a; }
.stat-card.overdue .stat-value { color: #ff4d4f; }

.filter-bar {
  margin-bottom: 20px;
}

.filter-select {
  padding: 10px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.loading {
  text-align: center;
  padding: 60px;
  color: #999;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.record-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
}

.record-main {
  display: flex;
  gap: 16px;
  flex: 1;
}

.book-icon {
  font-size: 36px;
  flex-shrink: 0;
}

.record-info {
  flex: 1;
  min-width: 0;
}

.book-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.record-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #666;
}

.record-dates {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  color: #999;
  margin-bottom: 8px;
}

.record-notes {
  font-size: 13px;
  color: #666;
  background: #f5f5f5;
  padding: 8px 12px;
  border-radius: 6px;
  margin-top: 8px;
}

.record-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  flex-shrink: 0;
}

.status-badge {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 20px;
  font-weight: 500;
}

.days-info {
  font-size: 13px;
  color: #999;
}

.record-actions {
  display: flex;
  gap: 8px;
}

.empty-state {
  text-align: center;
  padding: 60px;
  color: #999;
  background: white;
  border-radius: 12px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  display: block;
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
  width: 500px;
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

.form-hint {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid #f0f0f0;
}
</style>
