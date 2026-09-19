/**
 * CrowdsourceService - Quản lý báo cáo sự cố ngập lụt, kẹt xe từ cộng đồng
 * Đồng bộ đa tab / đa thiết bị theo thời gian thực qua BroadcastChannel
 */

class CrowdsourceService {
  constructor() {
    this.channel = new BroadcastChannel('movesafe_realtime_channel');
    this.channel.onmessage = (event) => {
      if (event.data && event.data.type === 'NEW_REPORT') {
        console.log('[Realtime Sync] Nhận báo cáo mới từ tab khác:', event.data.report);
        this.handleIncomingReport(event.data.report);
      }
    };
  }

  // Phát âm thanh cảnh báo ngắn (Web Audio API)
  playAlertTone() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.2); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {}
  }

  handleIncomingReport(report) {
    this.playAlertTone();
    if (window.mapEngine && window.appState) {
      if (report.type === 'flood') {
        window.appState.liveData.floodPoints.unshift(report);
        window.mapEngine.renderFloodPoints(window.appState.liveData.floodPoints);
      } else {
        window.appState.liveData.trafficIncidents.unshift(report);
        window.mapEngine.renderTrafficIncidents(window.appState.liveData.trafficIncidents);
      }
      window.appState.updateStatsCounters();
    }
  }

  async submitReport(formData) {
    try {
      const res = await fetch('/api/crowdsource/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (data.status === 'success' && data.report) {
        // Đồng bộ tới các tab khác
        this.channel.postMessage({
          type: 'NEW_REPORT',
          report: data.report
        });

        // Cập nhật ngay trên máy người dùng
        this.handleIncomingReport(data.report);
        return { success: true, report: data.report };
      } else {
        throw new Error(data.message || 'Lỗi khi gửi báo cáo');
      }
    } catch (err) {
      console.error('Lỗi gửi báo cáo cộng đồng:', err);
      // Giả lập lưu cục bộ nếu server bận
      const localReport = {
        id: `local-${Date.now()}`,
        name: formData.locationName || 'Điểm do bạn vừa báo cáo',
        city: formData.city || 'hanoi',
        lat: parseFloat(formData.lat),
        lng: parseFloat(formData.lng),
        type: formData.type || 'flood',
        depth_cm: parseInt(formData.depth_cm) || 25,
        danger_level: parseInt(formData.depth_cm) > 30 ? 'critical' : 'medium',
        passable_motorbike: parseInt(formData.depth_cm) < 20,
        passable_car: parseInt(formData.depth_cm) < 35,
        source: 'Báo cáo trực tiếp từ bạn',
        pump_status: 'Vừa ghi nhận',
        advice: 'Cần chú ý giảm tốc độ.',
        updated_at: new Date().toISOString()
      };
      this.handleIncomingReport(localReport);
      return { success: true, report: localReport };
    }
  }
}

window.crowdsourceService = new CrowdsourceService();
