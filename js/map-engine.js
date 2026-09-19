/**
 * MapEngine - Trình điều khiển bản đồ giao diện chuẩn Google Maps
 * Nền bản đồ sáng, trực quan, dễ nhìn, hỗ trợ TomTom Traffic Flow và Cảnh báo ngập
 */

class MapEngine {
  constructor() {
    this.map = null;
    this.tomtomKey = '';
    this.layers = {
      baseStandard: null,
      baseSatellite: null,
      tomtomTraffic: null,
      floodMarkers: null,
      trafficMarkers: null,
      routeSafeOutline: null,
      routeSafe: null,
      routeDanger: null
    };
    this.currentBase = 'standard';
  }

  init(containerId = 'map-container', initialCoords = [21.0285, 105.8542], zoom = 13) {
    if (this.map) return;

    this.map = L.map(containerId, {
      center: initialCoords,
      zoom: zoom,
      zoomControl: false, // Ẩn zoom mặc định của Leaflet để dùng cụm nút chuẩn Google Maps
      attributionControl: false // Tắt dòng chữ bản quyền Leaflet ở góc bản đồ
    });

    // Lớp bản đồ tiêu chuẩn: Google Maps chuẩn (Sạch sẽ 100%, không bị watermark API KEY REQUIRED)
    this.layers.baseStandard = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(this.map);

    // Lớp vệ tinh Google Maps Hybrid (Ảnh vệ tinh có tên đường)
    this.layers.baseSatellite = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    });

    // Lớp TomTom Traffic Flow (Vệt giao thông thời gian thực xanh/vàng/đỏ)
    this.layers.tomtomTraffic = L.tileLayer(
      `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${this.tomtomKey}`,
      { maxZoom: 19, opacity: 0.82 }
    ).addTo(this.map);

    // Nhóm layer rốn ngập & kẹt xe
    this.layers.floodMarkers = L.layerGroup().addTo(this.map);
    this.layers.trafficMarkers = L.layerGroup().addTo(this.map);
  }

  setTomTomKey(key) {
    if (key && key.trim()) {
      this.tomtomKey = key.trim();
      if (this.layers.tomtomTraffic && this.map) {
        this.map.removeLayer(this.layers.tomtomTraffic);
        this.layers.tomtomTraffic = L.tileLayer(
          `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${this.tomtomKey}`,
          { maxZoom: 19, opacity: 0.82 }
        ).addTo(this.map);
      }
    }
  }

  flyToCity(cityObj) {
    if (!this.map || !cityObj) return;
    this.map.flyTo([cityObj.lat, cityObj.lng], cityObj.zoom || 13, {
      animate: true,
      duration: 1.2
    });
  }

  // Vẽ các ghim ngập nước chuẩn phong cách Google Maps Pin
  renderFloodPoints(floodPoints) {
    if (!this.layers.floodMarkers) return;
    this.layers.floodMarkers.clearLayers();

    floodPoints.forEach(point => {
      const isCritical = point.danger_level === 'critical';
      const depthText = point.depth_cm ? `${point.depth_cm}cm` : 'Ngập';
      const badgeClass = isCritical ? '' : 'badge-medium';
      const pointClass = isCritical ? '' : 'point-medium';
      const color = isCritical ? '#d93025' : '#f9ab00';

      const customIcon = L.divIcon({
        className: 'gm-flood-pin-container',
        html: `
          <div class="gm-flood-pin">
            <div class="gm-flood-badge ${badgeClass}">
              <span>🌊</span> ${depthText}
            </div>
            <div class="gm-pin-point ${pointClass}"></div>
          </div>
        `,
        iconSize: [60, 32],
        iconAnchor: [30, 32]
      });

      const marker = L.marker([point.lat, point.lng], { icon: customIcon });

      // Vòng tròn vùng trũng ngập bán kính nhẹ nhàng
      const circle = L.circle([point.lat, point.lng], {
        radius: isCritical ? 240 : 150,
        color: color,
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.12
      });

      const popupHtml = `
        <div style="font-family: Roboto, sans-serif; min-width: 250px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 700; color: ${color}; text-transform: uppercase;">
              ${isCritical ? '🔴 Rốn ngập sâu nguy hiểm' : '🟡 Điểm ngập cục bộ'}
            </span>
            <span style="background: ${color}; color: #fff; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 99px;">
              ${depthText}
            </span>
          </div>
          <h3 style="font-size: 14px; font-weight: 700; color: #202124; margin-bottom: 6px; line-height: 1.3;">
            ${point.name}
          </h3>
          <div style="font-size: 12px; color: #5f6368; margin-bottom: 8px;">
            Nguồn trạm đo: <strong>${point.source}</strong>
          </div>
          <div style="background: #f8f9fa; border: 1px solid #e8eaed; border-radius: 6px; padding: 8px; font-size: 12px; margin-bottom: 8px;">
            <div>🛵 <strong>Xe máy:</strong> ${point.passable_motorbike ? '✅ Có thể qua' : '❌ Nguy cơ chết máy bugi'}</div>
            <div>🚗 <strong>Ô tô:</strong> ${point.passable_car ? '✅ Xe gầm cao đi được' : '❌ Nguy cơ thủy kích'}</div>
          </div>
          <div style="font-size: 12px; color: #c5221f; font-weight: 500; margin-bottom: 6px;">
            💡 ${point.advice || 'Khuyến nghị vòng tránh qua tuyến khác.'}
          </div>
          <div style="font-size: 11px; color: #70757a;">
            Trạm bơm: ${point.pump_status || 'Đang vận hành'}
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      this.layers.floodMarkers.addLayer(marker);
      this.layers.floodMarkers.addLayer(circle);
    });
  }

  // Vẽ các ghim sự cố giao thông TomTom / VOV
  renderTrafficIncidents(incidents) {
    if (!this.layers.trafficMarkers) return;
    this.layers.trafficMarkers.clearLayers();

    incidents.forEach(inc => {
      const customIcon = L.divIcon({
        className: 'gm-traffic-pin-container',
        html: `<div class="gm-traffic-pin">🚗</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([inc.lat, inc.lng], { icon: customIcon });

      const popupHtml = `
        <div style="font-family: Roboto, sans-serif; min-width: 220px;">
          <div style="font-size: 11px; font-weight: 700; color: #b06000; text-transform: uppercase; margin-bottom: 4px;">
            ⚠️ Ùn tắc giao thông thời gian thực
          </div>
          <h4 style="font-size: 13px; font-weight: 700; color: #202124; margin-bottom: 6px;">
            ${inc.description}
          </h4>
          <div style="font-size: 12px; color: #5f6368; margin-bottom: 4px;">
            Vận tốc: <strong>~${inc.speedKmh || 8} km/h</strong> • Độ trễ: <strong style="color: #d93025;">+${Math.round((inc.delaySeconds || 300) / 60)} phút</strong>
          </div>
          <div style="font-size: 11px; color: #70757a;">
            Nguồn: ${(inc.source || 'Cảm biến đô thị').replace(/API\s*v?\d*/gi, '').trim()}
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      this.layers.trafficMarkers.addLayer(marker);
    });
  }

  // Vẽ tuyến đường chuẩn phong cách Google Maps
  displayRoute({ recommendedRoute, dangerRoute, hasHazard }) {
    // Xóa tuyến đường cũ
    if (this.layers.routeSafeOutline) this.map.removeLayer(this.layers.routeSafeOutline);
    if (this.layers.routeSafe) this.map.removeLayer(this.layers.routeSafe);
    if (this.layers.routeDanger) this.map.removeLayer(this.layers.routeDanger);

    // 1. Tuyến cũ nguy hiểm (nét đứt đỏ)
    if (hasHazard && dangerRoute) {
      this.layers.routeDanger = L.polyline(dangerRoute.polyline, {
        color: '#d93025',
        weight: 6,
        opacity: 0.75,
        dashArray: '8, 8'
      }).addTo(this.map);
    }

    // 2. Tuyến né ngập an toàn (Đường Google Maps: viền trắng + ruột xanh lá đậm)
    if (recommendedRoute) {
      // Viền ngoài màu trắng để nổi bật trên nền bản đồ
      this.layers.routeSafeOutline = L.polyline(recommendedRoute.polyline, {
        color: '#ffffff',
        weight: 10,
        opacity: 0.95
      }).addTo(this.map);

      // Ruột màu xanh lá Google Maps
      this.layers.routeSafe = L.polyline(recommendedRoute.polyline, {
        color: '#1e8e3e',
        weight: 6,
        opacity: 1
      }).addTo(this.map);

      // Căn chỉnh khung nhìn bản đồ
      this.map.fitBounds(this.layers.routeSafe.getBounds(), { padding: [60, 60] });
    }
  }

  // Bật / tắt các lớp
  toggleTraffic(show) {
    if (!this.map) return;
    if (show) this.layers.tomtomTraffic.addTo(this.map);
    else this.map.removeLayer(this.layers.tomtomTraffic);
  }

  toggleFloods(show) {
    if (!this.map) return;
    if (show) this.layers.floodMarkers.addTo(this.map);
    else this.map.removeLayer(this.layers.floodMarkers);
  }

  toggleIncidents(show) {
    if (!this.map) return;
    if (show) this.layers.trafficMarkers.addTo(this.map);
    else this.map.removeLayer(this.layers.trafficMarkers);
  }

  switchBaseMap(type) {
    if (!this.map) return;
    if (type === 'satellite') {
      this.map.removeLayer(this.layers.baseStandard);
      this.layers.baseSatellite.addTo(this.map);
      this.currentBase = 'satellite';
    } else {
      this.map.removeLayer(this.layers.baseSatellite);
      this.layers.baseStandard.addTo(this.map);
      this.currentBase = 'standard';
    }
  }

  zoomIn() { if (this.map) this.map.zoomIn(); }
  zoomOut() { if (this.map) this.map.zoomOut(); }
}

window.mapEngine = new MapEngine();
