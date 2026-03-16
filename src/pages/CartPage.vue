<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getPublicPrintJob } from '../lib/api'
import type { PrintJobSummary } from '../../shared/contracts'

const router = useRouter()
const orders = ref<PrintJobSummary[]>([])
const loading = ref(true)
const selectedOrder = ref<PrintJobSummary | null>(null)
const showPaymentModal = ref(false)

async function loadOrders() {
  loading.value = true
  const existingRaw = localStorage.getItem('photobox_invoices')
  let invoiceIds: any[] = existingRaw ? JSON.parse(existingRaw) : []

  // Migration from old single-order key
  const oldKey = localStorage.getItem('photobox_last_invoice')
  if (oldKey && invoiceIds.length === 0) {
    try {
      const oldInfo = JSON.parse(oldKey)
      if (oldInfo.jobId) {
        invoiceIds = [oldInfo]
        localStorage.setItem('photobox_invoices', JSON.stringify(invoiceIds))
        localStorage.removeItem('photobox_last_invoice')
      }
    } catch (e) {}
  }

  const fetchedOrders: PrintJobSummary[] = []
  const validInvoiceIds: any[] = []
  let needsUpdate = false

  for (const item of invoiceIds) {
    try {
      const res = await getPublicPrintJob(item.jobId)
      fetchedOrders.push(res.job)
      validInvoiceIds.push(item)
    } catch (err) {
      console.error(`Failed to fetch order ${item.jobId}, removing:`, err)
      needsUpdate = true
    }
  }

  if (needsUpdate) {
    localStorage.setItem('photobox_invoices', JSON.stringify(validInvoiceIds))
  }

  // Sort by date descending
  orders.value = fetchedOrders.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  loading.value = false
}

function handlePay(order: PrintJobSummary) {
  selectedOrder.value = order
  showPaymentModal.value = true
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
}

function formatDate(value: string) {
  // SQLite CURRENT_TIMESTAMP is 'YYYY-MM-DD HH:MM:SS' in UTC
  // We append ' UTC' to ensure JS parses it as UTC
  const dateStr = value.includes(' ') && !value.includes('Z') && !value.includes('+') ? `${value} UTC` : value
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(dateStr))
}

function formatRelativeTime(value: string) {
  const dateStr = value.includes(' ') && !value.includes('Z') && !value.includes('+') ? `${value} UTC` : value
  const date = new Date(dateStr)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'Vừa xong'

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return `${diffInMinutes} phút trước`

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours} giờ trước`

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays} ngày trước`

  return formatDate(value)
}

onMounted(() => {
  loadOrders()
})
</script>

<template>
  <div class="cart-page">
    <div class="container">
      <header class="page-header">
        <button @click="router.back()" class="btn-back">← Quay lại</button>
        <h1>Giỏ hàng của bạn</h1>
      </header>

      <div class="cart-content card">
        <div v-if="loading" class="loading-state">
          Đang tải danh sách đơn hàng...
        </div>
        <div v-else-if="orders.length === 0" class="empty-state">
          <p>Bạn chưa có đơn hàng nào.</p>
          <button @click="router.push('/')" class="btn-primary">Quay lại trang chủ</button>
        </div>
        <div v-else class="table-container">
          <table class="orders-table">
            <thead>
              <tr>
                <th class="col-job">Job & Station</th>
                <th class="col-pages">Số tờ</th>
                <th class="col-quantity">Số lượng</th>
                <th class="col-amount">Số tiền</th>
                <th class="col-date">Ngày</th>
                <th class="col-status">Trạng thái</th>
                <th class="col-actions">hành động</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in orders" :key="order.id">
                <td class="col-job">
                  <div class="job-id">{{ order.jobCode }}</div>
                  <div class="station-slug">{{ order.stationSlug }}</div>
                </td>
                <td class="col-pages">
                  {{ order.pageCount ?? 0 }}
                </td>
                <td class="col-quantity">
                  {{ order.quantity }}
                </td>
                <td class="col-amount">{{ formatCurrency(order.totalAmount) }}</td>
                <td class="col-date">
                  <span class="relative-time">{{ formatRelativeTime(order.createdAt) }}</span>
                </td>
                <td class="col-status">
                  <span class="status-badge" :class="order.status.toLowerCase()">
                    {{ order.status.toUpperCase() }}
                  </span>
                </td>
                <td class="col-actions">
                  <div class="actions">
                    <button
                      v-if="order.status === 'draft'"
                      class="btn-action btn-pay"
                      @click="handlePay(order)"
                    >
                      Thanh Toán
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Payment Modal (Reused Logic) -->
    <div v-if="showPaymentModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2>Quét mã QR để thanh toán</h2>
          <button @click="showPaymentModal = false" class="btn-close-modal">×</button>
        </div>
        <div class="modal-body">
          <div class="qr-placeholder border-accent">
            <div class="qr-mock">
               <div class="qr-inner">QR</div>
            </div>
            <p>Mã QR giả lập ( Fake QR )</p>
          </div>
          <div class="payment-info">
            <p>Số tiền: <strong>{{ formatCurrency(selectedOrder?.totalAmount || 0) }}</strong></p>
            <p>Nội dung: <strong>PHOTOBOX {{ selectedOrder?.stationSlug }}</strong></p>
          </div>

        </div>
        <div class="modal-footer">
          <button @click="showPaymentModal = false" class="btn-secondary">Đóng</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cart-page {
  min-height: 100vh;
  background: #f8fafc;
  padding: 40px 0;
  font-family: 'Inter', sans-serif;
}

.container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 20px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 30px;
}

.btn-back {
  background: none;
  border: none;
  color: #64748b;
  font-weight: 600;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 6px;
  transition: background 0.2s;
}

.btn-back:hover {
  background: #e2e8f0;
}

h1 {
  font-size: 24px;
  font-weight: 800;
  color: #1e293b;
  margin: 0;
}

.card {
  background: white;
  border-radius: 16px;
  padding: 0;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  overflow: hidden;
}

.table-container {
  overflow-x: auto;
}

.orders-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.orders-table th {
  background: #f1f5f9;
  padding: 16px 12px;
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.orders-table td {
  padding: 16px 12px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.col-job { width: 1.5fr; }
.col-pages { width: 0.7fr; }
.col-quantity { width: 0.7fr; }
.col-amount { width: 1.2fr; }
.col-date { width: 1.2fr; }
.col-status { width: 1fr; }
.col-actions { width: 1.2fr; }

.job-id {
  font-weight: 800;
  color: #1e293b;
  font-size: 15px;
}

.station-slug {
  font-size: 13px;
  color: #64748b;
  margin-top: 4px;
}

.status-badge {
  display: inline-flex;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.status-badge.draft { background: rgba(100, 116, 139, 0.12); color: #475569; }
.status-badge.pending { background: rgba(204, 143, 88, 0.14); color: #c58d5b; }
.status-badge.printed { background: rgba(57, 161, 105, 0.12); color: #2f7e54; }
.status-badge.cancelled { background: rgba(177, 84, 84, 0.12); color: #9c4b4b; }

.actions {
  display: flex;
  gap: 10px;
}

.btn-action {
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-pay {
  background: #c58d5b;
  color: white;
}

.btn-pay:hover {
  background: #b07d4e;
  transform: translateY(-1px);
}

.btn-delete {
  background: #e2e8f0;
  color: #475569;
}

.btn-delete:hover:not(:disabled) {
  background: #cbd5e1;
}

.btn-delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-state, .empty-state {
  padding: 60px;
  text-align: center;
  color: #64748b;
}

.btn-primary {
  margin-top: 16px;
  background: #7d2ae8;
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

/* Modal REUSED */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 20px;
  width: 100%;
  max-width: 450px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.modal-header {
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f1f5f9;
}

.btn-close-modal {
  background: none;
  border: none;
  font-size: 28px;
  color: #94a3b8;
  cursor: pointer;
}

.modal-body {
  padding: 30px 24px;
  text-align: center;
}

.qr-mock {
  width: 180px;
  height: 180px;
  background: #f8fafc;
  border: 4px solid #c58d5b;
  border-radius: 12px;
  margin: 0 auto 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-inner {
  font-size: 40px;
  font-weight: 900;
  color: #c58d5b;
  opacity: 0.2;
}

.payment-info {
  background: #f8fafc;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 20px;
}

.success-state {
  color: #059669;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #f1f5f9;
  text-align: right;
  background: #f8fafc;
}

.btn-secondary {
  padding: 10px 20px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
</style>
