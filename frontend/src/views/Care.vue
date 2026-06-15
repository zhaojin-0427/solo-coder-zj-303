<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { careApi, bookApi } from '@/api'
import type {
  BookCareProfile,
  CareStats,
  CareMeta,
  CareReminder,
  DamageRiskLevel,
  BookCondition,
  DamageType,
  RepairStatus,
  Book
} from '@/types'
import { getLocalDateString } from '@/utils/date'

import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart, PieChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([
  BarChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  CanvasRenderer
])

const loading = ref(false)
const profiles = ref<BookCareProfile[]>([])
const stats = ref<CareStats | null>(null)
const meta = ref<CareMeta | null>(null)
const reminders = ref<CareReminder[]>([])
const books = ref<Book[]>([])

const activeTab = ref<'profiles' | 'reminders' | 'charts'>('profiles')
const filterRisk = ref<DamageRiskLevel | ''>('')
const filterCondition = ref<BookCondition | ''>('')
const filterUnresolved = ref(false)

const showDamageModal = ref(false)
const showRepairModal = ref(false)
const showProfileModal = ref(false)
const showPauseModal = ref(false)
const showDetailModal = ref(false)
const currentProfile = ref<BookCareProfile | null>(null)

const damageForm = ref({
  damageType: '' as DamageType | '',
  severity: '轻微' as '轻微' | '中度' | '严重',
  description: '',
  location: '',
  discoveredDate: getLocalDateString(),
  discoveredBy: ''
})

const repairForm = ref({
  damageRecordId: '',
  repairType: '',
  description: '',
  repairDate: getLocalDateString(),
  repairedBy: '',
  cost: undefined as number | undefined
})

const profileForm = ref({
  currentCondition: '良好' as BookCondition,
  conditionDescription: '',
  lastCleanDate: '',
  lastInspectionDate: ''
})

const pauseForm = ref({
  pauseReason: '',
  expectedResumeDate: ''
})

const damageErrors = ref<Record<string, string>>({})
const repairErrors = ref<Record<string, string>>({})
const profileErrors = ref<Record<string, string>>({})
const pauseErrors = ref<Record<string, string>>({})

const riskColors: Record<DamageRiskLevel, string> = {
  '低': '#52c41a',
  '中': '#faad14',
  '高': '#fa541c',
  '极高': '#f5222d'
}

const conditionColors: Record<BookCondition, string> = {
  '全新': '#52c41a',
  '良好': '#1890ff',
  '一般': '#faad14',
  '较差': '#fa541c',
  '破损': '#f5222d'
}

const priorityColors: Record<string, string> = {
  low: '#52c41a',
  medium: '#faad14',
  high: '#f5222d'
}

const priorityLabels: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高'
}

const repairStatusColors: Record<RepairStatus, string> = {
  '待处理': '#faad14',
  '处理中': '#1890ff',
  '已完成': '#52c41a',
  '无法修复': '#f5222d'
}

const filteredProfiles = computed(() => {
  return profiles.value.filter(p => {
    if (filterRisk.value && p.damageRiskLevel !== filterRisk.value) return false
    if (filterCondition.value && p.currentCondition !== filterCondition.value) return false
    if (filterUnresolved.value && p.damageRecords.filter(d => !d.resolved).length === 0) return false
    return true
  })
})

const pendingReminders = computed(() => reminders.value.filter(r => !r.isCompleted))

const loadData = async () => {
  loading.value = true
  try {
    const [p, s, m, r, b] = await Promise.all([
      careApi.getProfiles(),
      careApi.getStats(),
      careApi.getMeta(),
      careApi.getReminders({ isCompleted: false }),
      bookApi.getList()
    ])
    profiles.value = p
    stats.value = s
    meta.value = m
    reminders.value = r
    books.value = b
  } catch (e) {
    console.error('加载养护数据失败', e)
  } finally {
    loading.value = false
  }
}

const getBook = (bookId: string) => books.value.find(b => b.id === bookId)

const isDateValid = (dateStr: string) => {
  if (!dateStr) return true
  const d = new Date(dateStr)
  return !isNaN(d.getTime())
}

const isDateRangeValid = (start: string, end: string) => {
  if (!start || !end) return true
  return new Date(start) <= new Date(end)
}

const openDamageModal = (profile: BookCareProfile) => {
  currentProfile.value = profile
  damageForm.value = {
    damageType: meta.value?.damageTypes[0] || '',
    severity: '轻微',
    description: '',
    location: '',
    discoveredDate: getLocalDateString(),
    discoveredBy: ''
  }
  damageErrors.value = {}
  showDamageModal.value = true
}

const validateDamageForm = () => {
  const errors: Record<string, string> = {}
  if (!damageForm.value.damageType) errors.damageType = '请选择损耗类型'
  if (!damageForm.value.severity) errors.severity = '请选择严重程度'
  if (!damageForm.value.description || !damageForm.value.description.trim()) errors.description = '请输入损耗描述'
  if (!damageForm.value.discoveredDate) errors.discoveredDate = '请选择发现日期'
  else if (!isDateValid(damageForm.value.discoveredDate)) errors.discoveredDate = '日期格式无效'
  else if (new Date(damageForm.value.discoveredDate) > new Date()) errors.discoveredDate = '发现日期不能晚于今天'
  damageErrors.value = errors
  return Object.keys(errors).length === 0
}

const submitDamage = async () => {
  if (!validateDamageForm() || !currentProfile.value) return
  try {
    await careApi.addDamage(currentProfile.value.bookId, {
      damageType: damageForm.value.damageType,
      severity: damageForm.value.severity,
      description: damageForm.value.description,
      location: damageForm.value.location,
      discoveredDate: damageForm.value.discoveredDate,
      discoveredBy: damageForm.value.discoveredBy
    })
    showDamageModal.value = false
    await loadData()
  } catch (e: any) {
    alert(e.response?.data?.error || '提交损耗记录失败')
  }
}

const resolveDamage = async (damageId: string) => {
  const note = prompt('请输入处理说明：')
  if (!note || !note.trim()) {
    alert('处理说明不能为空')
    return
  }
  try {
    await careApi.resolveDamage(damageId, { resolutionNote: note })
    await loadData()
  } catch (e: any) {
    alert(e.response?.data?.error || '标记解决失败')
  }
}

const openRepairModal = (profile: BookCareProfile) => {
  currentProfile.value = profile
  repairForm.value = {
    damageRecordId: '',
    repairType: '',
    description: '',
    repairDate: getLocalDateString(),
    repairedBy: '',
    cost: undefined
  }
  repairErrors.value = {}
  showRepairModal.value = true
}

const validateRepairForm = () => {
  const errors: Record<string, string> = {}
  if (!repairForm.value.repairType || !repairForm.value.repairType.trim()) errors.repairType = '请输入维修类型'
  if (!repairForm.value.description || !repairForm.value.description.trim()) errors.description = '请输入维修描述'
  if (!repairForm.value.repairDate) errors.repairDate = '请选择维修日期'
  else if (!isDateValid(repairForm.value.repairDate)) errors.repairDate = '日期格式无效'
  else if (new Date(repairForm.value.repairDate) > new Date()) errors.repairDate = '维修日期不能晚于今天'
  if (repairForm.value.cost !== undefined && repairForm.value.cost < 0) errors.cost = '费用不能为负数'
  repairErrors.value = errors
  return Object.keys(errors).length === 0
}

const submitRepair = async () => {
  if (!validateRepairForm() || !currentProfile.value) return
  try {
    await careApi.addRepair(currentProfile.value.bookId, {
      damageRecordId: repairForm.value.damageRecordId || undefined,
      repairType: repairForm.value.repairType,
      description: repairForm.value.description,
      repairDate: repairForm.value.repairDate,
      repairedBy: repairForm.value.repairedBy,
      cost: repairForm.value.cost
    })
    showRepairModal.value = false
    await loadData()
  } catch (e: any) {
    alert(e.response?.data?.error || '提交维修记录失败')
  }
}

const updateRepairStatus = async (repairId: string) => {
  const statuses: RepairStatus[] = meta.value?.repairStatuses || ['待处理', '处理中', '已完成', '无法修复']
  const status = prompt(`请输入新状态（${statuses.join('/')}）：`, '已完成')
  if (!status || !statuses.includes(status as RepairStatus)) {
    alert(`状态必须是：${statuses.join('、')}`)
    return
  }
  const notes = prompt('请输入备注（可选）：') || ''
  try {
    await careApi.updateRepairStatus(repairId, { status, notes })
    await loadData()
  } catch (e: any) {
    alert(e.response?.data?.error || '更新维修状态失败')
  }
}

const openProfileModal = (profile: BookCareProfile) => {
  currentProfile.value = profile
  profileForm.value = {
    currentCondition: profile.currentCondition,
    conditionDescription: profile.conditionDescription || '',
    lastCleanDate: profile.lastCleanDate || '',
    lastInspectionDate: profile.lastInspectionDate || ''
  }
  profileErrors.value = {}
  showProfileModal.value = true
}

const validateProfileForm = () => {
  const errors: Record<string, string> = {}
  if (!profileForm.value.currentCondition) errors.currentCondition = '请选择品相'
  else if (!(meta.value?.bookConditions || []).includes(profileForm.value.currentCondition)) {
    errors.currentCondition = '品相值不合法'
  }
  if (profileForm.value.lastCleanDate && !isDateValid(profileForm.value.lastCleanDate)) {
    errors.lastCleanDate = '清洁日期格式无效'
  }
  if (profileForm.value.lastCleanDate && new Date(profileForm.value.lastCleanDate) > new Date()) {
    errors.lastCleanDate = '清洁日期不能晚于今天'
  }
  if (profileForm.value.lastInspectionDate && !isDateValid(profileForm.value.lastInspectionDate)) {
    errors.lastInspectionDate = '检查日期格式无效'
  }
  if (profileForm.value.lastInspectionDate && new Date(profileForm.value.lastInspectionDate) > new Date()) {
    errors.lastInspectionDate = '检查日期不能晚于今天'
  }
  profileErrors.value = errors
  return Object.keys(errors).length === 0
}

const saveProfile = async () => {
  if (!validateProfileForm() || !currentProfile.value) return
  try {
    await careApi.updateProfile(currentProfile.value.bookId, profileForm.value)
    showProfileModal.value = false
    await loadData()
  } catch (e: any) {
    alert(e.response?.data?.error || '保存养护档案失败')
  }
}

const openPauseModal = (profile: BookCareProfile) => {
  currentProfile.value = profile
  pauseForm.value = {
    pauseReason: '',
    expectedResumeDate: ''
  }
  pauseErrors.value = {}
  showPauseModal.value = true
}

const validatePauseForm = () => {
  const errors: Record<string, string> = {}
  if (!pauseForm.value.pauseReason || !pauseForm.value.pauseReason.trim()) {
    errors.pauseReason = '请输入暂停原因'
  }
  if (pauseForm.value.expectedResumeDate && !isDateValid(pauseForm.value.expectedResumeDate)) {
    errors.expectedResumeDate = '恢复日期格式无效'
  }
  if (pauseForm.value.expectedResumeDate && new Date(pauseForm.value.expectedResumeDate) < new Date()) {
    errors.expectedResumeDate = '预计恢复日期不能早于今天'
  }
  pauseErrors.value = errors
  return Object.keys(errors).length === 0
}

const pauseCirculation = async () => {
  if (!validatePauseForm() || !currentProfile.value) return
  try {
    await careApi.pauseCirculation(currentProfile.value.bookId, pauseForm.value)
    showPauseModal.value = false
    await loadData()
  } catch (e: any) {
    alert(e.response?.data?.error || '暂停流转失败')
  }
}

const resumeCirculation = async (profile: BookCareProfile) => {
  if (!confirm('确定要恢复该绘本的流转吗？')) return
  try {
    await careApi.resumeCirculation(profile.bookId)
    await loadData()
  } catch (e: any) {
    alert(e.response?.data?.error || '恢复流转失败')
  }
}

const openDetailModal = (profile: BookCareProfile) => {
  currentProfile.value = profile
  showDetailModal.value = true
}

const completeReminder = async (reminderId: string) => {
  if (!confirm('确定标记该提醒为已完成吗？')) return
  try {
    await careApi.completeReminder(reminderId)
    await loadData()
  } catch (e: any) {
    alert(e.response?.data?.error || '标记完成失败')
  }
}

const conditionChartOption = computed(() => {
  if (!stats.value) return {}
  const data = stats.value.conditionDistribution
  const colors = ['#52c41a', '#1890ff', '#faad14', '#fa541c', '#f5222d']
  return {
    title: { text: '品相分布', left: 'center', textStyle: { fontSize: 14, fontWeight: 600 } },
    tooltip: { trigger: 'item', formatter: '{b}: {c}本 ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { fontSize: 12 } },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['40%', '55%'],
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
      data: data.map((d, i) => ({ value: d.count, name: d.condition, itemStyle: { color: colors[i % colors.length] } }))
    }]
  }
})

const riskChartOption = computed(() => {
  if (!stats.value) return {}
  const data = stats.value.riskDistribution
  return {
    title: { text: '风险等级分布', left: 'center', textStyle: { fontSize: 14, fontWeight: 600 } },
    tooltip: { trigger: 'axis', formatter: '{b}: {c}本' },
    xAxis: { type: 'category', data: data.map(d => d.risk), axisLabel: { fontSize: 12 } },
    yAxis: { type: 'value', name: '本数', nameTextStyle: { fontSize: 12 } },
    series: [{
      type: 'bar',
      data: data.map(d => ({
        value: d.count,
        itemStyle: { color: riskColors[d.risk as DamageRiskLevel] }
      })),
      barWidth: '50%'
    }],
    grid: { left: 50, right: 20, top: 50, bottom: 30 }
  }
})

const damageTypeChartOption = computed(() => {
  if (!stats.value) return {}
  const data = stats.value.damageTypeDistribution
  const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#43e97b', '#fa709a', '#fee140', '#30cfd0']
  return {
    title: { text: '损耗类型分布', left: 'center', textStyle: { fontSize: 14, fontWeight: 600 } },
    tooltip: { trigger: 'item', formatter: '{b}: {c}次 ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['40%', '55%'],
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: data.map((d, i) => ({ value: d.count, name: d.type, itemStyle: { color: colors[i % colors.length] } }))
    }]
  }
})

const isOverdue = (dateStr: string) => new Date(dateStr) < new Date()

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="care-page">
    <div class="page-header">
      <h2>🧼 绘本养护</h2>
      <p class="subtitle">记录绘本品相、损耗与维修，自动追踪清洁和损耗提醒</p>
    </div>

    <div v-if="stats" class="stats-cards">
      <div class="stat-card">
        <div class="stat-icon">📚</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.totalProfiles }}</div>
          <div class="stat-label">总养护档案</div>
        </div>
      </div>
      <div class="stat-card stat-danger">
        <div class="stat-icon">⚠️</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.highRiskCount }}</div>
          <div class="stat-label">高/极高风险</div>
        </div>
      </div>
      <div class="stat-card stat-warning">
        <div class="stat-icon">🚫</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.pausedCount }}</div>
          <div class="stat-label">暂停流转</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🔧</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.pendingDamagesCount }}</div>
          <div class="stat-label">待处理损耗</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🛠️</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.pendingRepairsCount }}</div>
          <div class="stat-label">待维修</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🧹</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.pendingCleaningCount }}</div>
          <div class="stat-label">待清洁</div>
        </div>
      </div>
      <div class="stat-card stat-danger">
        <div class="stat-icon">⏰</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.overdueRemindersCount }}</div>
          <div class="stat-label">逾期提醒</div>
        </div>
      </div>
    </div>

    <div class="tabs">
      <div class="tab" :class="{ active: activeTab === 'profiles' }" @click="activeTab = 'profiles'">
        📋 养护档案
      </div>
      <div class="tab" :class="{ active: activeTab === 'reminders' }" @click="activeTab = 'reminders'">
        🔔 待处理提醒 <span v-if="pendingReminders.length > 0" class="tab-badge">{{ pendingReminders.length }}</span>
      </div>
      <div class="tab" :class="{ active: activeTab === 'charts' }" @click="activeTab = 'charts'">
        📊 统计分析
      </div>
    </div>

    <div v-if="activeTab === 'profiles'" class="tab-content">
      <div class="filter-bar">
        <div class="filter-item">
          <label>风险等级：</label>
          <select v-model="filterRisk">
            <option value="">全部</option>
            <option v-for="r in meta?.damageRiskLevels || []" :key="r" :value="r">{{ r }}</option>
          </select>
        </div>
        <div class="filter-item">
          <label>品相：</label>
          <select v-model="filterCondition">
            <option value="">全部</option>
            <option v-for="c in meta?.bookConditions || []" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="filter-item">
          <label class="checkbox-label">
            <input type="checkbox" v-model="filterUnresolved" />
            仅看有未解决损耗
          </label>
        </div>
      </div>

      <div v-if="loading" class="loading">加载中...</div>

      <div v-else class="profile-list">
        <div v-for="profile in filteredProfiles" :key="profile.id" class="profile-card">
          <div class="profile-header">
            <div class="profile-title">
              <span class="book-title">{{ profile.bookTitle }}</span>
              <span v-if="profile.isCirculationPaused" class="badge badge-paused">🚫 暂停流转</span>
              <span class="badge" :style="{ background: riskColors[profile.damageRiskLevel] }">
                风险：{{ profile.damageRiskLevel }}
              </span>
              <span class="badge" :style="{ background: conditionColors[profile.currentCondition] }">
                品相：{{ profile.currentCondition }}
              </span>
            </div>
            <div class="profile-actions">
              <button class="btn btn-sm" @click="openDetailModal(profile)">查看详情</button>
              <button class="btn btn-sm btn-primary" @click="openProfileModal(profile)">编辑档案</button>
              <button class="btn btn-sm btn-warning" @click="openDamageModal(profile)">记录损耗</button>
              <button class="btn btn-sm btn-success" @click="openRepairModal(profile)">维修处理</button>
              <button v-if="!profile.isCirculationPaused" class="btn btn-sm btn-danger" @click="openPauseModal(profile)">
                暂停流转
              </button>
              <button v-else class="btn btn-sm btn-success" @click="resumeCirculation(profile)">
                恢复流转
              </button>
            </div>
          </div>

          <div class="profile-body">
            <div class="info-row">
              <span class="info-label">借阅/阅读次数：</span>
              <span class="info-value">{{ profile.totalBorrowCount }} / {{ profile.totalReadCount }}</span>
              <span class="info-label">最近清洁：</span>
              <span class="info-value">{{ profile.lastCleanDate || '未记录' }}</span>
              <span class="info-label">最近检查：</span>
              <span class="info-value">{{ profile.lastInspectionDate || '未记录' }}</span>
            </div>
            <div v-if="profile.pauseReason" class="info-row info-warning">
              <span class="info-label">暂停原因：</span>
              <span class="info-value">{{ profile.pauseReason }}</span>
              <span v-if="profile.expectedResumeDate" class="info-label">预计恢复：</span>
              <span class="info-value">{{ profile.expectedResumeDate }}</span>
            </div>
            <div v-if="profile.damageRiskReasons.length > 0" class="risk-reasons">
              <span class="info-label">风险因素：</span>
              <span v-for="(reason, idx) in profile.damageRiskReasons" :key="idx" class="risk-tag">{{ reason }}</span>
            </div>

            <div v-if="profile.damageRecords.filter(d => !d.resolved).length > 0" class="section">
              <div class="section-title">⚠️ 未解决损耗</div>
              <div class="damage-list">
                <div v-for="d in profile.damageRecords.filter(x => !x.resolved)" :key="d.id" class="damage-item">
                  <div class="damage-header">
                    <span class="damage-type">[{{ d.damageType }}]</span>
                    <span class="damage-severity" :class="'severity-' + d.severity">{{ d.severity }}</span>
                    <span class="damage-date">{{ d.discoveredDate }}</span>
                  </div>
                  <div class="damage-desc">{{ d.description }}</div>
                  <button class="btn btn-xs btn-success" @click="resolveDamage(d.id)">标记已解决</button>
                </div>
              </div>
            </div>

            <div v-if="profile.repairRecords.length > 0" class="section">
              <div class="section-title">🛠️ 维修记录</div>
              <div class="timeline">
                <div v-for="r in [...profile.repairRecords].sort((a, b) => b.createdAt.localeCompare(a.createdAt))" :key="r.id" class="timeline-item">
                  <div class="timeline-dot"></div>
                  <div class="timeline-content">
                    <div class="timeline-header">
                      <span class="timeline-date">{{ r.repairDate }}</span>
                      <span class="badge" :style="{ background: repairStatusColors[r.status] }">{{ r.status }}</span>
                      <span class="timeline-type">{{ r.repairType }}</span>
                    </div>
                    <div class="timeline-desc">{{ r.description }}</div>
                    <div v-if="r.cost !== undefined" class="timeline-meta">费用：¥{{ r.cost }}{{ r.repairedBy ? ' · 处理人：' + r.repairedBy : '' }}</div>
                    <button v-if="r.status !== '已完成' && r.status !== '无法修复'" class="btn btn-xs btn-primary" @click="updateRepairStatus(r.id)">
                      更新状态
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="filteredProfiles.length === 0" class="empty">暂无符合条件的养护档案</div>
      </div>
    </div>

    <div v-if="activeTab === 'reminders'" class="tab-content">
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else class="reminder-list">
        <div v-for="r in pendingReminders" :key="r.id" class="reminder-card" :class="{ overdue: isOverdue(r.scheduledDate) }">
          <div class="reminder-icon">
            <span v-if="r.type === '清洁消毒'">🧹</span>
            <span v-else-if="r.type === '损耗复查'">🔍</span>
            <span v-else>🛠️</span>
          </div>
          <div class="reminder-body">
            <div class="reminder-header">
              <span class="reminder-title">{{ r.title }}</span>
              <span class="badge" :style="{ background: priorityColors[r.priority] }">{{ priorityLabels[r.priority] }}优先级</span>
              <span v-if="isOverdue(r.scheduledDate)" class="badge badge-danger">已逾期</span>
            </div>
            <div class="reminder-meta">
              <span>📚 {{ r.bookTitle }}</span>
              <span>📅 计划日期：{{ r.scheduledDate }}</span>
            </div>
            <div v-if="r.description" class="reminder-desc">{{ r.description }}</div>
          </div>
          <div class="reminder-actions">
            <button class="btn btn-sm btn-success" @click="completeReminder(r.id)">标记完成</button>
          </div>
        </div>
        <div v-if="pendingReminders.length === 0" class="empty">暂无待处理提醒 🎉</div>
      </div>
    </div>

    <div v-if="activeTab === 'charts'" class="tab-content">
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else class="charts-grid">
        <div class="chart-card">
          <v-chart :option="conditionChartOption" autoresize style="height: 300px" />
        </div>
        <div class="chart-card">
          <v-chart :option="riskChartOption" autoresize style="height: 300px" />
        </div>
        <div class="chart-card">
          <v-chart :option="damageTypeChartOption" autoresize style="height: 300px" />
        </div>
      </div>
    </div>

    <div v-if="showDamageModal" class="modal-overlay" @click.self="showDamageModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>记录损耗 - {{ currentProfile?.bookTitle }}</h3>
          <button class="close-btn" @click="showDamageModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>损耗类型 <span class="required">*</span></label>
            <select v-model="damageForm.damageType">
              <option value="">请选择</option>
              <option v-for="t in meta?.damageTypes || []" :key="t" :value="t">{{ t }}</option>
            </select>
            <span v-if="damageErrors.damageType" class="error-text">{{ damageErrors.damageType }}</span>
          </div>
          <div class="form-group">
            <label>严重程度 <span class="required">*</span></label>
            <select v-model="damageForm.severity">
              <option value="轻微">轻微</option>
              <option value="中度">中度</option>
              <option value="严重">严重</option>
            </select>
            <span v-if="damageErrors.severity" class="error-text">{{ damageErrors.severity }}</span>
          </div>
          <div class="form-group">
            <label>损耗描述 <span class="required">*</span></label>
            <textarea v-model="damageForm.description" rows="3" placeholder="请详细描述损耗情况"></textarea>
            <span v-if="damageErrors.description" class="error-text">{{ damageErrors.description }}</span>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>发现日期 <span class="required">*</span></label>
              <input type="date" v-model="damageForm.discoveredDate" />
              <span v-if="damageErrors.discoveredDate" class="error-text">{{ damageErrors.discoveredDate }}</span>
            </div>
            <div class="form-group">
              <label>发现人</label>
              <input type="text" v-model="damageForm.discoveredBy" placeholder="可选" />
            </div>
          </div>
          <div class="form-group">
            <label>损耗位置</label>
            <input type="text" v-model="damageForm.location" placeholder="如：第3页、封面等" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showDamageModal = false">取消</button>
          <button class="btn btn-primary" @click="submitDamage">提交</button>
        </div>
      </div>
    </div>

    <div v-if="showRepairModal" class="modal-overlay" @click.self="showRepairModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>维修处理 - {{ currentProfile?.bookTitle }}</h3>
          <button class="close-btn" @click="showRepairModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>关联损耗记录</label>
            <select v-model="repairForm.damageRecordId">
              <option value="">不关联</option>
              <option v-for="d in currentProfile?.damageRecords.filter(x => !x.resolved) || []" :key="d.id" :value="d.id">
                [{{ d.damageType }}] {{ d.description.slice(0, 20) }}...
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>维修类型 <span class="required">*</span></label>
            <input type="text" v-model="repairForm.repairType" placeholder="如：页面修补、装订修复、清洁消毒等" />
            <span v-if="repairErrors.repairType" class="error-text">{{ repairErrors.repairType }}</span>
          </div>
          <div class="form-group">
            <label>维修描述 <span class="required">*</span></label>
            <textarea v-model="repairForm.description" rows="3" placeholder="请详细描述维修处理方式和结果"></textarea>
            <span v-if="repairErrors.description" class="error-text">{{ repairErrors.description }}</span>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>维修日期 <span class="required">*</span></label>
              <input type="date" v-model="repairForm.repairDate" />
              <span v-if="repairErrors.repairDate" class="error-text">{{ repairErrors.repairDate }}</span>
            </div>
            <div class="form-group">
              <label>处理人</label>
              <input type="text" v-model="repairForm.repairedBy" placeholder="可选" />
            </div>
          </div>
          <div class="form-group">
            <label>费用（元）</label>
            <input type="number" v-model.number="repairForm.cost" min="0" step="0.01" placeholder="可选" />
            <span v-if="repairErrors.cost" class="error-text">{{ repairErrors.cost }}</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showRepairModal = false">取消</button>
          <button class="btn btn-primary" @click="submitRepair">提交</button>
        </div>
      </div>
    </div>

    <div v-if="showProfileModal" class="modal-overlay" @click.self="showProfileModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>编辑养护档案 - {{ currentProfile?.bookTitle }}</h3>
          <button class="close-btn" @click="showProfileModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>当前品相 <span class="required">*</span></label>
            <select v-model="profileForm.currentCondition">
              <option v-for="c in meta?.bookConditions || []" :key="c" :value="c">{{ c }}</option>
            </select>
            <span v-if="profileErrors.currentCondition" class="error-text">{{ profileErrors.currentCondition }}</span>
          </div>
          <div class="form-group">
            <label>品相描述</label>
            <textarea v-model="profileForm.conditionDescription" rows="2" placeholder="可选，描述当前品相详情"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>最近清洁消毒日期</label>
              <input type="date" v-model="profileForm.lastCleanDate" />
              <span v-if="profileErrors.lastCleanDate" class="error-text">{{ profileErrors.lastCleanDate }}</span>
            </div>
            <div class="form-group">
              <label>最近检查日期</label>
              <input type="date" v-model="profileForm.lastInspectionDate" />
              <span v-if="profileErrors.lastInspectionDate" class="error-text">{{ profileErrors.lastInspectionDate }}</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showProfileModal = false">取消</button>
          <button class="btn btn-primary" @click="saveProfile">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showPauseModal" class="modal-overlay" @click.self="showPauseModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>暂停流转 - {{ currentProfile?.bookTitle }}</h3>
          <button class="close-btn" @click="showPauseModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>暂停原因 <span class="required">*</span></label>
            <textarea v-model="pauseForm.pauseReason" rows="3" placeholder="请说明暂停借阅/共享的原因"></textarea>
            <span v-if="pauseErrors.pauseReason" class="error-text">{{ pauseErrors.pauseReason }}</span>
          </div>
          <div class="form-group">
            <label>预计恢复日期</label>
            <input type="date" v-model="pauseForm.expectedResumeDate" />
            <span v-if="pauseErrors.expectedResumeDate" class="error-text">{{ pauseErrors.expectedResumeDate }}</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showPauseModal = false">取消</button>
          <button class="btn btn-danger" @click="pauseCirculation">确认暂停</button>
        </div>
      </div>
    </div>

    <div v-if="showDetailModal && currentProfile" class="modal-overlay modal-large" @click.self="showDetailModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>养护详情 - {{ currentProfile.bookTitle }}</h3>
          <button class="close-btn" @click="showDetailModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-section">
            <h4>基本信息</h4>
            <div class="detail-grid">
              <div class="detail-item"><span class="label">品相：</span><span class="badge" :style="{ background: conditionColors[currentProfile.currentCondition] }">{{ currentProfile.currentCondition }}</span></div>
              <div class="detail-item"><span class="label">风险等级：</span><span class="badge" :style="{ background: riskColors[currentProfile.damageRiskLevel] }">{{ currentProfile.damageRiskLevel }}</span></div>
              <div class="detail-item"><span class="label">流转状态：</span><span v-if="currentProfile.isCirculationPaused" class="badge badge-danger">暂停中</span><span v-else class="badge badge-success">正常</span></div>
              <div class="detail-item"><span class="label">借阅次数：</span>{{ currentProfile.totalBorrowCount }} 次</div>
              <div class="detail-item"><span class="label">阅读次数：</span>{{ currentProfile.totalReadCount }} 次</div>
              <div class="detail-item"><span class="label">最近清洁：</span>{{ currentProfile.lastCleanDate || '未记录' }}</div>
              <div class="detail-item"><span class="label">最近检查：</span>{{ currentProfile.lastInspectionDate || '未记录' }}</div>
              <div class="detail-item"><span class="label">建档时间：</span>{{ currentProfile.createdAt }}</div>
            </div>
            <div v-if="currentProfile.conditionDescription" class="detail-desc">
              <span class="label">品相描述：</span>{{ currentProfile.conditionDescription }}
            </div>
            <div v-if="currentProfile.isCirculationPaused" class="detail-desc detail-warning">
              <span class="label">暂停原因：</span>{{ currentProfile.pauseReason }}
              <span v-if="currentProfile.expectedResumeDate"> · 预计恢复：{{ currentProfile.expectedResumeDate }}</span>
            </div>
          </div>

          <div class="detail-section">
            <h4>损耗记录（共 {{ currentProfile.damageRecords.length }} 条）</h4>
            <div v-if="currentProfile.damageRecords.length === 0" class="empty-sm">暂无损耗记录</div>
            <div v-else class="detail-list">
              <div v-for="d in [...currentProfile.damageRecords].sort((a, b) => b.createdAt.localeCompare(a.createdAt))" :key="d.id" class="detail-list-item">
                <div class="detail-list-header">
                  <span class="badge" :class="d.resolved ? 'badge-success' : 'badge-warning'">{{ d.resolved ? '已解决' : '未解决' }}</span>
                  <strong>[{{ d.damageType }}]</strong>
                  <span class="severity-tag" :class="'severity-' + d.severity">{{ d.severity }}</span>
                  <span class="muted">{{ d.discoveredDate }}</span>
                </div>
                <div class="detail-list-body">{{ d.description }}</div>
                <div v-if="d.resolved" class="detail-list-footer">✅ {{ d.resolvedAt }}：{{ d.resolutionNote }}</div>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h4>维修记录时间线</h4>
            <div v-if="currentProfile.repairRecords.length === 0" class="empty-sm">暂无维修记录</div>
            <div v-else class="timeline">
              <div v-for="r in [...currentProfile.repairRecords].sort((a, b) => b.createdAt.localeCompare(a.createdAt))" :key="r.id" class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                  <div class="timeline-header">
                    <span class="timeline-date">{{ r.repairDate }}</span>
                    <span class="badge" :style="{ background: repairStatusColors[r.status] }">{{ r.status }}</span>
                    <span class="timeline-type">{{ r.repairType }}</span>
                  </div>
                  <div class="timeline-desc">{{ r.description }}</div>
                  <div class="timeline-meta">
                    <span v-if="r.cost !== undefined">费用：¥{{ r.cost }}</span>
                    <span v-if="r.repairedBy"> · 处理人：{{ r.repairedBy }}</span>
                    <span v-if="r.notes"> · 备注：{{ r.notes }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h4>养护提醒</h4>
            <div v-if="currentProfile.reminders.length === 0" class="empty-sm">暂无提醒</div>
            <div v-else class="detail-list">
              <div v-for="rm in [...currentProfile.reminders].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))" :key="rm.id" class="detail-list-item">
                <div class="detail-list-header">
                  <span class="badge" :class="rm.isCompleted ? 'badge-success' : (isOverdue(rm.scheduledDate) ? 'badge-danger' : 'badge-warning')">
                    {{ rm.isCompleted ? '已完成' : (isOverdue(rm.scheduledDate) ? '已逾期' : '待处理') }}
                  </span>
                  <strong>{{ rm.title }}</strong>
                  <span class="muted">{{ rm.scheduledDate }}</span>
                  <span class="badge" :style="{ background: priorityColors[rm.priority] }">{{ priorityLabels[rm.priority] }}</span>
                </div>
                <div v-if="rm.description" class="detail-list-body">{{ rm.description }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="showDetailModal = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.care-page {
  min-height: 100%;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h2 {
  font-size: 22px;
  color: #333;
  margin-bottom: 8px;
}

.subtitle {
  color: #888;
  font-size: 14px;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border-left: 4px solid #667eea;
}

.stat-card.stat-danger {
  border-left-color: #f5222d;
}

.stat-card.stat-warning {
  border-left-color: #faad14;
}

.stat-icon {
  font-size: 32px;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: #333;
}

.stat-label {
  font-size: 13px;
  color: #888;
  margin-top: 4px;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  border-bottom: 2px solid #eee;
}

.tab {
  padding: 12px 24px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab:hover {
  color: #667eea;
}

.tab.active {
  color: #667eea;
  border-bottom-color: #667eea;
  font-weight: 600;
}

.tab-badge {
  background: #f5222d;
  color: white;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
}

.filter-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  align-items: center;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-item label {
  font-size: 13px;
  color: #666;
}

.filter-item select {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.loading, .empty {
  text-align: center;
  padding: 60px 20px;
  color: #888;
}

.empty-sm {
  text-align: center;
  padding: 20px;
  color: #aaa;
  font-size: 13px;
}

.profile-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.profile-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.profile-header {
  padding: 18px 20px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.profile-title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.book-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: white;
  background: #667eea;
}

.badge-paused {
  background: #f5222d;
}

.badge-danger {
  background: #f5222d;
}

.badge-success {
  background: #52c41a;
}

.badge-warning {
  background: #faad14;
  color: #333;
}

.profile-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.profile-body {
  padding: 18px 20px;
}

.info-row {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  font-size: 13px;
}

.info-row.info-warning {
  background: #fff7e6;
  padding: 10px 12px;
  border-radius: 6px;
  margin-bottom: 12px;
}

.info-label {
  color: #888;
}

.info-value {
  color: #333;
  font-weight: 500;
}

.risk-reasons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 12px;
}

.risk-tag {
  background: #fff1f0;
  color: #cf1322;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
}

.section {
  margin-top: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 10px;
}

.damage-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.damage-item {
  background: #fff7e6;
  padding: 12px;
  border-radius: 8px;
}

.damage-header {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 6px;
  font-size: 13px;
}

.damage-type {
  font-weight: 600;
  color: #d46b08;
}

.damage-severity {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.severity-轻微 { background: #f6ffed; color: #389e0d; }
.severity-中度 { background: #fff7e6; color: #d46b08; }
.severity-严重 { background: #fff1f0; color: #cf1322; }

.damage-date {
  color: #888;
  margin-left: auto;
}

.damage-desc {
  font-size: 13px;
  color: #555;
  margin-bottom: 8px;
}

.timeline {
  position: relative;
  padding-left: 20px;
}

.timeline-item {
  position: relative;
  padding-bottom: 16px;
}

.timeline-item:last-child {
  padding-bottom: 0;
}

.timeline-dot {
  position: absolute;
  left: -20px;
  top: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #667eea;
  border: 2px solid white;
  box-shadow: 0 0 0 2px #667eea;
}

.timeline-content {
  background: #fafafa;
  padding: 12px;
  border-radius: 8px;
}

.timeline-header {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 6px;
  font-size: 13px;
}

.timeline-date {
  color: #888;
}

.timeline-type {
  font-weight: 600;
  color: #667eea;
}

.timeline-desc {
  font-size: 13px;
  color: #555;
  margin-bottom: 6px;
}

.timeline-meta {
  font-size: 12px;
  color: #888;
}

.reminder-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reminder-card {
  background: white;
  border-radius: 12px;
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border-left: 4px solid #667eea;
}

.reminder-card.overdue {
  border-left-color: #f5222d;
  background: #fff1f0;
}

.reminder-icon {
  font-size: 32px;
}

.reminder-body {
  flex: 1;
}

.reminder-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.reminder-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.reminder-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #888;
  margin-bottom: 4px;
}

.reminder-desc {
  font-size: 13px;
  color: #666;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 20px;
}

.chart-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.btn {
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-sm { padding: 5px 12px; font-size: 12px; }
.btn-xs { padding: 3px 10px; font-size: 11px; }

.btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
.btn-primary:hover { opacity: 0.9; }

.btn-default { background: #f5f5f5; color: #666; }
.btn-default:hover { background: #eee; }

.btn-success { background: #52c41a; color: white; }
.btn-success:hover { background: #49aa19; }

.btn-warning { background: #faad14; color: white; }
.btn-warning:hover { background: #d48806; }

.btn-danger { background: #f5222d; color: white; }
.btn-danger:hover { background: #cf1322; }

.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-overlay.modal-large .modal {
  width: 700px;
  max-height: 85vh;
  overflow-y: auto;
}

.modal {
  background: white;
  border-radius: 12px;
  width: 500px;
  max-width: 90%;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  font-size: 16px;
  color: #333;
}

.close-btn {
  font-size: 22px;
  color: #999;
  background: none;
  border: none;
  cursor: pointer;
  line-height: 1;
}

.close-btn:hover { color: #666; }

.modal-body {
  padding: 20px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid #eee;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #555;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: #667eea;
  outline: none;
}

.form-group textarea {
  resize: vertical;
}

.required {
  color: #f5222d;
}

.error-text {
  display: block;
  color: #f5222d;
  font-size: 12px;
  margin-top: 4px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.detail-section {
  margin-bottom: 24px;
}

.detail-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.detail-item {
  font-size: 13px;
  color: #555;
}

.detail-item .label {
  color: #888;
}

.detail-desc {
  font-size: 13px;
  color: #555;
  margin-top: 8px;
  padding: 10px;
  background: #fafafa;
  border-radius: 6px;
}

.detail-desc.detail-warning {
  background: #fff7e6;
  color: #ad6800;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-list-item {
  background: #fafafa;
  padding: 12px;
  border-radius: 8px;
}

.detail-list-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
  font-size: 13px;
}

.detail-list-body {
  font-size: 13px;
  color: #555;
  margin-bottom: 4px;
}

.detail-list-footer {
  font-size: 12px;
  color: #389e0d;
  margin-top: 6px;
}

.muted { color: #888; }

.severity-tag {
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 11px;
}
</style>
