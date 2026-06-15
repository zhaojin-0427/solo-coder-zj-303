<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { recommendApi, babyApi, rotationApi, assessmentApi, careApi } from '@/api'
import type { Recommendation, BabyInfo, RotationPlanStats, AssessmentOverview, BookCareProfile, DamageRiskLevel } from '@/types'

const recommendations = ref<Recommendation[]>([])
const babyInfo = ref<BabyInfo | null>(null)
const themePreferences = ref<{ theme: string; count: number }[]>([])
const rotationStats = ref<RotationPlanStats | null>(null)
const assessmentOverview = ref<AssessmentOverview | null>(null)
const careProfiles = ref<BookCareProfile[]>([])
const loading = ref(false)

const riskColors: Record<DamageRiskLevel, string> = {
  '低': '#52c41a',
  '中': '#faad14',
  '高': '#fa541c',
  '极高': '#f5222d'
}

const getCareProfile = (bookId: string) => {
  return careProfiles.value.find(p => p.bookId === bookId)
}

const loadData = async () => {
  loading.value = true
  try {
    const [info, rec, stats, overview, profiles] = await Promise.all([
      babyApi.getInfo(),
      recommendApi.getRecommendations(),
      rotationApi.getStats().catch(() => null),
      assessmentApi.getOverview().catch(() => null),
      careApi.getProfiles().catch(() => [])
    ])
    babyInfo.value = info
    recommendations.value = rec.recommendations
    themePreferences.value = rec.themePreferences
    rotationStats.value = stats
    assessmentOverview.value = overview
    careProfiles.value = profiles
  } catch (e) {
    console.error('加载推荐数据失败', e)
  } finally {
    loading.value = false
  }
}

const getScoreColor = (score: number) => {
  if (score >= 80) return '#52c41a'
  if (score >= 60) return '#faad14'
  return '#8c8c8c'
}

const getScoreLevel = (score: number) => {
  if (score >= 80) return '强烈推荐'
  if (score >= 60) return '推荐'
  return '一般'
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="recommend-page">
    <div class="page-header">
      <h1 class="page-title">🎯 月龄阅读推荐</h1>
      <button class="btn btn-outline" @click="loadData">
        🔄 刷新推荐
      </button>
    </div>

    <div v-if="rotationStats && rotationStats.hasPlan" class="rotation-stats-card">
      <div class="rotation-stats-header">
        <span class="rotation-icon">📅</span>
        <span class="rotation-title">本周轮换计划</span>
      </div>
      <div class="rotation-stats-content">
        <div class="rotation-stat-item">
          <div class="rotation-stat-value">{{ rotationStats.completionRate }}%</div>
          <div class="rotation-stat-label">完成率</div>
        </div>
        <div class="rotation-stat-item highlight">
          <div class="rotation-stat-value">{{ rotationStats.hitRate }}%</div>
          <div class="rotation-stat-label">计划命中率</div>
        </div>
        <div class="rotation-stat-item">
          <div class="rotation-stat-value">{{ rotationStats.readCount }}/{{ rotationStats.totalCount }}</div>
          <div class="rotation-stat-label">已读/总计</div>
        </div>
        <router-link to="/rotation" class="go-rotation-link">
          查看计划 →
        </router-link>
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
        <span v-if="assessmentOverview.activeAlerts > 0" class="assessment-alert-count">{{ assessmentOverview.activeAlerts }}项需关注</span>
        <span v-if="assessmentOverview.pendingInterventions > 0" class="assessment-intervention-count">{{ assessmentOverview.pendingInterventions }}条待执行建议</span>
      </div>
      <div v-if="assessmentOverview.dimensions" class="assessment-dim-tags">
        <span
          v-for="dim in assessmentOverview.dimensions.filter(d => d.level === '需关注' || d.level === '一般')"
          :key="dim.key"
          class="dim-tag"
          :class="dim.level"
        >
          {{ dim.label }}: {{ dim.level }}
        </span>
      </div>
    </div>

    <div v-if="babyInfo" class="baby-info-card">
      <div class="baby-avatar-large">👶</div>
      <div class="baby-detail">
        <h2>{{ babyInfo.name }}</h2>
        <p class="baby-age-big">当前月龄：<strong>{{ babyInfo.ageMonths }} 个月</strong></p>
        <p class="tip">根据宝宝月龄和历史阅读偏好智能推荐</p>
      </div>
    </div>

    <div v-if="themePreferences.length > 0" class="pref-section">
      <h3 class="section-title">📊 阅读偏好分析</h3>
      <div class="pref-tags">
        <span
          v-for="pref in themePreferences"
          :key="pref.theme"
          class="pref-tag"
        >
          {{ pref.theme }}
          <span class="pref-count">{{ pref.count }}次</span>
        </span>
      </div>
    </div>

    <h3 class="section-title">💡 为你推荐</h3>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else class="recommend-list">
      <div
        v-for="(rec, index) in recommendations"
        :key="rec.bookId"
        class="recommend-card"
      >
        <div class="rank-badge" :class="{ top: index < 3 }">
          {{ index + 1 }}
        </div>
        <div class="book-cover-rec">
          <span class="book-emoji">📖</span>
        </div>
        <div class="rec-info">
          <div class="rec-header">
            <h3 class="book-title-rec">{{ rec.bookTitle }}</h3>
            <div
              class="match-score"
              :style="{ color: getScoreColor(rec.matchScore) }"
            >
              <div class="score-circle">
                <span class="score-num">{{ rec.matchScore }}%</span>
              </div>
              <span class="score-label">{{ getScoreLevel(rec.matchScore) }}</span>
            </div>
          </div>
          <div class="book-meta-rec">
            <span class="meta-item">✍️ {{ rec.book.author }}</span>
            <span class="meta-item">📚 {{ rec.book.theme }}</span>
            <span class="meta-item">👶 {{ rec.book.minMonth }}-{{ rec.book.maxMonth }}月</span>
            <span class="meta-item">🎮 {{ rec.book.interactionType }}</span>
            <span
              v-if="getCareProfile(rec.bookId)"
              class="meta-item risk-badge"
              :style="{ color: riskColors[getCareProfile(rec.bookId)!.damageRiskLevel], borderColor: riskColors[getCareProfile(rec.bookId)!.damageRiskLevel] }"
            >
              风险：{{ getCareProfile(rec.bookId)!.damageRiskLevel }}
            </span>
          </div>
          <div
            v-if="getCareProfile(rec.bookId) && (getCareProfile(rec.bookId)!.damageRiskLevel === '高' || getCareProfile(rec.bookId)!.damageRiskLevel === '极高' || getCareProfile(rec.bookId)!.isCirculationPaused)"
            class="high-risk-warning"
          >
            🚫 高风险/暂停流转，暂不推荐外借
          </div>
          <div class="rec-reasons">
            <span class="reasons-label">推荐理由：</span>
            <div class="reasons-list">
              <span v-for="(reason, i) in rec.reasons" :key="i" class="reason-tag">
                ✓ {{ reason }}
              </span>
            </div>
          </div>
          <div v-if="rec.book.description" class="book-desc">
            {{ rec.book.description }}
          </div>
        </div>
      </div>

      <div v-if="recommendations.length === 0" class="empty-state">
        <span class="empty-icon">🎯</span>
        <p>暂无推荐绘本，可能所有绘本都已读过啦~</p>
        <p class="sub">添加更多绘本试试吧</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recommend-page {
  max-width: 900px;
  margin: 0 auto;
}

.rotation-stats-card {
  background: white;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border-left: 4px solid #667eea;
}

.rotation-stats-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.rotation-icon {
  font-size: 20px;
}

.rotation-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.rotation-stats-content {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.rotation-stat-item {
  text-align: center;
}

.rotation-stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #333;
  margin-bottom: 2px;
}

.rotation-stat-item.highlight .rotation-stat-value {
  color: #52c41a;
}

.rotation-stat-label {
  font-size: 12px;
  color: #999;
}

.go-rotation-link {
  margin-left: auto;
  font-size: 13px;
  color: #667eea;
  font-weight: 500;
}

.go-rotation-link:hover {
  color: #764ba2;
  text-decoration: underline;
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

.btn-outline {
  background: white;
  border: 1px solid #ddd;
  color: #666;
}

.btn-outline:hover {
  border-color: #667eea;
  color: #667eea;
}

.baby-info-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 28px;
  color: white;
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 28px;
}

.baby-avatar-large {
  width: 80px;
  height: 80px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
}

.baby-detail {
  flex: 1;
}

.baby-detail h2 {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 8px;
}

.baby-age-big {
  font-size: 15px;
  opacity: 0.95;
  margin-bottom: 4px;
}

.baby-age-big strong {
  font-size: 18px;
  font-weight: 600;
}

.tip {
  font-size: 13px;
  opacity: 0.85;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 16px;
  margin-top: 8px;
}

.pref-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.pref-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.pref-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #f0f5ff;
  color: #667eea;
  border-radius: 20px;
  font-size: 13px;
}

.pref-count {
  background: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.loading {
  text-align: center;
  padding: 60px;
  color: #999;
}

.recommend-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.recommend-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  gap: 20px;
  position: relative;
  transition: all 0.2s;
}

.recommend-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.rank-badge {
  position: absolute;
  top: -8px;
  left: -8px;
  width: 36px;
  height: 36px;
  background: #d9d9d9;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
}

.rank-badge.top {
  background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%);
}

.book-cover-rec {
  width: 90px;
  height: 110px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.book-emoji {
  font-size: 36px;
}

.rec-info {
  flex: 1;
  min-width: 0;
}

.rec-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
}

.book-title-rec {
  font-size: 17px;
  font-weight: 600;
  color: #333;
}

.match-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

.score-circle {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 3px solid currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}

.score-num {
  font-size: 14px;
  font-weight: 700;
}

.score-label {
  font-size: 12px;
}

.book-meta-rec {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.meta-item {
  font-size: 13px;
  color: #888;
}

.meta-item.risk-badge {
  padding: 2px 10px;
  border-radius: 12px;
  border: 1px solid;
  font-weight: 500;
  font-size: 12px;
}

.high-risk-warning {
  background: #fff2f0;
  color: #ff4d4f;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 10px;
  border: 1px solid #ffccc7;
}

.rec-reasons {
  margin-bottom: 10px;
}

.reasons-label {
  font-size: 13px;
  color: #666;
  margin-right: 8px;
}

.reasons-list {
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

.book-desc {
  font-size: 13px;
  color: #999;
  line-height: 1.6;
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

.empty-state .sub {
  font-size: 13px;
  margin-top: 4px;
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

.assessment-alert-count {
  font-size: 12px;
  padding: 2px 8px;
  background: #fff2f0;
  color: #ff4d4f;
  border-radius: 10px;
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
