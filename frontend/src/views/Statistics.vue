<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { statsApi } from '@/api'
import type { Statistics } from '@/types'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart, PieChart, LineChart } from 'echarts/charts'
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
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  CanvasRenderer
])

const stats = ref<Statistics | null>(null)
const loading = ref(false)

const loadStats = async () => {
  loading.value = true
  try {
    stats.value = await statsApi.getStatistics()
  } catch (e) {
    console.error('加载统计数据失败', e)
  } finally {
    loading.value = false
  }
}

const monthlyChartOption = computed(() => {
  if (!stats.value) return {}
  const data = stats.value.monthlyReadingFrequency
  return {
    title: {
      text: '各月龄阅读频次',
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 600 }
    },
    tooltip: {
      trigger: 'axis',
      formatter: '{b}月龄: {c}次'
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d.month + '月'),
      axisLabel: { fontSize: 12 }
    },
    yAxis: {
      type: 'value',
      name: '次数',
      nameTextStyle: { fontSize: 12 }
    },
    series: [{
      type: 'bar',
      data: data.map(d => d.count),
      itemStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: '#667eea' },
            { offset: 1, color: '#764ba2' }
          ]
        },
        borderRadius: [4, 4, 0, 0]
      },
      barWidth: '50%'
    }],
    grid: { left: 50, right: 20, top: 50, bottom: 30 }
  }
})

const themeChartOption = computed(() => {
  if (!stats.value) return {}
  const data = stats.value.popularThemes
  const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#43e97b', '#fa709a', '#fee140', '#30cfd0', '#a8edea']
  return {
    title: {
      text: '热门绘本主题',
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 600 }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}次 ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: { fontSize: 12 }
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['40%', '55%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 6,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: { show: false },
      emphasis: {
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 'bold'
        }
      },
      data: data.map((d, i) => ({
        value: d.count,
        name: d.theme,
        itemStyle: { color: colors[i % colors.length] }
      }))
    }]
  }
})

const returnRateChartOption = computed(() => {
  if (!stats.value) return {}
  const rate = stats.value.returnRate
  return {
    title: {
      text: '借出回收率',
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 600 }
    },
    series: [{
      type: 'pie',
      radius: ['60%', '80%'],
      center: ['50%', '55%'],
      avoidLabelOverlap: false,
      label: {
        show: true,
        position: 'center',
        formatter: '{d}%',
        fontSize: 28,
        fontWeight: 'bold',
        color: '#52c41a'
      },
      labelLine: { show: false },
      data: [
        { value: rate, name: '已归还', itemStyle: { color: '#52c41a' } },
        { value: 100 - rate, name: '未归还', itemStyle: { color: '#f0f0f0' } }
      ]
    }]
  }
})

onMounted(() => {
  loadStats()
})
</script>

<template>
  <div class="stats-page">
    <div class="page-header">
      <h1 class="page-title">📊 统计分析</h1>
      <button class="btn btn-outline" @click="loadStats">
        🔄 刷新数据
      </button>
    </div>

    <div class="stats-cards">
      <div class="stat-card primary">
        <div class="stat-icon">📚</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats?.totalBooks || 0 }}</div>
          <div class="stat-label">绘本总数</div>
        </div>
      </div>
      <div class="stat-card warning">
        <div class="stat-icon">📖</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats?.totalBorrows || 0 }}</div>
          <div class="stat-label">总借阅次数</div>
        </div>
      </div>
      <div class="stat-card success">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats?.returnRate || 0 }}%</div>
          <div class="stat-label">借出回收率</div>
        </div>
      </div>
      <div class="stat-card info">
        <div class="stat-icon">⏱️</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats?.totalReadingTime || 0 }}</div>
          <div class="stat-label">累计阅读(分钟)</div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else class="charts-grid">
      <div class="chart-card">
        <v-chart :option="monthlyChartOption" style="height: 300px;" autoresize />
      </div>
      <div class="chart-card">
        <v-chart :option="themeChartOption" style="height: 300px;" autoresize />
      </div>
      <div class="chart-card">
        <v-chart :option="returnRateChartOption" style="height: 300px;" autoresize />
      </div>
      <div class="chart-card idle-books-card">
        <h3 class="card-title">⚠️ 长期闲置绘本提醒</h3>
        <div v-if="stats?.idleBooks && stats.idleBooks.length > 0" class="idle-list">
          <div
            v-for="book in stats.idleBooks"
            :key="book.id"
            class="idle-item"
          >
            <span class="book-emoji-small">📖</span>
            <div class="idle-book-info">
              <div class="idle-book-title">{{ book.title }}</div>
              <div class="idle-book-meta">
                {{ book.theme }} · {{ book.minMonth }}-{{ book.maxMonth }}月
              </div>
            </div>
            <span class="idle-tag">闲置超60天</span>
          </div>
        </div>
        <div v-else class="no-idle">
          <span class="happy-icon">😊</span>
          <p>太棒了！没有长期闲置的绘本</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-page {
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

.btn-outline {
  background: white;
  border: 1px solid #ddd;
  color: #666;
}

.btn-outline:hover {
  border-color: #667eea;
  color: #667eea;
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
  display: flex;
  align-items: center;
  gap: 14px;
  border-left: 4px solid #d9d9d9;
}

.stat-card.primary { border-left-color: #667eea; }
.stat-card.warning { border-left-color: #faad14; }
.stat-card.success { border-left-color: #52c41a; }
.stat-card.info { border-left-color: #1890ff; }

.stat-icon {
  font-size: 36px;
  flex-shrink: 0;
}

.stat-content {
  flex: 1;
  min-width: 0;
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

.loading {
  text-align: center;
  padding: 60px;
  color: #999;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.chart-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.idle-books-card {
  display: flex;
  flex-direction: column;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 16px;
}

.idle-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  overflow-y: auto;
}

.idle-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #fff7e6;
  border-radius: 8px;
  border: 1px solid #ffd591;
}

.book-emoji-small {
  font-size: 24px;
  flex-shrink: 0;
}

.idle-book-info {
  flex: 1;
  min-width: 0;
}

.idle-book-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.idle-book-meta {
  font-size: 12px;
  color: #999;
}

.idle-tag {
  font-size: 11px;
  padding: 3px 8px;
  background: #fa8c16;
  color: white;
  border-radius: 10px;
  flex-shrink: 0;
}

.no-idle {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
}

.happy-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

@media (max-width: 900px) {
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  .charts-grid {
    grid-template-columns: 1fr;
  }
}
</style>
