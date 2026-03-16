<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useCollageStore } from '../modules/collage/store'
import { createPrintJob } from '../lib/api'
import { addRecipientTextToPdf } from '../lib/export/shared'

const router = useRouter()
const store = useCollageStore()
const { pendingPrint } = storeToRefs(store)

const quantity = ref(1)
const pricePerPage = 20000
const isProcessing = ref(false)
const showPaymentModal = ref(false)
const error = ref<string | null>(null)
const pdfUrl = ref<string | null>(null)
const customerName = ref('')
const customerCode = ref(Math.floor(1000 + Math.random() * 9000).toString())

const recipientText = computed(() => {
  if (!customerName.value && !customerCode.value) return ''
  return `${customerName.value} ${customerCode.value}`.trim()
})

const totalAmount = computed(() => {
  if (!pendingPrint.value) return 0
  return pendingPrint.value.pageCount * quantity.value * pricePerPage
})

onMounted(() => {
  if (!pendingPrint.value) {
    router.push('/')
    return
  }
  pdfUrl.value = URL.createObjectURL(pendingPrint.value.blob)
})

watch(recipientText, async (text: string) => {
  if (!pendingPrint.value) return

  if (pdfUrl.value) {
    URL.revokeObjectURL(pdfUrl.value)
  }

  if (!text) {
    pdfUrl.value = URL.createObjectURL(pendingPrint.value.blob)
    return
  }

  try {
    const newBlob = await addRecipientTextToPdf(pendingPrint.value.blob, text)
    pdfUrl.value = URL.createObjectURL(newBlob)
  } catch (err) {
    console.error('Failed to overlay text:', err)
    pdfUrl.value = URL.createObjectURL(pendingPrint.value.blob)
  }
})

const handlePayment = async () => {
  if (!pendingPrint.value) return

  isProcessing.value = true
  showPaymentModal.value = true
  error.value = null

  try {
    let finalBlob = pendingPrint.value.blob
    if (recipientText.value) {
      finalBlob = await addRecipientTextToPdf(finalBlob, recipientText.value)
    }

    // Save to backend as draft
    const response = await createPrintJob(
      {
        stationSlug: pendingPrint.value.stationSlug,
        templateId: pendingPrint.value.templateId,
        slotCount: pendingPrint.value.slotCount,
        totalAmount: totalAmount.value,
        status: 'draft',
        pageCount: pendingPrint.value.pageCount,
        pricePerPage: pricePerPage,
      },
      finalBlob
    )

    // Save to local storage
    const invoiceInfo = {
      jobId: response.job.id,
      jobCode: response.job.jobCode,
      totalAmount: totalAmount.value,
      pageCount: pendingPrint.value.pageCount,
      quantity: quantity.value,
      timestamp: new Date().toISOString(),
    }
    localStorage.setItem('photobox_last_invoice', JSON.stringify(invoiceInfo))

  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Có lỗi xảy ra khi tạo hóa đơn.'
  } finally {
    isProcessing.value = false
  }
}

const closePaymentModal = () => {
  showPaymentModal.value = false
  // Optional: redirect or stay on page
  // router.push('/')
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
}
</script>

<template>
  <div class="invoice-page">
    <div class="container">
      <header class="page-header">
        <button @click="router.back()" class="btn-back">← Quay lại</button>
        <h1>Xác nhận in ảnh</h1>
      </header>

      <div class="invoice-content">
        <div class="preview-section">
          <div class="card">
            <h2>Kết quả in (PDF)</h2>
            <div class="pdf-container">
              <iframe v-if="pdfUrl" :src="pdfUrl" class="pdf-viewer"></iframe>
              <div v-else class="loading-pdf">Đang tải bản xem trước...</div>
            </div>
          </div>
        </div>

        <div class="details-section">
          <div class="card details-card">
            <h2>Chi tiết hóa đơn</h2>

            <div class="info-grid">
              <div class="info-row">
                <span class="label">Số trang:</span>
                <span class="value">{{ pendingPrint?.pageCount || 0 }} trang A4</span>
              </div>
              <div class="info-row">
                <span class="label">Đơn giá:</span>
                <span class="value">{{ formatCurrency(pricePerPage) }}/trang</span>
              </div>
              <div class="info-row quantity-row">
                <span class="label">Số lượng bản in:</span>
                <div class="quantity-picker">
                  <button @click="quantity > 1 && quantity--" :disabled="quantity <= 1">-</button>
                  <input type="number" v-model.number="quantity" min="1" />
                  <button @click="quantity++">+</button>
                </div>
              </div>
            </div>

            <div class="divider"></div>

            <div class="total-row">
              <span class="total-label">Tổng cộng:</span>
              <span class="total-value">{{ formatCurrency(totalAmount) }}</span>
            </div>

            <button
              class="btn-pay"
              @click="handlePayment"
              :disabled="isProcessing || !pendingPrint"
            >
              {{ isProcessing ? 'Đang xử lý...' : 'Thanh toán ngay' }}
            </button>

            <p v-if="error" class="error-msg">{{ error }}</p>
          </div>

          <div class="card name-card">
            <h2>Thông tin nhận hàng</h2>
            <div class="input-grid-form">
              <div class="input-group">
                <label for="customer-name">Tên bạn</label>
                <input
                  id="customer-name"
                  type="text"
                  v-model="customerName"
                  placeholder="Ví dụ: mai anh"
                  class="form-input"
                />
              </div>
              <div class="input-group">
                <label for="customer-code">4 số cuối điện thoại</label>
                <input
                  id="customer-code"
                  type="text"
                  v-model="customerCode"
                  placeholder="Ví dụ: 5436"
                  maxlength="4"
                  class="form-input"
                />
              </div>
            </div>
            <p class="input-note" v-if="recipientText">Dòng chữ sẽ in: <strong>{{ recipientText }}</strong></p>
          </div>

          <div class="note-card card">
            <h3>Lưu ý</h3>
            <p>Sau khi thanh toán, ảnh của bạn sẽ được gửi đến máy in. Vui lòng nhận ảnh tại trạm in.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Payment Modal -->
    <div v-if="showPaymentModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2>Quét mã QR để thanh toán</h2>
          <button @click="closePaymentModal" class="btn-close-modal">×</button>
        </div>
        <div class="modal-body">
          <div class="qr-placeholder">
            <div class="qr-mock">
               <div class="qr-inner">QR</div>
            </div>
            <p>Mã QR giả lập ( Fake QR )</p>
          </div>
          <div class="payment-info">
            <p>Số tiền: <strong>{{ formatCurrency(totalAmount) }}</strong></p>
            <p>Nội dung: <strong>PHOTOBOX {{ pendingPrint?.stationSlug }}</strong></p>
          </div>
          <div v-if="isProcessing" class="loading-state">
             Đang khởi tạo giao dịch...
          </div>
          <div v-else class="success-state">
             <span class="icon">✅</span>
             <p>Đã ghi nhận yêu cầu in (Draft). Hệ thống đang chờ thanh toán thực tế.</p>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closePaymentModal" class="btn-secondary">Đóng</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.invoice-page {
  min-height: 100vh;
  background: #f4f7f9;
  padding: 40px 0;
  font-family: 'Inter', sans-serif;
}

.container {
  max-width: 1000px;
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

.invoice-content {
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 30px;
}

.card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  margin-bottom: 24px;
}

h2 {
  font-size: 18px;
  font-weight: 700;
  margin-top: 0;
  margin-bottom: 20px;
  color: #334155;
}

.pdf-container {
  aspect-ratio: 1 / 1.414;
  background: #f1f5f9;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.pdf-viewer {
  width: 100%;
  height: 100%;
  border: none;
}

.loading-pdf {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.label {
  color: #64748b;
  font-size: 14px;
}

.value {
  font-weight: 600;
  color: #1e293b;
}

.quantity-picker {
  display: flex;
  align-items: center;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.quantity-picker button {
  width: 32px;
  height: 32px;
  background: #f8fafc;
  border: none;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.quantity-picker button:hover:not(:disabled) {
  background: #e2e8f0;
}

.quantity-picker input {
  width: 50px;
  border: none;
  border-left: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  text-align: center;
  font-weight: 600;
  padding: 4px;
}

.divider {
  height: 1px;
  background: #e2e8f0;
  margin: 24px 0;
}

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.total-label {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}

.total-value {
  font-size: 22px;
  font-weight: 800;
  color: #7d2ae8;
}

.btn-pay {
  width: 100%;
  padding: 14px;
  background: #7d2ae8;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s, background 0.2s;
}

.btn-pay:hover:not(:disabled) {
  background: #6b21c1;
  transform: translateY(-2px);
}

.btn-pay:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-msg {
  color: #ef4444;
  font-size: 14px;
  margin-top: 12px;
  text-align: center;
}

.note-card h3 {
  font-size: 14px;
  margin-top: 0;
  margin-bottom: 8px;
  color: #475569;
}

.note-card p {
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
  margin: 0;
}

/* Modal Styles */
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
  padding: 0;
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

.modal-header h2 {
  margin: 0;
  font-size: 18px;
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

.qr-placeholder {
  margin-bottom: 24px;
}

.qr-mock {
  width: 200px;
  height: 200px;
  background: #f8fafc;
  border: 4px solid #7d2ae8;
  border-radius: 12px;
  margin: 0 auto 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.qr-inner {
  font-size: 40px;
  font-weight: 900;
  color: #7d2ae8;
  opacity: 0.2;
}

.payment-info {
  background: #f8fafc;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 24px;
}

.payment-info p {
  margin: 8px 0;
  color: #475569;
}

.success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #059669;
}

.success-state .icon {
  font-size: 40px;
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
  color: #475569;
  cursor: pointer;
}

.name-card {
  margin-top: 0;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  font-size: 14px;
  color: #64748b;
  font-weight: 600;
}

.form-input {
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.2s;
  width: 100%;
  box-sizing: border-box;
}

.input-grid-form {
  display: grid;
  grid-template-columns: 1fr 120px;
  gap: 16px;
  margin-bottom: 12px;
}

@media (max-width: 480px) {
  .input-grid-form {
    grid-template-columns: 1fr;
  }
}

.form-input:focus {
  outline: none;
  border-color: #7d2ae8;
  box-shadow: 0 0 0 3px rgba(125, 42, 232, 0.1);
}

.input-note {
  font-size: 13px;
  color: #64748b;
  margin: 4px 0 0;
}

@media (max-width: 768px) {
  .invoice-content {
    grid-template-columns: 1fr;
  }
}
</style>
