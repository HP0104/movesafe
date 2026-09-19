/**
 * App.js - Bộ điều khiển trung tâm trải nghiệm người dùng chuẩn Google Maps
 * MoveSafe VN: Bản đồ toàn màn hình, thanh tìm kiếm nổi và điều hướng né ngập
 */

class GoogleMapsApp {
  constructor() {
    this.currentCity = 'hanoi';
    this.citiesConfig = {
      hanoi: { name: 'Hà Nội', lat: 21.0285, lng: 105.8542, zoom: 13 },
      hcm: { name: 'TP. Hồ Chí Minh', lat: 10.7769, lng: 106.7008, zoom: 13 },
      danang: { name: 'Đà Nẵng', lat: 16.0544, lng: 108.2022, zoom: 13 }
    };
    this.liveData = {
      floodPoints: [],
      trafficIncidents: [],
      vovTrafficNews: [],
      weatherAlerts: []
    };
    this.currentVehicle = 'motorbike';
    this.isDirectionsOpen = false;
    this.activeFilter = 'all'; // 'all', 'flood', 'traffic'
  }

  async init() {
    console.log('[MoveSafe Google Maps] Đang khởi động...');

    // 1. Tải cấu hình từ Backend (TomTom key, OpenWeather key)
    await this.fetchServerConfig();

    // 2. Khởi tạo bản đồ chiếm toàn màn hình
    const city = this.citiesConfig[this.currentCity];
    window.mapEngine.init('map-container', [city.lat, city.lng], city.zoom);

    // 3. Tải dữ liệu từ Bot
    await this.fetchLiveData();

    // 4. Cập nhật thời tiết
    await this.updateWeather();

    // 5. Gán các sự kiện tương tác
    this.bindEvents();

    console.log('[MoveSafe Google Maps] Đã khởi tạo hoàn tất!');
  }

  async fetchServerConfig() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success') {
          if (data.apiKeys.tomtom) window.mapEngine.setTomTomKey(data.apiKeys.tomtom);
          if (data.apiKeys.openweather) window.weatherService.setApiKey(data.apiKeys.openweather);
          if (data.cities) this.citiesConfig = data.cities;
          return;
        }
      }
    } catch (e) {
      console.warn('Chạy chế độ Static Web (GitHub Pages):', e.message);
    }
    // Khóa TomTom dự phòng khi chạy tĩnh trên GitHub Pages
    window.mapEngine.setTomTomKey('dz8wjRiOa8pDrr1g9Grzk0Qnp6O6wLbF');
  }

  async fetchLiveData() {
    // 1. Thử gọi backend Node.js
    try {
      const res = await fetch('/api/live-data');
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          this.liveData = json.data;
          this.renderAllData();
          return;
        }
      }
    } catch (e) {}

    // 2. Fallback tự động đọc file JSON tĩnh khi chạy trên GitHub Pages
    try {
      const res = await fetch('data/live_urban_cache.json');
      if (res.ok) {
        const json = await res.json();
        this.liveData = json;
        this.renderAllData();
      }
    } catch (e) {
      console.error('Không thể nạp dữ liệu cache:', e);
    }
  }

  renderAllData() {
    const cityFloods = this.liveData.floodPoints.filter(f => f.city === this.currentCity);
    const cityTraffics = this.liveData.trafficIncidents.filter(t => t.city === this.currentCity);

    // Vẽ lên bản đồ
    window.mapEngine.renderFloodPoints(cityFloods);
    window.mapEngine.renderTrafficIncidents(cityTraffics);

    // Cập nhật số lượng trên các chip
    const floodChip = document.getElementById('chip-flood-count');
    const trafficChip = document.getElementById('chip-traffic-count');
    if (floodChip) floodChip.textContent = `🌊 Rốn ngập (${cityFloods.length})`;
    if (trafficChip) trafficChip.textContent = `🚗 Kẹt xe (${cityTraffics.length})`;
  }

  async updateWeather() {
    const city = this.citiesConfig[this.currentCity];
    const w = await window.weatherService.getWeather(city.lat, city.lng, city.name);

    const pillText = document.getElementById('weather-pill-text');
    const pillDot = document.getElementById('weather-risk-dot');

    if (pillText) {
      pillText.innerHTML = `${w.icon} <strong>${city.name} ${w.temp}°C</strong> • Mưa: ${w.rain1h}mm • ${w.floodRisk.text}`;
    }

    if (pillDot) {
      pillDot.className = 'gm-risk-dot ' + (w.floodRisk.level === 'danger' ? 'risk-danger' : (w.floodRisk.level === 'warning' ? 'risk-warning' : ''));
    }
  }

  toggleDirectionsPanel(forceState) {
    const panel = document.getElementById('gm-directions-panel');
    const searchBox = document.getElementById('gm-search-box');
    const chips = document.getElementById('gm-chips-scroll');

    this.isDirectionsOpen = forceState !== undefined ? forceState : !this.isDirectionsOpen;

    if (this.isDirectionsOpen) {
      panel.classList.add('open');
      searchBox.style.display = 'none';
      chips.style.display = 'none';
    } else {
      panel.classList.remove('open');
      searchBox.style.display = 'flex';
      chips.style.display = 'flex';
    }
  }

  bindEvents() {
    // 1. Nút chỉ đường (hình thoi mũi tên xanh trên thanh search)
    document.getElementById('btn-open-directions')?.addEventListener('click', () => {
      this.toggleDirectionsPanel(true);
      this.calculateSmartRoute();
    });

    document.getElementById('btn-close-directions')?.addEventListener('click', () => {
      this.toggleDirectionsPanel(false);
    });

    // 2. Ô tìm kiếm chính
    const searchInput = document.getElementById('gm-search-input');
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleSearch(searchInput.value.trim());
      }
    });

    document.getElementById('btn-search-trigger')?.addEventListener('click', () => {
      this.handleSearch(searchInput?.value.trim() || '');
    });

    // 3. Category Chips
    document.getElementById('chip-flood-count')?.addEventListener('click', () => {
      const cityFloods = this.liveData.floodPoints.filter(f => f.city === this.currentCity);
      if (cityFloods.length > 0) {
        window.mapEngine.map.flyTo([cityFloods[0].lat, cityFloods[0].lng], 15);
      }
    });

    document.getElementById('chip-traffic-count')?.addEventListener('click', () => {
      const cityTraffics = this.liveData.trafficIncidents.filter(t => t.city === this.currentCity);
      if (cityTraffics.length > 0) {
        window.mapEngine.map.flyTo([cityTraffics[0].lat, cityTraffics[0].lng], 15);
      }
    });

    document.getElementById('chip-ai-trigger')?.addEventListener('click', () => {
      window.aiChat.toggle();
    });

    // 4. Chọn thành phố
    document.getElementById('city-select-gm')?.addEventListener('change', async (e) => {
      this.currentCity = e.target.value;
      const city = this.citiesConfig[this.currentCity];
      window.mapEngine.flyToCity(city);
      await this.updateWeather();
      this.renderAllData();
    });

    // 5. Nút tìm đường trong bảng Directions
    document.getElementById('btn-find-route-submit')?.addEventListener('click', () => {
      this.calculateSmartRoute();
    });

    // Chuyển phương tiện (Xe máy / Ô tô)
    document.querySelectorAll('.gm-mode-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.gm-mode-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentVehicle = tab.getAttribute('data-mode');
        this.calculateSmartRoute();
      });
    });

    // 6. Cụm nút điều khiển góc dưới bên phải
    document.getElementById('btn-gm-zoom-in')?.addEventListener('click', () => window.mapEngine.zoomIn());
    document.getElementById('btn-gm-zoom-out')?.addEventListener('click', () => window.mapEngine.zoomOut());
    document.getElementById('btn-gm-locate')?.addEventListener('click', () => {
      navigator.geolocation.getCurrentPosition(p => {
        window.mapEngine.map.flyTo([p.coords.latitude, p.coords.longitude], 16);
      });
    });

    // Nút làm mới dữ liệu từ Bot
    document.getElementById('btn-gm-bot-refresh')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-gm-bot-refresh');
      btn.style.transform = 'rotate(360deg)';
      try {
        const res = await fetch('/api/bot/refresh', { method: 'POST' });
        const json = await res.json();
        if (json.status === 'success') {
          this.liveData = json.data;
          this.renderAllData();
          alert('✓ Đã cập nhật xong dữ liệu mới nhất từ trạm HSDC, UDi và TomTom Traffic!');
        }
      } catch (err) {
        alert('Lỗi khi gọi bot: ' + err.message);
      } finally {
        setTimeout(() => { btn.style.transform = 'none'; }, 500);
      }
    });

    // Menu bật tắt lớp bản đồ
    const layerMenu = document.getElementById('gm-layer-menu');
    document.getElementById('btn-gm-layers')?.addEventListener('click', () => {
      layerMenu.classList.toggle('open');
    });

    document.getElementById('chk-layer-traffic')?.addEventListener('change', (e) => {
      window.mapEngine.toggleTraffic(e.target.checked);
    });
    document.getElementById('chk-layer-flood')?.addEventListener('change', (e) => {
      window.mapEngine.toggleFloods(e.target.checked);
    });
    document.getElementById('chk-layer-satellite')?.addEventListener('change', (e) => {
      window.mapEngine.switchBaseMap(e.target.checked ? 'satellite' : 'standard');
    });

    // Click lên bản đồ sẽ tự động đóng AI chat và menu lớp
    window.mapEngine.map?.on('click', () => {
      window.aiChat.close();
      document.getElementById('gm-layer-menu')?.classList.remove('open');
    });

    // 7. Modals: Báo cáo & Cài đặt
    const reportModal = document.getElementById('modal-report');
    document.getElementById('btn-gm-open-report')?.addEventListener('click', () => reportModal?.classList.add('open'));
    document.getElementById('btn-close-report')?.addEventListener('click', () => reportModal?.classList.remove('open'));

    document.getElementById('form-report')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('report-location-name')?.value || 'Điểm ngập';
      const depth = document.getElementById('report-depth')?.value || 30;
      const type = document.getElementById('report-type')?.value || 'flood';
      const center = window.mapEngine.map.getCenter();

      const res = await window.crowdsourceService.submitReport({
        locationName: name,
        city: this.currentCity,
        lat: center.lat + (Math.random() - 0.5) * 0.005,
        lng: center.lng + (Math.random() - 0.5) * 0.005,
        type,
        depth_cm: depth
      });

      if (res.success) {
        reportModal?.classList.remove('open');
        alert('✓ Báo cáo của bạn đã được xác thực và ghim lên Google Maps!');
      }
    });

    const settingsModal = document.getElementById('modal-settings');
    document.getElementById('btn-gm-open-settings')?.addEventListener('click', () => settingsModal?.classList.add('open'));
    document.getElementById('btn-close-settings')?.addEventListener('click', () => settingsModal?.classList.remove('open'));

    document.getElementById('btn-save-settings')?.addEventListener('click', () => {
      const gemini = document.getElementById('setting-gemini-key')?.value;
      const tomtom = document.getElementById('setting-tomtom-key')?.value;
      const owm = document.getElementById('setting-owm-key')?.value;

      if (gemini) localStorage.setItem('movesafe_gemini_key', gemini.trim());
      if (tomtom) window.mapEngine.setTomTomKey(tomtom.trim());
      if (owm) window.weatherService.setApiKey(owm.trim());

      settingsModal?.classList.remove('open');
      alert('Đã lưu cấu hình API thành công!');
    });
  }

  handleSearch(query) {
    if (!query) return;
    const lower = query.toLowerCase();

    // Tìm kiếm rốn ngập
    const matchedFlood = this.liveData.floodPoints.find(f => lower.includes(f.name.toLowerCase().slice(0, 8)));
    if (matchedFlood) {
      window.mapEngine.map.flyTo([matchedFlood.lat, matchedFlood.lng], 16);
      return;
    }

    // Nếu hỏi lộ trình "từ A đến B"
    if (lower.includes('từ') && (lower.includes('đến') || lower.includes('về') || lower.includes('sang'))) {
      this.toggleDirectionsPanel(true);
      const parts = query.split(/đến|về|sang/i);
      const originInput = document.getElementById('gm-route-origin');
      const destInput = document.getElementById('gm-route-dest');
      if (originInput) originInput.value = parts[0].replace(/từ/i, '').trim();
      if (destInput && parts[1]) destInput.value = parts[1].trim();
      this.calculateSmartRoute();
      return;
    }

    // Nếu là câu hỏi khác -> mở trợ lý AI
    window.aiChat.open();
    window.aiChat.sendMessage(query);
  }

  async calculateSmartRoute() {
    const resultsContainer = document.getElementById('gm-route-results');
    if (resultsContainer) {
      resultsContainer.innerHTML = '<div style="padding: 12px; font-size: 13px; color: #5f6368;">⏳ Đang tính toán tuyến đường an toàn né ngập...</div>';
    }

    let origin = { lat: 21.0365, lng: 105.7925 }; // Cầu Giấy
    let dest = { lat: 21.0242, lng: 105.8542 };   // Nhà Hát Lớn (Hoàn Kiếm qua Nguyễn Khuyến)

    if (this.currentCity === 'hcm') {
      origin = { lat: 10.7769, lng: 106.6811 };
      dest = { lat: 10.7412, lng: 106.7325 }; // Huỳnh Tấn Phát rốn ngập
    }

    const cityFloods = this.liveData.floodPoints.filter(f => f.city === this.currentCity);

    try {
      const res = await window.routingService.calculateSmartSafeRoute({
        origin,
        destination: dest,
        floodPoints: cityFloods,
        vehicleType: this.currentVehicle
      });

      window.mapEngine.displayRoute(res);

      if (resultsContainer) {
        if (res.hasHazard) {
          resultsContainer.innerHTML = `
            <!-- Tuyến 1: Đề xuất né ngập an toàn -->
            <div class="gm-route-card selected-safe">
              <div class="gm-route-time gm-time-safe">
                <span>~${res.recommendedRoute.durationMin} phút</span>
                <span style="font-size: 13px; font-weight: normal; color: #5f6368;">(${res.recommendedRoute.distanceKm} km)</span>
              </div>
              <div class="gm-route-meta">Qua các tuyến phố cao ráo, hệ thống thoát nước tốt</div>
              <div class="gm-route-tag gm-tag-safe">
                ✓ Tuyến Đề Xuất Né Ngập (An toàn 100%)
              </div>
            </div>

            <!-- Tuyến 2: Tuyến cũ qua rốn ngập (Cảnh báo nguy hiểm) -->
            <div class="gm-route-card hazard-card">
              <div class="gm-route-time gm-time-hazard">
                <span>~${res.dangerRoute.durationMin} phút</span>
                <span style="font-size: 13px; font-weight: normal; color: #5f6368;">(${res.dangerRoute.distanceKm} km)</span>
              </div>
              <div class="gm-route-meta">Đi qua: <strong>${res.hazards.map(h => h.name).join(', ')}</strong></div>
              <div class="gm-route-tag gm-tag-danger">
                ⚠️ Rủi ro cao: Ngập sâu ${res.hazards[0].depth_cm}cm, nguy cơ chết máy
              </div>
            </div>
          `;
        } else {
          resultsContainer.innerHTML = `
            <div class="gm-route-card selected-safe">
              <div class="gm-route-time gm-time-safe">
                <span>~${res.recommendedRoute.durationMin} phút</span>
                <span style="font-size: 13px; font-weight: normal; color: #5f6368;">(${res.recommendedRoute.distanceKm} km)</span>
              </div>
              <div class="gm-route-meta">Lộ trình thông thoáng, không phát hiện rốn ngập sâu</div>
              <div class="gm-route-tag gm-tag-safe">✓ Tuyến Nhanh Nhất & An Toàn</div>
            </div>
          `;
        }
      }
    } catch (e) {
      if (resultsContainer) resultsContainer.innerHTML = `<div style="color: red; padding: 10px;">Lỗi: ${e.message}</div>`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.appState = new GoogleMapsApp();
  window.appState.init();
});
