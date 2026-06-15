<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { assessmentApi, bookApi } from '@/api'
import type { AssessmentReport, Book, AssessmentPeriodType, InterventionSuggestion } from '@/types'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { RadarChart, BarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([
  RadarChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  CanvasRenderer
])

const currentReport = ref<AssessmentReport | null>(null)
const reports = ref<AssessmentReport[]>([])
const books = ref<Book[]>([])
const loading = ref(false)
const generating = ref(false)

const showGenerateModal = ref(false)
const generateForm = ref<{
  periodType: AssessmentPeriodType
  periodStart: string
  periodEnd: string
}>({
  periodType: 'week',
  periodStart: '',
  periodEnd: ''
})

const showNotesModal = ref(false)
const editingNoteIndex = ref(-1)
const noteText = ref('')

const showHistoryModal = ref(false)

const selectedReportId = ref('')

const levelColorMap: Record<string, string> = {
  '优秀': '#52c41a',
  '良好': '#1890ff',
  '一般': '#faad14',
  '需关注': '#ff4d4f'
}

const levelBgMap: Record<string, string> = {
  '优秀': '#f6ffed',
  '良好': '#e6f7ff',
  '一般': '#fffbe6',
  '需关注': '#fff2f0'
}

const priorityLabelMap: Record<string, string> = {
  'high': '高优先',
  'medium': '中优先',
  'low': '低优先'
}

const priorityColorMap: Record<string, string> = {
  'high': '#ff4d4f',
  'medium': '#fa8c16',
  'low': '#1890ff'
}

const interventionStatusLabelMap: Record<string, string> = {
  'pending': '待执行',
  'in_progress': '执行中',
  'done': '已完成'
}

const radarChartOption = computed(() => {
  if (!currentReport.value) return {}
  const dims = currentReport.value.dimensions
  return {
    title: {
      text: '能力维度雷达图',
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 600 }
    },
    tooltip: {},
    radar: {
      indicator: dims.map(d => ({
        name: d.label,
        max: d.maxScore
      })),
      shape: 'polygon',
      splitNumber: 4,
      axisName: {
        color: '#666',
        fontSize: 12
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(102, 126, 234, 0.05)', 'rgba(102, 126, 234, 0.1)', 'rgba(102, 126, 234, 0.15)', 'rgba(102, 126, 234, 0.2)']
        }
      }
    },
    series: [{
      type: 'radar',
      data: [{
        value: dims.map(d => d.score),
        name: '评估得分',
        areaStyle: {
          color: 'rgba(102, 126, 234, 0.3)'
        },
        lineStyle: {
          color: '#667eea',
          width: 2
        },
        itemStyle: {
          color: '#667eea'
        }
      }]
    }]
  }
})

const barChartOption = computed(() => {
  if (!currentReport.value) return {}
  const dims = currentReport.value.dimensions
  const colors = dims.map(d => levelColorMap[d.level] || '#667eea')
  return {
    title: {
      text: '各维度评分条形图',
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 600 }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const p = params[0]
        const dim = dims[p.dataIndex]
        return `${dim.label}<br/>得分: ${dim.score}/${dim.maxScore}<br/>等级: ${dim.level}<br/>详情: ${dim.detail}`
      }
    },
    grid: { left: 100, right: 30, top: 50, bottom: 30 },
    xAxis: {
      type: 'value',
      max: 100,
      name: '分数'
    },
    yAxis: {
      type: 'category',
      data: dims.map(d => d.label),
      axisLabel: { fontSize: 12 }
    },
    series: [{
      type: 'bar',
      data: dims.map((d, i) => ({
        value: d.score,
        itemStyle: { color: colors[i], borderRadius: [0, 4, 4, 0] }
      })),
      barWidth: '50%',
      label: {
        show: true,
        position: 'right',
        formatter: '{c}分',
        fontSize: 12
      }
    }]
  }
})

const relatedBooksList = computed(() => {
  if (!currentReport.value) return []
  const ids = currentReport.value.relatedBookIds
  return books.value.filter(b => ids.includes(b.id))
})

const loadData = async () => {
  loading.value = true
  try {
    const [bks, latest] = await Promise.all([
      bookApi.getList(),
      assessmentApi.getLatest().catch(() => null)
    ])
    books.value = bks
    currentReport.value = latest
    if (latest) selectedReportId.value = latest.id
  } catch (e) {
    console.error('加载数据失败', e)
  } finally {
    loading.value = false
  }
}

const loadReports = async () => {
  try {
    reports.value = await assessmentApi.getList()
  } catch (e) {
    console.error('加载报告列表失败', e)
  }
}

const openGenerateModal = () => {
  generateForm.value = {
    periodType: 'week',
    periodStart: '',
    periodEnd: ''
  }
  showGenerateModal.value = true
}

const handleGenerate = async () => {
  if (!generateForm.value.periodType) {
    alert('请选择评估周期类型')
    return
  }
  const hasStart = !!generateForm.value.periodStart
  const hasEnd = !!generateForm.value.periodEnd
  if (hasStart !== hasEnd) {
    alert('日期范围不完整，请同时填写起始日期和结束日期，或都留空自动计算')
    return
  }
  if (hasStart && hasEnd && generateForm.value.periodStart > generateForm.value.periodEnd) {
    alert('起始日期不能晚于结束日期')
    return
  }
  generating.value = true
  try {
    const data: { periodType: AssessmentPeriodType; periodStart?: string; periodEnd?: string } = {
      periodType: generateForm.value.periodType
    }
    if (hasStart && hasEnd) {
      data.periodStart = generateForm.value.periodStart
      data.periodEnd = generateForm.value.periodEnd
    }
    const report = await assessmentApi.generate(data)
    currentReport.value = report
    selectedReportId.value = report.id
    showGenerateModal.value = false
    loadReports()
  } catch (e: any) {
    const msg = e?.response?.data?.error || '生成评估报告失败'
    alert(msg)
  } finally {
    generating.value = false
  }
}

const selectReport = async (id: string) => {
  try {
    const report = await assessmentApi.getDetail(id)
    currentReport.value = report
    selectedReportId.value = id
    showHistoryModal.value = false
  } catch (e) {
    console.error('加载报告详情失败', e)
  }
}

const handleLock = async () => {
  if (!currentReport.value) return
  if (!confirm('锁定后报告快照将不可被后续打卡或借阅变化覆盖，确定锁定？')) return
  try {
    const report = await assessmentApi.lock(currentReport.value.id)
    currentReport.value = report
  } catch (e: any) {
    const msg = e?.response?.data?.error || '锁定失败'
    alert(msg)
  }
}

const openAddNote = () => {
  editingNoteIndex.value = -1
  noteText.value = ''
  showNotesModal.value = true
}

const openEditNote = (index: number) => {
  if (!currentReport.value) return
  editingNoteIndex.value = index
  noteText.value = currentReport.value.parentNotes[index] || ''
  showNotesModal.value = true
}

const saveNote = async () => {
  if (!currentReport.value) return
  if (!noteText.value.trim()) {
    alert('备注内容不能为空')
    return
  }
  try {
    let report: AssessmentReport
    if (editingNoteIndex.value >= 0) {
      report = await assessmentApi.updateNote(currentReport.value.id, editingNoteIndex.value, noteText.value.trim())
    } else {
      report = await assessmentApi.addNote(currentReport.value.id, noteText.value.trim())
    }
    currentReport.value = report
    showNotesModal.value = false
  } catch (e) {
    console.error('保存备注失败', e)
  }
}

const deleteNote = async (index: number) => {
  if (!currentReport.value) return
  if (!confirm('确定删除此备注？')) return
  try {
    const report = await assessmentApi.deleteNote(currentReport.value.id, index)
    currentReport.value = report
  } catch (e) {
    console.error('删除备注失败', e)
  }
}

const updateInterventionStatus = async (index: number, status: string) => {
  if (!currentReport.value) return
  try {
    const report = await assessmentApi.updateInterventionStatus(currentReport.value.id, index, status)
    currentReport.value = report
  } catch (e: any) {
    const msg = e?.response?.data?.error || '更新状态失败'
    alert(msg)
  }
}

const nextInterventionStatus = (current: string) => {
  if (current === 'pending') return 'in_progress'
  if (current === 'in_progress') return 'done'
  return 'pending'
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const getBookById = (id: string) => books.value.find(b => b.id === id)

onMounted(() => {
  loadData()
  loadReports()
})
</script>

<template>
  <div class="assessment-page">
    <div class="page-header">
      <h1 class="page-title">🌟 成长评估</h1>
      <div class="header-actions">
        <button class="btn btn-outline" @click="showHistoryModal = true">
          📋 报告历史
        </button>
        <button class="btn btn-primary" @click="openGenerateModal">
          + 生成评估
        </button>
      </div>
    </div>

    <div v-if="!currentReport" class="empty-state">
      <span class="empty-icon">🌟</span>
      <h3>还没有成长评估报告</h3>
      <p>点击「生成评估」按钮，基于宝宝当前阅读数据生成阶段性成长评估</p>
      <button class="btn btn-primary btn-lg" @click="openGenerateModal">
        生成第一份评估报告
      </button>
    </div>

    <template v-else>
      <div class="score-overview">
        <div class="overall-score-card">
          <div class="score-ring" :style="{ '--score-color': currentReport.overallScore >= 85 ? '#52c41a' : currentReport.overallScore >= 65 ? '#1890ff' : currentReport.overallScore >= 40 ? '#faad14' : '#ff4d4f' }">
            <span class="score-number">{{ currentReport.overallScore }}</span>
            <span class="score-unit">分</span>
          </div>
          <div class="score-meta">
            <div class="score-level" :style="{ color: currentReport.overallScore >= 85 ? '#52c41a' : currentReport.overallScore >= 65 ? '#1890ff' : currentReport.overallScore >= 40 ? '#faad14' : '#ff4d4f' }">
              {{ currentReport.overallLevel }}
            </div>
            <div class="score-period">
              {{ currentReport.periodType === 'week' ? '周评估' : '月评估' }}
            </div>
            <div class="score-date">
              {{ currentReport.periodStart }} ~ {{ currentReport.periodEnd }}
            </div>
          </div>
        </div>

        <div class="snapshot-card">
          <h4 class="snapshot-title">📊 快照数据</h4>
          <div class="snapshot-grid">
            <div class="snapshot-item">
              <span class="snapshot-value">{{ currentReport.snapshotData.totalReadingRecords }}</span>
              <span class="snapshot-label">阅读次数</span>
            </div>
            <div class="snapshot-item">
              <span class="snapshot-value">{{ currentReport.snapshotData.totalReadingDuration }}</span>
              <span class="snapshot-label">阅读时长(分)</span>
            </div>
            <div class="snapshot-item">
              <span class="snapshot-value">{{ currentReport.snapshotData.readingDays }}</span>
              <span class="snapshot-label">阅读天数</span>
            </div>
            <div class="snapshot-item">
              <span class="snapshot-value">{{ currentReport.snapshotData.uniqueBooks }}</span>
              <span class="snapshot-label">涉及绘本</span>
            </div>
            <div class="snapshot-item">
              <span class="snapshot-value">{{ currentReport.snapshotData.ageMatchedCount }}/{{ currentReport.snapshotData.ageMatchedCount + currentReport.snapshotData.ageMismatchedCount }}</span>
              <span class="snapshot-label">月龄匹配</span>
            </div>
            <div class="snapshot-item">
              <span class="snapshot-value">{{ currentReport.snapshotData.sharedBooksCount }}</span>
              <span class="snapshot-label">共享绘本</span>
            </div>
          </div>
          <div class="report-status-row">
            <span class="status-badge" :class="currentReport.status">
              {{ currentReport.status === 'draft' ? '草稿' : '已锁定' }}
            </span>
            <span class="report-time">{{ formatDate(currentReport.createdAt) }} 生成</span>
            <button
              v-if="currentReport.status === 'draft'"
              class="btn btn-sm btn-lock"
              @click="handleLock"
            >
              🔒 锁定快照
            </button>
          </div>
        </div>
      </div>

      <div v-if="currentReport.alerts.length > 0" class="alerts-section">
        <h3 class="section-title">⚠️ 异常提醒</h3>
        <div class="alerts-list">
          <div
            v-for="(alert, i) in currentReport.alerts"
            :key="i"
            class="alert-item"
            :class="alert.type"
          >
            <span class="alert-icon">{{ alert.type === 'danger' ? '🔴' : alert.type === 'warning' ? '🟡' : '🔵' }}</span>
            <div class="alert-content">
              <div class="alert-message">{{ alert.message }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="charts-section">
        <div class="chart-card">
          <v-chart :option="radarChartOption" style="height: 350px;" autoresize />
        </div>
        <div class="chart-card">
          <v-chart :option="barChartOption" style="height: 350px;" autoresize />
        </div>
      </div>

      <div class="dimensions-section">
        <h3 class="section-title">📐 维度详情</h3>
        <div class="dimensions-grid">
          <div
            v-for="dim in currentReport.dimensions"
            :key="dim.key"
            class="dimension-card"
            :style="{ borderLeftColor: levelColorMap[dim.level] }"
          >
            <div class="dim-header">
              <span class="dim-label">{{ dim.label }}</span>
              <span class="dim-level" :style="{ color: levelColorMap[dim.level], background: levelBgMap[dim.level] }">
                {{ dim.level }}
              </span>
            </div>
            <div class="dim-score-bar">
              <div class="dim-score-fill" :style="{ width: (dim.score / dim.maxScore * 100) + '%', background: levelColorMap[dim.level] }"></div>
            </div>
            <div class="dim-score-text">{{ dim.score }} / {{ dim.maxScore }}</div>
            <div class="dim-detail">{{ dim.detail }}</div>
          </div>
        </div>
      </div>

      <div v-if="currentReport.interventions.length > 0" class="interventions-section">
        <h3 class="section-title">🎯 干预建议</h3>
        <div class="interventions-list">
          <div
            v-for="(intervention, i) in currentReport.interventions"
            :key="i"
            class="intervention-card"
            :class="{ done: intervention.status === 'done' }"
          >
            <div class="intervention-header">
              <span class="intervention-priority" :style="{ background: priorityColorMap[intervention.priority] }">
                {{ priorityLabelMap[intervention.priority] }}
              </span>
              <span class="intervention-title">{{ intervention.title }}</span>
              <button
                class="intervention-status-btn"
                :class="intervention.status"
                @click="updateInterventionStatus(i, nextInterventionStatus(intervention.status))"
              >
                {{ interventionStatusLabelMap[intervention.status] }}
              </button>
            </div>
            <div class="intervention-desc">{{ intervention.description }}</div>
            <div v-if="intervention.relatedBookIds.length > 0" class="intervention-books">
              <span class="books-label">推荐绘本：</span>
              <span
                v-for="bookId in intervention.relatedBookIds"
                :key="bookId"
                class="book-tag"
              >
                {{ getBookById(bookId)?.title || '未知绘本' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="related-books-section">
        <h3 class="section-title">📚 关联绘本清单</h3>
        <div v-if="relatedBooksList.length > 0" class="related-books-grid">
          <div
            v-for="book in relatedBooksList"
            :key="book.id"
            class="related-book-item"
          >
            <span class="book-emoji">📖</span>
            <div class="book-info">
              <div class="book-title">{{ book.title }}</div>
              <div class="book-meta">{{ book.theme }} · {{ book.minMonth }}-{{ book.maxMonth }}月 · {{ book.interactionType }}</div>
            </div>
          </div>
        </div>
        <div v-else class="no-data">该时段无关联绘本</div>
      </div>

      <div class="notes-section">
        <div class="section-header">
          <h3 class="section-title">📝 家长观察备注</h3>
          <button class="btn btn-sm btn-outline" @click="openAddNote">+ 添加备注</button>
        </div>
        <div v-if="currentReport.parentNotes.length > 0" class="notes-list">
          <div
            v-for="(note, i) in currentReport.parentNotes"
            :key="i"
            class="note-item"
          >
            <div class="note-content">{{ note }}</div>
            <div class="note-actions">
              <button class="note-btn" @click="openEditNote(i)">✏️</button>
              <button class="note-btn" @click="deleteNote(i)">🗑️</button>
            </div>
          </div>
        </div>
        <div v-else class="no-data">暂无备注，点击添加观察记录</div>
      </div>
    </template>

    <div v-if="showGenerateModal" class="modal-overlay" @click.self="showGenerateModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>生成成长评估</h3>
          <button class="close-btn" @click="showGenerateModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>评估周期类型 *</label>
            <select v-model="generateForm.periodType">
              <option value="week">按周评估</option>
              <option value="month">按月评估</option>
            </select>
          </div>
          <div class="form-group">
            <label>起始日期（留空则自动计算本周/本月）</label>
            <input v-model="generateForm.periodStart" type="date" />
          </div>
          <div class="form-group">
            <label>结束日期（留空则自动计算本周/本月）</label>
            <input v-model="generateForm.periodEnd" type="date" />
          </div>
          <div v-if="(generateForm.periodStart && !generateForm.periodEnd) || (!generateForm.periodStart && generateForm.periodEnd)" class="form-error">
            日期范围不完整，请同时填写起始日期和结束日期，或都留空自动计算
          </div>
          <div v-if="generateForm.periodStart && generateForm.periodEnd && generateForm.periodStart > generateForm.periodEnd" class="form-error">
            起始日期不能晚于结束日期
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showGenerateModal = false">取消</button>
          <button class="btn btn-primary" :disabled="generating" @click="handleGenerate">
            {{ generating ? '生成中...' : '生成评估' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showNotesModal" class="modal-overlay" @click.self="showNotesModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ editingNoteIndex >= 0 ? '编辑备注' : '添加备注' }}</h3>
          <button class="close-btn" @click="showNotesModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>观察备注 *</label>
            <textarea v-model="noteText" rows="4" placeholder="记录您对宝宝阅读表现的观察，例如：对翻翻书特别感兴趣、开始模仿故事中的动作等"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showNotesModal = false">取消</button>
          <button class="btn btn-primary" @click="saveNote">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showHistoryModal" class="modal-overlay" @click.self="showHistoryModal = false">
      <div class="modal modal-lg">
        <div class="modal-header">
          <h3>📋 评估报告历史</h3>
          <button class="close-btn" @click="showHistoryModal = false">×</button>
        </div>
        <div class="modal-body">
          <div v-if="reports.length === 0" class="no-data">暂无历史报告</div>
          <div v-else class="history-list">
            <div
              v-for="report in reports"
              :key="report.id"
              class="history-item"
              :class="{ active: report.id === selectedReportId }"
              @click="selectReport(report.id)"
            >
              <div class="history-left">
                <span class="history-score" :style="{ color: report.overallScore >= 85 ? '#52c41a' : report.overallScore >= 65 ? '#1890ff' : report.overallScore >= 40 ? '#faad14' : '#ff4d4f' }">
                  {{ report.overallScore }}分
                </span>
                <span class="history-level">{{ report.overallLevel }}</span>
              </div>
              <div class="history-center">
                <div class="history-period">
                  {{ report.periodType === 'week' ? '周评估' : '月评估' }}
                </div>
                <div class="history-date">{{ report.periodStart }} ~ {{ report.periodEnd }}</div>
              </div>
              <div class="history-right">
                <span class="status-badge small" :class="report.status">
                  {{ report.status === 'draft' ? '草稿' : '已锁定' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.assessment-page {
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

.header-actions {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-sm {
  padding: 6px 14px;
  font-size: 13px;
}

.btn-lg {
  padding: 12px 28px;
  font-size: 16px;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-outline {
  background: white;
  border: 1px solid #ddd;
  color: #666;
}

.btn-outline:hover {
  border-color: #667eea;
  color: #667eea;
}

.btn-lock {
  background: #f0f0f0;
  color: #666;
  font-size: 12px;
}

.btn-lock:hover {
  background: #e0e0e0;
}

.empty-state {
  text-align: center;
  padding: 80px 40px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.empty-icon {
  font-size: 64px;
  display: block;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 18px;
  color: #333;
  margin-bottom: 8px;
}

.empty-state p {
  font-size: 14px;
  color: #999;
  margin-bottom: 24px;
}

.score-overview {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

.overall-score-card {
  background: white;
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.score-ring {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 8px solid var(--score-color, #667eea);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.score-number {
  font-size: 36px;
  font-weight: 800;
  color: var(--score-color, #667eea);
  line-height: 1;
}

.score-unit {
  font-size: 14px;
  color: #999;
  margin-top: 2px;
}

.score-meta {
  text-align: center;
}

.score-level {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 4px;
}

.score-period {
  font-size: 14px;
  color: #666;
  margin-bottom: 2px;
}

.score-date {
  font-size: 12px;
  color: #999;
}

.snapshot-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.snapshot-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 16px;
}

.snapshot-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.snapshot-item {
  text-align: center;
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
}

.snapshot-value {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: #333;
  margin-bottom: 4px;
}

.snapshot-label {
  font-size: 12px;
  color: #999;
}

.report-status-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.status-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.draft {
  background: #e6f7ff;
  color: #1890ff;
}

.status-badge.locked {
  background: #f6ffed;
  color: #52c41a;
}

.status-badge.small {
  font-size: 11px;
  padding: 2px 8px;
}

.report-time {
  font-size: 12px;
  color: #999;
}

.alerts-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-header .section-title {
  margin-bottom: 0;
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alert-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 18px;
  border-radius: 10px;
}

.alert-item.danger {
  background: #fff2f0;
  border: 1px solid #ffccc7;
}

.alert-item.warning {
  background: #fffbe6;
  border: 1px solid #ffe58f;
}

.alert-item.info {
  background: #e6f7ff;
  border: 1px solid #91d5ff;
}

.alert-icon {
  font-size: 18px;
  flex-shrink: 0;
  margin-top: 1px;
}

.alert-message {
  font-size: 14px;
  color: #333;
  line-height: 1.5;
}

.charts-section {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.chart-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.dimensions-section {
  margin-bottom: 24px;
}

.dimensions-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.dimension-card {
  background: white;
  border-radius: 12px;
  padding: 18px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border-left: 4px solid #ddd;
}

.dim-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.dim-label {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.dim-level {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.dim-score-bar {
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  margin-bottom: 6px;
  overflow: hidden;
}

.dim-score-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s;
}

.dim-score-text {
  font-size: 13px;
  color: #999;
  margin-bottom: 8px;
}

.dim-detail {
  font-size: 13px;
  color: #666;
  line-height: 1.5;
}

.interventions-section {
  margin-bottom: 24px;
}

.interventions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.intervention-card {
  background: white;
  border-radius: 12px;
  padding: 18px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: opacity 0.3s;
}

.intervention-card.done {
  opacity: 0.6;
}

.intervention-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.intervention-priority {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  color: white;
  font-weight: 500;
}

.intervention-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  flex: 1;
}

.intervention-status-btn {
  padding: 4px 12px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.intervention-status-btn.pending {
  background: #fff2f0;
  color: #ff4d4f;
  border: 1px solid #ffccc7;
}

.intervention-status-btn.in_progress {
  background: #fffbe6;
  color: #fa8c16;
  border: 1px solid #ffe58f;
}

.intervention-status-btn.done {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.intervention-status-btn:hover {
  opacity: 0.8;
}

.intervention-desc {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 10px;
}

.intervention-books {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.books-label {
  font-size: 12px;
  color: #999;
}

.book-tag {
  display: inline-block;
  padding: 3px 10px;
  background: #f0f0ff;
  color: #667eea;
  border-radius: 10px;
  font-size: 12px;
}

.related-books-section {
  margin-bottom: 24px;
}

.related-books-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.related-book-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.book-emoji {
  font-size: 24px;
  flex-shrink: 0;
}

.book-info {
  flex: 1;
  min-width: 0;
}

.book-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-meta {
  font-size: 12px;
  color: #999;
}

.notes-section {
  margin-bottom: 24px;
}

.notes-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.note-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.note-content {
  flex: 1;
  font-size: 14px;
  color: #333;
  line-height: 1.6;
}

.note-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.note-btn {
  font-size: 14px;
  opacity: 0.6;
  padding: 4px;
  transition: opacity 0.2s;
}

.note-btn:hover {
  opacity: 1;
}

.no-data {
  text-align: center;
  padding: 30px;
  color: #999;
  font-size: 14px;
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

.modal-lg {
  width: 640px;
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

.form-error {
  color: #ff4d4f;
  font-size: 12px;
  margin-top: 4px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid #f0f0f0;
}

.btn-default {
  background: #f5f5f5;
  color: #666;
}

.btn-default:hover {
  background: #eee;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  background: #fafafa;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.history-item:hover {
  background: #f0f0ff;
}

.history-item.active {
  border-color: #667eea;
  background: #f0f0ff;
}

.history-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 60px;
}

.history-score {
  font-size: 20px;
  font-weight: 700;
}

.history-level {
  font-size: 12px;
  color: #999;
}

.history-center {
  flex: 1;
}

.history-period {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
}

.history-date {
  font-size: 12px;
  color: #999;
}

.history-right {
  flex-shrink: 0;
}

@media (max-width: 900px) {
  .score-overview {
    grid-template-columns: 1fr;
  }

  .charts-section {
    grid-template-columns: 1fr;
  }

  .dimensions-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .related-books-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .dimensions-grid {
    grid-template-columns: 1fr;
  }

  .snapshot-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
