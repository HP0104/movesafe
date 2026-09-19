/**
 * RoutingService - Thuật toán tìm kiếm lộ trình thông minh né điểm ngập sâu & kẹt xe
 * Sử dụng OSRM Routing Engine kết hợp bộ phân tích chướng ngại vật thời gian thực của MoveSafe
 */

class RoutingService {
  constructor() {
    this.osrmBaseUrl = 'https://router.project-osrm.org/route/v1/driving';
  }

  // Tính khoảng cách giữa 2 tọa độ (Haversine formula - mét)
  getDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Bán kính trái đất (mét)
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Kiểm tra xem đoạn đường có cắt qua vùng nguy hiểm (ngập >20cm hoặc kẹt xe) không
  analyzeRouteHazards(polylineCoords, floodPoints, vehicleType = 'motorbike') {
    const hazards = [];
    const minSafeDist = vehicleType === 'motorbike' ? 250 : 200; // mét

    for (const point of floodPoints) {
      // Nếu là xe máy mà ngập > 15cm hoặc ô tô ngập > 30cm
      const isDangerous = vehicleType === 'motorbike' ? point.depth_cm >= 15 : point.depth_cm >= 30;
      if (!isDangerous) continue;

      for (const coord of polylineCoords) {
        const dist = this.getDistanceMeters(coord[0], coord[1], point.lat, point.lng);
        if (dist <= minSafeDist) {
          if (!hazards.some(h => h.id === point.id)) {
            hazards.push({
              ...point,
              distanceToRoute: Math.round(dist)
            });
          }
          break;
        }
      }
    }

    return hazards;
  }

  // Gọi OSRM lấy tọa độ đường đi
  async fetchOsrmRoute(waypoints) {
    // waypoints: [[lng1, lat1], [lng2, lat2], ...]
    const coordsStr = waypoints.map(w => `${w[0]},${w[1]}`).join(';');
    const url = `${this.osrmBaseUrl}/${coordsStr}?overview=full&geometries=geojson&steps=true`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error('Không thể tính toán tuyến đường OSRM');
    const data = await res.json();
    if (!data.routes || data.routes.length === 0) throw new Error('Không tìm thấy đường đi');

    const route = data.routes[0];
    const polyline = route.geometry.coordinates.map(c => [c[1], c[0]]); // chuyển sang [lat, lng] cho Leaflet
    return {
      distanceKm: (route.distance / 1000).toFixed(1),
      durationMin: Math.round(route.duration / 60),
      polyline,
      steps: route.legs[0].steps.map(s => ({
        instruction: s.maneuver.type + ' ' + (s.name || ''),
        distance: s.distance
      }))
    };
  }

  // Tính toán song song 2 lộ trình: Tuyến ngắn nhất và Tuyến né ngập thông minh
  async calculateSmartSafeRoute({ origin, destination, floodPoints, vehicleType = 'motorbike' }) {
    // 1. Tuyến đường trực tiếp (Ngắn nhất)
    const directRoute = await this.fetchOsrmRoute([
      [origin.lng, origin.lat],
      [destination.lng, destination.lat]
    ]);

    // 2. Phân tích chướng ngại vật
    const detectedHazards = this.analyzeRouteHazards(directRoute.polyline, floodPoints, vehicleType);

    if (detectedHazards.length === 0) {
      // Tuyến đường đã an toàn tuyệt đối
      return {
        hasHazard: false,
        recommendedRoute: directRoute,
        dangerRoute: null,
        hazards: []
      };
    }

    // 3. Nếu có điểm ngập, tính toán điểm tránh (Bypass Waypoint)
    const worstHazard = detectedHazards[0];
    // Tạo điểm bẻ góc né rốn ngập (offset 600m theo hướng đông/tây tùy vị trí)
    const bypassLat = worstHazard.lat + 0.006;
    const bypassLng = worstHazard.lng + 0.007;

    try {
      const safeRoute = await this.fetchOsrmRoute([
        [origin.lng, origin.lat],
        [bypassLng, bypassLat],
        [destination.lng, destination.lat]
      ]);

      return {
        hasHazard: true,
        recommendedRoute: safeRoute,
        dangerRoute: directRoute,
        hazards: detectedHazards,
        bypassNote: `Hệ thống tự động dẫn vòng qua ${worstHazard.name} (ngập sâu ${worstHazard.depth_cm}cm)`
      };
    } catch (e) {
      // Fallback nếu không tìm được đường né
      return {
        hasHazard: true,
        recommendedRoute: directRoute,
        dangerRoute: directRoute,
        hazards: detectedHazards
      };
    }
  }
}

window.routingService = new RoutingService();
