<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { bookApi, metaApi } from '@/api'
import type { Book, BookStatus, InteractionType, BookTheme } from '@/types'
import { getLocalDateString } from '@/utils/date'

const books = ref<Book[]>([])
const themes = ref<BookTheme[]>([])
const interactionTypes = ref<InteractionType[]>([])
const loading = ref(false)

const searchKeyword = ref('')
const filterStatus = ref<string>('')
const filterTheme = ref<string>('')

const showModal = ref(false)
const showBorrowModal = ref(false)
const editingBook = ref<Partial<Book>>({})
const isEdit = ref(false)

const statusColors: Record<BookStatus, string> = {
  '在家': '#52c41a',
  '借出': '#faad14',
  '预留': '#1890ff',
  '转送': '#8c8c8c'
}

const loadBooks = async () => {
  loading.value = true
  try {
    const params: any = {}
    if (filterStatus.value) params.status = filterStatus.value
    if (filterTheme.value) params.theme = filterTheme.value
    if (searchKeyword.value) params.search = searchKeyword.value
    books.value = await bookApi.getList(params)
  } catch (e) {
    console.error('加载绘本列表失败', e)
  } finally {
    loading.value = false
  }
}

const loadMeta = async () => {
  try {
    themes.value = await metaApi.getThemes() as BookTheme[]
    interactionTypes.value = await metaApi.getInteractionTypes() as InteractionType[]
  } catch (e) {
    console.error('加载元数据失败', e)
  }
}

const openAddModal = () => {
  isEdit.value = false
  editingBook.value = {
    title: '',
    author: '',
    theme: themes.value[0] || '认知启蒙',
    minMonth: 6,
    maxMonth: 24,
    interactionType: '普通',
    purchaseDate: getLocalDateString(),
    status: '在家',
    description: ''
  }
  showModal.value = true
}

const openEditModal = (book: Book) => {
  isEdit.value = true
  editingBook.value = { ...book }
  showModal.value = true
}

const saveBook = async () => {
  try {
    if (isEdit.value && editingBook.value.id) {
      await bookApi.update(editingBook.value.id, editingBook.value)
    } else {
      await bookApi.create(editingBook.value)
    }
    showModal.value = false
    loadBooks()
  } catch (e) {
    console.error('保存绘本失败', e)
  }
}

const deleteBook = async (id: string) => {
  if (!confirm('确定要删除这本绘本吗？')) return
  try {
    await bookApi.delete(id)
    loadBooks()
  } catch (e) {
    console.error('删除绘本失败', e)
  }
}

const updateStatus = async (book: Book, status: BookStatus) => {
  try {
    await bookApi.updateStatus(book.id, status)
    loadBooks()
  } catch (e) {
    console.error('更新状态失败', e)
  }
}

const stats = computed(() => {
  const total = books.value.length
  const atHome = books.value.filter(b => b.status === '在家').length
  const borrowed = books.value.filter(b => b.status === '借出').length
  const reserved = books.value.filter(b => b.status === '预留').length
  return { total, atHome, borrowed, reserved }
})

onMounted(() => {
  loadMeta().then(() => loadBooks())
})
</script>

<template>
  <div class="books-page">
    <div class="page-header">
      <h1 class="page-title">📚 绘本档案</h1>
      <button class="btn btn-primary" @click="openAddModal">
        + 新增绘本
      </button>
    </div>

    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">绘本总数</div>
      </div>
      <div class="stat-card home">
        <div class="stat-value">{{ stats.atHome }}</div>
        <div class="stat-label">在家</div>
      </div>
      <div class="stat-card borrowed">
        <div class="stat-value">{{ stats.borrowed }}</div>
        <div class="stat-label">借出中</div>
      </div>
      <div class="stat-card reserved">
        <div class="stat-value">{{ stats.reserved }}</div>
        <div class="stat-label">预留</div>
      </div>
    </div>

    <div class="filter-bar">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchKeyword"
          type="text"
          placeholder="搜索书名或作者..."
          @input="loadBooks"
        />
      </div>
      <select v-model="filterStatus" @change="loadBooks" class="filter-select">
        <option value="">全部状态</option>
        <option value="在家">在家</option>
        <option value="借出">借出</option>
        <option value="预留">预留</option>
        <option value="转送">转送</option>
      </select>
      <select v-model="filterTheme" @change="loadBooks" class="filter-select">
        <option value="">全部主题</option>
        <option v-for="theme in themes" :key="theme" :value="theme">{{ theme }}</option>
      </select>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else class="book-grid">
      <div v-for="book in books" :key="book.id" class="book-card">
        <div class="book-cover">
          <span class="book-emoji">📖</span>
        </div>
        <div class="book-info">
          <h3 class="book-title" :title="book.title">{{ book.title }}</h3>
          <p class="book-author">{{ book.author }}</p>
          <div class="book-tags">
            <span class="tag theme-tag">{{ book.theme }}</span>
            <span class="tag age-tag">{{ book.minMonth }}-{{ book.maxMonth }}月</span>
            <span class="tag interact-tag">{{ book.interactionType }}</span>
          </div>
          <div class="book-status">
            <span
              class="status-badge"
              :style="{ backgroundColor: statusColors[book.status] + '20', color: statusColors[book.status] }"
            >
              {{ book.status }}
            </span>
          </div>
        </div>
        <div class="book-actions">
          <button class="action-btn" @click="openEditModal(book)" title="编辑">✏️</button>
          <div class="action-dropdown">
            <button class="action-btn">⚙️</button>
            <div class="dropdown-menu">
              <button v-if="book.status === '在家'" @click="updateStatus(book, '借出')">标记借出</button>
              <button v-if="book.status === '借出'" @click="updateStatus(book, '在家')">标记归还</button>
              <button v-if="book.status === '在家'" @click="updateStatus(book, '预留')">标记预留</button>
              <button v-if="book.status === '在家'" @click="updateStatus(book, '转送')">标记转送</button>
              <button class="danger" @click="deleteBook(book.id)">删除</button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="books.length === 0" class="empty-state">
        <span class="empty-icon">📚</span>
        <p>暂无绘本，点击上方按钮添加第一本</p>
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ isEdit ? '编辑绘本' : '新增绘本' }}</h3>
          <button class="close-btn" @click="showModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label>绘本名称 *</label>
              <input v-model="editingBook.title" type="text" placeholder="请输入绘本名称" />
            </div>
            <div class="form-group">
              <label>作者</label>
              <input v-model="editingBook.author" type="text" placeholder="请输入作者" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>主题分类</label>
              <select v-model="editingBook.theme">
                <option v-for="theme in themes" :key="theme" :value="theme">{{ theme }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>互动形式</label>
              <select v-model="editingBook.interactionType">
                <option v-for="type in interactionTypes" :key="type" :value="type">{{ type }}</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>适读最小月龄</label>
              <input v-model.number="editingBook.minMonth" type="number" min="0" max="72" />
            </div>
            <div class="form-group">
              <label>适读最大月龄</label>
              <input v-model.number="editingBook.maxMonth" type="number" min="0" max="72" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>购入时间</label>
              <input v-model="editingBook.purchaseDate" type="date" />
            </div>
            <div class="form-group">
              <label>当前状态</label>
              <select v-model="editingBook.status">
                <option value="在家">在家</option>
                <option value="借出">借出</option>
                <option value="预留">预留</option>
                <option value="转送">转送</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>简介</label>
            <textarea v-model="editingBook.description" rows="3" placeholder="请输入绘本简介"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showModal = false">取消</button>
          <button class="btn btn-primary" @click="saveBook">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.books-page {
  max-width: 1200px;
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
  transform: translateY(-1px);
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

.stat-card.home .stat-value {
  color: #52c41a;
}

.stat-card.borrowed .stat-value {
  color: #faad14;
}

.stat-card.reserved .stat-value {
  color: #1890ff;
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  align-items: center;
}

.search-box {
  flex: 1;
  position: relative;
  max-width: 300px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
}

.search-box input {
  width: 100%;
  padding: 10px 12px 10px 36px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  font-size: 14px;
  background: white;
}

.search-box input:focus {
  border-color: #667eea;
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

.book-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.book-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  gap: 14px;
  transition: all 0.2s;
  position: relative;
}

.book-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.book-cover {
  width: 60px;
  height: 80px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.book-emoji {
  font-size: 28px;
}

.book-info {
  flex: 1;
  min-width: 0;
}

.book-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-author {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}

.book-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
}

.theme-tag {
  background: #e6f7ff;
  color: #1890ff;
}

.age-tag {
  background: #f6ffed;
  color: #52c41a;
}

.interact-tag {
  background: #fff7e6;
  color: #fa8c16;
}

.status-badge {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.book-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 4px;
}

.action-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #eee;
}

.action-dropdown {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  right: 0;
  top: 32px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 120px;
  z-index: 10;
  display: none;
}

.action-dropdown:hover .dropdown-menu {
  display: block;
}

.dropdown-menu button {
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  font-size: 13px;
  color: #333;
  transition: background 0.2s;
}

.dropdown-menu button:hover {
  background: #f5f5f5;
}

.dropdown-menu button.danger {
  color: #ff4d4f;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px;
  color: #999;
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
  width: 560px;
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
