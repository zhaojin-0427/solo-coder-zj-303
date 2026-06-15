<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { rotationApi, babyApi, assessmentApi } from '@/api'
import type { RotationPlan, RotationPlanItem, BabyInfo, AssessmentOverview } from '@/types'

const plan = ref<RotationPlan | null>(null)
const babyInfo = ref<BabyInfo | null>(null)
const loading = ref(false)
const generating = ref(false)
const showSkipModal = ref(false)
const skipItem = ref<RotationPlanItem | null>(null)
const skipReason = ref('')
const assessmentOverview = ref<AssessmentOverview | null>(null)

const loadData = async () => {
  loading.value = true
  try {
    const [info, currentPlan, overview] = await Promise.all([
      babyApi.getInfo(),
      rotationApi.getCurrent().catch(() => null),
      assessmentApi.getOverview().catch(() => null)
    ])
    babyInfo.value = info
    plan.value = currentPlan
    assessmentOverview.value = overview
  } catch (e) {
    console.error('加载数据失败', e)
  } finally {
    loading.value = false
  }
}

const generatePlan = async () => {
  if (!confirm('确定要生成本周的轮换计划吗？')) return
  generating.value = true
  try {
    plan.value = await rotationApi.generate(5)
  } catch (e: any) {
    alert(e.response?.data?.error || '生成计划失败')
  } finally {
    generating.value = false
  }
}

const toggleFocus = async (item: RotationPlanItem) => {
  if (!plan.value) return
  try {
    const updated = await rotationApi.setFocus(plan.value.id, item.id, !item.isFocus)
    item.isFocus = updated.isFocus
  } catch (e) {
    console.error('设置重点失败', e)
  }
}

const openSkipModal = (item: RotationPlanItem) => {
  skipItem.value = item
  skipReason.value = ''
  showSkipModal.value = true
}

const confirmSkip = async () => {
  if (!plan.value || !skipItem.value) return
  if (!skipReason.value.trim()) {
    alert('请填写跳过原因')
    return
  }
  try {
    const updated = await rotationApi.skipItem(plan.value.id, skipItem.value.id, skipReason.value)
    skipItem.value.status = updated.status
    skipItem.value.skipReason = updated.skipReason
    showSkipModal.value = false
  } catch (e) {
    console.error('跳过失败', e)
  }
}

const unskipItem = async (item: RotationPlanItem) => {
  if (!plan.value) return
  try {
    const updated = await rotationApi.unskipItem(plan.value.id, item.id)
    item.status = updated.status
    item.skipReason = updated.skipReason
  } catch (e) {
    console.error('取消跳过失败', e)
  }
}

const stats = computed(() => {
  if (!plan.value) return null
  const items = plan.value.items
  const total = items.length
  const read = items.filter(i => i.status === '已读').length
  const skipped = items.filter(i => i.status === '跳过').length
  const nonSkipped = total - skipped
  return {
    total,
    read,
    skipped,
    completionRate: total > 0 ? Math.round((read / total) * 100) : 0,
    hitRate: nonSkipped > 0 ? Math.round((read / nonSkipped) * 100) : 0
  }
})

const formatWeekRange = (start: string, end: string) => {
  const s = new Date(start)
  const e = new Date(end)
  return `${s.getMonth() + 1}月${s.getDate()}日 - ${e.getMonth() + 1}月${e.getDate()}日`
}

const getStatusColor = (status: string) => {
  switch (status) {
    case '已读': return '#52c41a'
    case '跳过': return '#ff4d4f'
    case '重点': return '#faad14'
    default: return '#1890ff'
  }
}

const getStatusBg = (status: string) => {
  switch (status) {
    case '已读': return '#f6ffed'
    case '跳过': return '#fff1f0'
    default: return '#e6f7ff'
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="rotation-page">
    <div class="page-header">
      <h1 class="page-title">📅 家庭绘本轮换计划</h1>
      <button 
        v-if="!plan" 
        class="btn btn-primary" 
        :disabled="generating"
        @click="generatePlan"
      >
        {{ generating ? '生成中...' : '✨ 生成本周计划' }}
      </button>
      <button 
        v-else 
        class="btn btn-outline" 
        @click="loadData"
      >
        🔄 刷新
      </button>
    </div>

    <div v-if="babyInfo && plan" class="plan-header-card">
      <div class="plan-info">
        <div class="plan-week">
          📅 {{ formatWeekRange(plan.weekStartDate, plan.weekEndDate) }}
        </div>
        <div class="plan-baby">
          👶 {{ babyInfo.name }} · {{ plan.babyAgeMonths }} 个月
        </div>
      </div>
      <div class="plan-stats">
        <div class="stat-item">
          <div class="stat-num">{{ stats?.read }}/{{ stats?.total }}</div>
          <div class="stat-label">已读进度</div>
        </div>
        <div class="stat-item highlight">
          <div class="stat-num">{{ stats?.completionRate }}%</div>
          <div class="stat-label">完成率</div>
        </div>
        <div class="stat-item highlight-success">
          <div class="stat-num">{{ stats?.hitRate }}%</div>
          <div class="stat-label">计划命中率</div>
        </div>
      </div>
    </div>

    <div v-if="assessmentOverview && assessmentOverview.hasReport" class="assessment-alert-card">
      <div class="assessment-alert-header">
        <span class="assessment-icon">🌟</span>
        <span class="assessment-title">成长评估命中</span>
        <router-link to="/assessment" class="go-assessment-link">查看详情 →</router-link>
      </div>
      <div class="assessment-alert-content">
        <span class="assessment-score" :style="{ color: assessmentOverview.latestScore >= 85 ? '#52c41a' : assessmentOverview.latestScore >= 65 ? '#1890ff' : assessmentOverview.latestScore >= 40 ? '#faad14' : '#ff4d4f' }">{{ assessmentOverview.latestScore }}分</span>
        <span class="assessment-level">{{ assessmentOverview.latestLevel }}</span>
        <span v-if="assessmentOverview.pendingInterventions > 0" class="assessment-intervention-count">{{ assessmentOverview.pendingInterventions }}条待执行建议</span>
      </div>
      <div v-if="assessmentOverview.dimensions && assessmentOverview.dimensions.find(d => d.key === 'rotationCompletion') && (assessmentOverview.dimensions.find(d => d.key === 'rotationCompletion').level === '需关注' || assessmentOverview.dimensions.find(d => d.key === 'rotationCompletion').level === '一般')" class="assessment-dim-tags">
        <span class="dim-tag" :class="assessmentOverview.dimensions.find(d => d.key === 'rotationCompletion').level">
          轮换计划完成度: {{ assessmentOverview.dimensions.find(d => d.key === 'rotationCompletion').level }}
        </span>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else-if="!plan" class="empty-state">
      <span class="empty-icon">📅</span>
      <p>还没有本周的轮换计划</p>
      <p class="sub">点击上方按钮生成专属阅读计划</p>
      <div class="feature-tips">
        <div class="tip-item">
          <span class="tip-icon">🎯</span>
          <div>
            <div class="tip-title">智能匹配月龄</div>
            <div class="tip-desc">根据宝宝当前月龄精准推荐适龄绘本</div>
          </div>
        </div>
        <div class="tip-item">
          <span class="tip-icon">🔄</span>
          <div>
            <div class="tip-title">避免重复阅读</div>
            <div class="tip-desc">自动排除近2周内读过的绘本</div>
          </div>
        </div>
        <div class="tip-item">
          <span class="tip-icon">⚠️</span>
          <div>
            <div class="tip-title">激活闲置绘本</div>
            <div class="tip-desc">优先推荐长期闲置未读的绘本</div>
          </div>
        </div>
        <div class="tip-item">
          <span class="tip-icon">🎨</span>
          <div>
            <div class="tip-title">主题均衡分配</div>
            <div class="tip-desc">确保本周阅读涵盖多元主题类型</div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="plan-items">
      <div
        v-for="item in plan.items"
        :key="item.id"
        class="plan-item-card"
        :class="{ 
          'is-focus': item.isFocus,
          'is-read': item.status === '已读',
          'is-skipped': item.status === '跳过'
        }"
      >
        <div class="item-order">
          <span class="order-num">{{ item.sortOrder }}</span>
          <span v-if="item.isFocus" class="focus-badge">⭐ 重点</span>
        </div>

        <div class="book-cover-plan">
          <span class="book-emoji-plan">📖</span>
        </div>

        <div class="item-content">
          <div class="item-header">
            <h3 class="book-title-plan">{{ item.bookTitle }}</h3>
            <span 
              class="status-tag"
              :style="{ 
                color: getStatusColor(item.status),
                background: getStatusBg(item.status)
              }"
            >
              {{ item.status }}
            </span>
          </div>

          <div class="book-meta-plan">
            <span class="meta-item">✍️ {{ item.book.author }}</span>
            <span class="meta-item">📚 {{ item.book.theme }}</span>
            <span class="meta-item">👶 {{ item.book.minMonth }}-{{ item.book.maxMonth }}月</span>
            <span class="meta-item">🎮 {{ item.book.interactionType }}</span>
          </div>

          <div class="reasons-section">
            <span class="reasons-label">💡 推荐理由：</span>
            <div class="reasons-tags">
              <span v-for="(reason, i) in item.reasons" :key="i" class="reason-tag">
                ✓ {{ reason }}
              </span>
            </div>
          </div>

          <div v-if="item.status === '已读'" class="read-info">
            ✅ 于 {{ item.readDate }} 完成阅读
          </div>

          <div v-if="item.status === '跳过'" class="skip-info">
            ⏭️ 跳过原因：{{ item.skipReason }}
          </div>
        </div>

        <div class="item-actions">
          <button 
            v-if="item.status !== '已读' && item.status !== '跳过'"
            class="action-btn focus-btn"
            :class="{ active: item.isFocus }"
            @click="toggleFocus(item)"
            :title="item.isFocus ? '取消重点' : '设为重点'"
          >
            {{ item.isFocus ? '⭐' : '☆' }}
          </button>
          <button 
            v-if="item.status !== '已读' && item.status !== '跳过'"
            class="action-btn skip-btn"
            @click="openSkipModal(item)"
            title="跳过"
          >
            ⏭️
          </button>
          <button 
            v-if="item.status === '跳过'"
            class="action-btn unskip-btn"
            @click="unskipItem(item)"
            title="取消跳过"
          >
            🔄
          </button>
        </div>
      </div>
    </div>

    <div v-if="showSkipModal" class="modal-overlay" @click.self="showSkipModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>跳过绘本</h3>
          <button class="close-btn" @click="showSkipModal = false">×</button>
        </div>
        <div class="modal-body">
          <p class="skip-book-name">《{{ skipItem?.bookTitle }}》</p>
          <div class="form-group">
            <label>跳过原因 *</label>
            <textarea 
              v-model="skipReason" 
              rows="3" 
              placeholder="请填写跳过原因，例如：宝宝最近不感兴趣、绘本太难了..."
            ></textarea>
          </div>
          <div class="quick-reasons">
            <span 
              v-for="reason in ['宝宝不感兴趣', '难度不合适', '已读过', '状态不佳', '其他']" 
              :key="reason"
              class="quick-reason-tag"
              @click="skipReason = reason"
            >
              {{ reason }}
            </span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showSkipModal = false">取消</button>
          <button class="btn btn-primary" @click="confirmSkip">确认跳过</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rotation-page {
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

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-default {
  background: #f5f5f5;
  color: #666;
}

.btn-default:hover {
  background: #eee;
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

.plan-header-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 24px;
  color: white;
  margin-bottom: 28px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.plan-info {
  flex: 1;
  min-width: 200px;
}

.plan-week {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.plan-baby {
  font-size: 14px;
  opacity: 0.9;
}

.plan-stats {
  display: flex;
  gap: 24px;
}

.stat-item {
  text-align: center;
}

.stat-num {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  opacity: 0.85;
}

.stat-item.highlight .stat-num {
  color: #ffd700;
}

.stat-item.highlight-success .stat-num {
  color: #73d13d;
}

.loading {
  text-align: center;
  padding: 60px;
  color: #999;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.empty-icon {
  font-size: 56px;
  margin-bottom: 16px;
  display: block;
}

.empty-state p {
  font-size: 16px;
  color: #666;
  margin-bottom: 4px;
}

.empty-state .sub {
  font-size: 14px;
  color: #999;
  margin-bottom: 32px;
}

.feature-tips {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  max-width: 600px;
  margin: 0 auto;
  text-align: left;
}

.tip-item {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #f8f9ff;
  border-radius: 12px;
  border: 1px solid #e8e8ff;
}

.tip-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.tip-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.tip-desc {
  font-size: 12px;
  color: #888;
  line-height: 1.5;
}

.plan-items {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.plan-item-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  gap: 20px;
  transition: all 0.2s;
  position: relative;
  border-left: 4px solid transparent;
}

.plan-item-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.plan-item-card.is-focus {
  border-left-color: #faad14;
  background: linear-gradient(90deg, #fffbe6 0%, #ffffff 10%);
}

.plan-item-card.is-read {
  border-left-color: #52c41a;
  opacity: 0.85;
}

.plan-item-card.is-skipped {
  border-left-color: #ff4d4f;
  opacity: 0.7;
}

.item-order {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.order-num {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
}

.is-focus .order-num {
  background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%);
}

.is-read .order-num {
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
}

.is-skipped .order-num {
  background: linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%);
}

.focus-badge {
  font-size: 11px;
  color: #fa8c16;
  font-weight: 600;
  white-space: nowrap;
}

.book-cover-plan {
  width: 80px;
  height: 100px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.is-focus .book-cover-plan {
  background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%);
}

.book-emoji-plan {
  font-size: 32px;
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
  gap: 12px;
}

.book-title-plan {
  font-size: 17px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.status-tag {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.book-meta-plan {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.meta-item {
  font-size: 13px;
  color: #888;
}

.reasons-section {
  margin-bottom: 10px;
}

.reasons-label {
  font-size: 13px;
  color: #666;
  margin-right: 8px;
}

.reasons-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.reason-tag {
  font-size: 12px;
  color: #52c41a;
  background: #f6ffed;
  padding: 3px 8px;
  border-radius: 4px;
}

.read-info {
  font-size: 13px;
  color: #52c41a;
  margin-top: 8px;
  padding: 8px 12px;
  background: #f6ffed;
  border-radius: 6px;
}

.skip-info {
  font-size: 13px;
  color: #ff4d4f;
  margin-top: 8px;
  padding: 8px 12px;
  background: #fff1f0;
  border-radius: 6px;
}

.item-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.action-btn {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  font-size: 18px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.focus-btn {
  background: #fff7e6;
  color: #faad14;
  border: 1px solid #ffd591;
}

.focus-btn:hover {
  background: #ffe7ba;
}

.focus-btn.active {
  background: #ffd666;
  color: #d46b08;
}

.skip-btn {
  background: #fff1f0;
  color: #ff4d4f;
  border: 1px solid #ffccc7;
}

.skip-btn:hover {
  background: #ffccc7;
}

.unskip-btn {
  background: #e6f7ff;
  color: #1890ff;
  border: 1px solid #91d5ff;
}

.unskip-btn:hover {
  background: #91d5ff;
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
  margin: 0;
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

.skip-book-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 20px;
  padding: 12px 16px;
  background: #f5f5f5;
  border-radius: 8px;
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

.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 14px;
  resize: vertical;
  transition: border-color 0.2s;
}

.form-group textarea:focus {
  border-color: #667eea;
  outline: none;
}

.quick-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-reason-tag {
  padding: 6px 14px;
  background: #f0f0f0;
  color: #666;
  border-radius: 16px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-reason-tag:hover {
  background: #e0e0e0;
  color: #333;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid #f0f0f0;
}

@media (max-width: 768px) {
  .plan-header-card {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .plan-stats {
    width: 100%;
    justify-content: space-around;
  }
  
  .feature-tips {
    grid-template-columns: 1fr;
  }
  
  .plan-item-card {
    flex-wrap: wrap;
  }
  
  .item-actions {
    flex-direction: row;
    width: 100%;
    justify-content: flex-end;
  }
}

.assessment-alert-card {
  background: white;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border-left: 4px solid #764ba2;
}

.assessment-alert-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.assessment-icon {
  font-size: 20px;
}

.assessment-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  flex: 1;
}

.go-assessment-link {
  font-size: 13px;
  color: #764ba2;
  font-weight: 500;
}

.go-assessment-link:hover {
  text-decoration: underline;
}

.assessment-alert-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.assessment-score {
  font-size: 20px;
  font-weight: 700;
}

.assessment-level {
  font-size: 13px;
  color: #666;
}

.assessment-intervention-count {
  font-size: 12px;
  padding: 2px 8px;
  background: #fffbe6;
  color: #fa8c16;
  border-radius: 10px;
}

.assessment-dim-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.dim-tag {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 10px;
}

.dim-tag.需关注 {
  background: #fff2f0;
  color: #ff4d4f;
}

.dim-tag.一般 {
  background: #fffbe6;
  color: #faad14;
}
</style>
