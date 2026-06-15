<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { babyApi } from '@/api'
import type { BabyInfo } from '@/types'

const route = useRoute()
const babyInfo = ref<BabyInfo | null>(null)
const showBabyModal = ref(false)
const editBaby = ref<Partial<BabyInfo>>({})

const navItems = [
  { path: '/books', name: '绘本档案', icon: '📚' },
  { path: '/borrow', name: '借阅记录', icon: '📖' },
  { path: '/sharing', name: '共享换书', icon: '🔄' },
  { path: '/rotation', name: '轮换计划', icon: '📅' },
  { path: '/recommend', name: '月龄推荐', icon: '🎯' },
  { path: '/reading', name: '阅读打卡', icon: '📝' },
  { path: '/statistics', name: '统计分析', icon: '📊' },
  { path: '/assessment', name: '成长评估', icon: '🌟' },
  { path: '/care', name: '绘本养护', icon: '🧼' }
]

const loadBabyInfo = async () => {
  try {
    babyInfo.value = await babyApi.getInfo()
  } catch (e) {
    console.error('加载宝宝信息失败', e)
  }
}

const openEditBaby = () => {
  editBaby.value = { ...babyInfo.value }
  showBabyModal.value = true
}

const saveBabyInfo = async () => {
  try {
    babyInfo.value = await babyApi.updateInfo(editBaby.value)
    showBabyModal.value = false
  } catch (e) {
    console.error('保存宝宝信息失败', e)
  }
}

onMounted(() => {
  loadBabyInfo()
})
</script>

<template>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="logo">
        <span class="logo-icon">👶</span>
        <span class="logo-text">宝宝绘本平台</span>
      </div>
      
      <nav class="nav-menu">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: route.path === item.path }"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-text">{{ item.name }}</span>
        </router-link>
      </nav>
      
      <div class="baby-card" @click="openEditBaby">
        <div class="baby-avatar">👶</div>
        <div class="baby-info">
          <div class="baby-name">{{ babyInfo?.name || '宝宝' }}</div>
          <div class="baby-age">{{ babyInfo?.ageMonths }} 个月</div>
        </div>
        <span class="edit-icon">✏️</span>
      </div>
    </aside>
    
    <main class="main-content">
      <router-view />
    </main>
    
    <div v-if="showBabyModal" class="modal-overlay" @click.self="showBabyModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>编辑宝宝信息</h3>
          <button class="close-btn" @click="showBabyModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>宝宝姓名</label>
            <input v-model="editBaby.name" type="text" placeholder="请输入宝宝姓名" />
          </div>
          <div class="form-group">
            <label>出生日期</label>
            <input v-model="editBaby.birthDate" type="date" />
          </div>
          <div class="form-group">
            <label>性别</label>
            <select v-model="editBaby.gender">
              <option value="男">男</option>
              <option value="女">女</option>
              <option value="保密">保密</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showBabyModal = false">取消</button>
          <button class="btn btn-primary" @click="saveBabyInfo">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100%;
}

.sidebar {
  width: 240px;
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  flex-direction: column;
  padding: 20px 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px 30px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  margin-bottom: 20px;
}

.logo-icon {
  font-size: 28px;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
}

.nav-menu {
  flex: 1;
  padding: 0 10px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 15px;
  border-radius: 8px;
  margin-bottom: 4px;
  transition: all 0.2s;
  color: rgba(255, 255, 255, 0.85);
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.25);
  color: white;
  font-weight: 500;
}

.nav-icon {
  font-size: 18px;
}

.baby-card {
  margin: 0 15px;
  padding: 15px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.baby-card:hover {
  background: rgba(255, 255, 255, 0.25);
}

.baby-avatar {
  width: 40px;
  height: 40px;
  background: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.baby-info {
  flex: 1;
}

.baby-name {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 2px;
}

.baby-age {
  font-size: 12px;
  opacity: 0.85;
}

.edit-icon {
  font-size: 14px;
  opacity: 0.7;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 30px;
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
  width: 400px;
  max-width: 90%;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  font-size: 16px;
  color: #333;
}

.close-btn {
  font-size: 24px;
  color: #999;
  line-height: 1;
}

.close-btn:hover {
  color: #666;
}

.modal-body {
  padding: 20px;
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
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  border-color: #667eea;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #eee;
}

.btn {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
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
</style>
