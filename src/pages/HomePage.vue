<script setup lang="ts">
import { RouterLink } from 'vue-router'
import heroImageUrl from '../assets/hero-flow.png'

const categories = [
  { id: 'single', name: 'Ảnh Đơn Lẻ', icon: '🖼️', description: 'In một ảnh chất lượng cao tràn trang A4.' },
  { id: 'collage', name: 'Ghép Ảnh Collage', icon: '🎨', description: 'Tự do sắp xếp nhiều ảnh trên một trang theo ý bạn.' },
  { id: 'strips', name: 'Dải Ảnh Photo Strip', icon: '🎞️', description: 'Phong cách film cổ điển, tuyệt vời cho kỷ niệm.' },
  { id: 'id-photos', name: 'Ảnh Thẻ / Mini', icon: '🆔', description: 'In nhanh các loại ảnh thẻ hoặc ảnh cỡ nhỏ.' },
]

const features = [
  { title: 'Chọn hình từ điện thoại', description: 'Chỉ cần quét mã QR, chọn ảnh từ thư viện và bắt đầu sáng tạo.', icon: '📱' },
  { title: 'Tự xếp hình linh hoạt', description: 'Công cụ kéo thả thông minh, giúp bạn tự tay dàn dựng bố cục yêu thích.', icon: '✨' },
  { title: 'In ngay không chờ đợi', description: 'Quy trình hoàn toàn tự động, nhận ảnh ngay tại trạm chỉ sau vài giây.', icon: '⚡' },
]
</script>

<template>
  <div class="photobox-home">
    <!-- Hero Section -->
    <section class="hero">
      <div class="container hero-container">
        <div class="hero-text">
          <h1>In Ảnh Tự Động - Sáng Tạo Theo Cách Của Bạn</h1>
          <p class="hero-subtitle">Giải pháp in ảnh thông minh: Chọn hình từ điện thoại, tự xếp bố cục và in lấy ngay. Chỉ 20k cho một trang A4 đầy ắp kỷ niệm.</p>
          <div class="hero-actions">
            <RouterLink to="/tram1" class="btn btn-primary">Bắt đầu in ngay</RouterLink>
            <p class="hero-note">Không cần cài ứng dụng • Không cần chờ đợi</p>
          </div>
        </div>
        <div class="hero-visual">
          <img :src="heroImageUrl" alt="Quy trình in ảnh từ điện thoại" class="hero-img" />
        </div>
      </div>
    </section>

    <!-- Categories Section -->
    <section class="section categories-section">
      <div class="container">
        <h2 class="section-title">Bạn muốn in ảnh thế nào?</h2>
        <div class="category-grid">
          <RouterLink v-for="cat in categories" :key="cat.id" to="/tram1" class="category-card">
            <div class="category-icon">{{ cat.icon }}</div>
            <h3>{{ cat.name }}</h3>
            <p>{{ cat.description }}</p>
          </RouterLink>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="section features-section">
      <div class="container">
        <div class="features-grid">
          <div v-for="feat in features" :key="feat.title" class="feature-item">
            <div class="feature-icon">{{ feat.icon }}</div>
            <div class="feature-text">
              <h4>{{ feat.title }}</h4>
              <p>{{ feat.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing / Call to Action Section -->
    <section class="section cta-section">
      <div class="container">
        <div class="cta-banner">
          <div class="cta-text">
            <h2>Lưu giữ kỷ niệm, giá chỉ 20k/A4</h2>
            <p>Trải nghiệm dịch vụ in ảnh hiện đại nhất. Bạn toàn quyền quyết định bố cục trang in để tối ưu hóa kỷ niệm của mình.</p>
            <div class="cta-buttons">
              <RouterLink to="/tram1" class="btn btn-secondary">In ảnh ngay</RouterLink>
              <RouterLink to="/tram1" class="btn btn-outline-light">Xem mẫu collage</RouterLink>
            </div>
          </div>
          <div class="cta-image">
             <div class="mock-canvas">
                <div class="mock-photo p1"></div>
                <div class="mock-photo p2"></div>
                <div class="mock-photo p3"></div>
                <div class="mock-price-badge">20K</div>
             </div>
          </div>
        </div>
      </div>
    </section>

    <footer class="footer">
      <div class="container">
        <p>&copy; 2026 Photobox Việt Nam. Dịch vụ in ảnh tự động hàng đầu.</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.photobox-home {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #0e1318;
  background: #fff;
  min-height: 100vh;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.section {
  padding: 80px 0;
}

/* Hero Section */
.hero {
  background: linear-gradient(135deg, #7d2ae8 0%, #00c4cc 100%);
  padding: 60px 0 100px;
  color: white;
  overflow: hidden;
}

.hero-container {
  display: flex;
  align-items: center;
  gap: 40px;
}

.hero-text {
  flex: 1;
  z-index: 2;
}

.hero h1 {
  font-size: clamp(2.2rem, 5vw, 3.5rem);
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 24px;
  letter-spacing: -0.02em;
}

.hero-subtitle {
  font-size: 1.2rem;
  opacity: 0.9;
  margin-bottom: 40px;
  line-height: 1.5;
  max-width: 600px;
}

.hero-actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hero-note {
  font-size: 0.9rem;
  opacity: 0.7;
}

.hero-visual {
  flex: 1;
  display: flex;
  justify-content: center;
  position: relative;
}

.hero-img {
  width: 100%;
  max-width: 550px;
  height: auto;
  border-radius: 24px;
  box-shadow: 0 30px 60px rgba(0,0,0,0.3);
  transform: perspective(1000px) rotateY(-5deg);
}

.btn {
  display: inline-block;
  padding: 14px 32px;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
  cursor: pointer;
  text-align: center;
}

.btn:active {
  transform: scale(0.98);
}

.btn-primary {
  background: white;
  color: #7d2ae8;
  font-size: 1.1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  width: fit-content;
}

.btn-primary:hover {
  background: #f8f8f8;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
}

.btn-secondary {
  background: #7d2ae8;
  color: white;
}

.btn-outline-light {
  border: 1px solid white;
  color: white;
}

.btn-outline-light:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* Categories Section */
.section-title {
  font-size: 2.25rem;
  font-weight: 700;
  margin-bottom: 48px;
  text-align: center;
  letter-spacing: -0.01em;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 24px;
}

.category-card {
  background: #f9fbfd;
  padding: 40px 32px;
  border-radius: 28px;
  text-align: center;
  border: 1px solid transparent;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.category-card:hover {
  background: white;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.08);
  border-color: #e2e8f0;
  transform: translateY(-8px);
}

.category-icon {
  font-size: 3.5rem;
  margin-bottom: 20px;
}

.category-card h3 {
  font-size: 1.35rem;
  margin-bottom: 12px;
  font-weight: 700;
}

.category-card p {
  color: #596579;
  font-size: 1rem;
  line-height: 1.5;
}

/* Features Section */
.features-section {
  background: #fff;
  border-top: 1px solid #f0f0f0;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 48px;
}

.feature-item {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.feature-icon {
  font-size: 3rem;
  flex-shrink: 0;
}

.feature-text h4 {
  font-size: 1.25rem;
  margin-bottom: 10px;
  font-weight: 700;
}

.feature-text p {
  color: #596579;
  line-height: 1.6;
  font-size: 1.05rem;
}

/* CTA Section */
.cta-banner {
  background: #0e1318;
  border-radius: 40px;
  padding: 80px 60px;
  color: white;
  display: flex;
  align-items: center;
  gap: 60px;
  flex-wrap: wrap;
  overflow: hidden;
}

.cta-text {
  flex: 1.2;
  min-width: 300px;
}

.cta-text h2 {
  font-size: 2.75rem;
  margin-bottom: 24px;
  font-weight: 800;
}

.cta-text p {
  font-size: 1.15rem;
  opacity: 0.8;
  margin-bottom: 40px;
  max-width: 550px;
  line-height: 1.6;
}

.cta-buttons {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.cta-image {
  flex: 0.8;
  display: flex;
  justify-content: center;
}

.mock-canvas {
  width: 200px;
  height: 280px;
  background: white;
  border-radius: 4px;
  padding: 15px;
  position: relative;
  transform: rotate(3deg);
  box-shadow: 0 25px 50px rgba(0,0,0,0.5);
}

.mock-photo {
  background: #e2e8f0;
  border-radius: 2px;
  position: absolute;
}

.p1 { width: 170px; height: 120px; top: 15px; left: 15px; }
.p2 { width: 80px; height: 110px; bottom: 15px; left: 15px; }
.p3 { width: 80px; height: 110px; bottom: 15px; right: 15px; }

.mock-price-badge {
  position: absolute;
  top: -15px;
  right: -15px;
  background: #00c4cc;
  color: white;
  font-weight: 900;
  padding: 10px 15px;
  border-radius: 50%;
  box-shadow: 0 10px 20px rgba(0,0,0,0.2);
  transform: rotate(15deg);
  font-size: 1.2rem;
}

.footer {
  padding: 60px 0;
  text-align: center;
  border-top: 1px solid #f0f0f0;
  color: #596579;
}

@media (max-width: 992px) {
  .hero-container { flex-direction: column; text-align: center; }
  .hero-actions { align-items: center; }
  .hero h1 { font-size: 2.75rem; }
  .cta-banner { padding: 60px 30px; }
  .cta-image { margin-top: 40px; }
}

@media (max-width: 640px) {
  .section { padding: 60px 0; }
  .cta-text h2 { font-size: 2rem; }
  .cta-buttons { flex-direction: column; }
  .btn { width: 100%; }
}
</style>
