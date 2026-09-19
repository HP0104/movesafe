const axios = require('axios');
const botService = require('./bot-service');

class AIAssistantService {
  async processQuery({ query, city = 'hanoi', userApiKey = '' }) {
    const liveData = botService.getData();
    const floodPoints = (liveData.floodPoints || []).filter(f => f.city === city);
    const trafficIncidents = (liveData.trafficIncidents || []).filter(t => t.city === city);
    const weatherAlerts = liveData.weatherAlerts || [];

    // Nếu người dùng có cấp Google Gemini API Key
    if (userApiKey && userApiKey.trim().length > 10) {
      try {
        return await this.callGeminiAPI(query, liveData, city, userApiKey.trim());
      } catch (err) {
        console.warn('[AI] Gọi Gemini API thất bại, chuyển sang Bộ não AI tích hợp:', err.message);
      }
    }

    // Bộ não AI suy luận ngữ cảnh thời gian thực tích hợp sẵn (Local Context Engine)
    return this.generateSmartLocalResponse(query, city, floodPoints, trafficIncidents, weatherAlerts);
  }

  // Phân tích câu hỏi bằng Bộ não AI thông minh chạy trực tiếp
  generateSmartLocalResponse(query, city, floods, traffics, alerts) {
    const lower = query.toLowerCase();
    const cityName = city === 'hanoi' ? 'Hà Nội' : (city === 'hcm' ? 'TP. Hồ Chí Minh' : 'Đà Nẵng');

    // 1. Hỏi về lộ trình / tìm đường tránh ngập (Ví dụ: từ A đến B)
    if (lower.includes('đường') || lower.includes('từ') || lower.includes('về') || lower.includes('đi đâu') || lower.includes('lộ trình') || lower.includes('tránh')) {
      const floodNames = floods.map(f => f.name).join(', ');
      
      let matchedFlood = floods.find(f => {
        const words = f.name.toLowerCase().split(/[(),-]/);
        return words.some(w => w.trim().length > 3 && lower.includes(w.trim()));
      });

      if (matchedFlood) {
        return {
          text: `⚠️ **Cảnh báo rủi ro cao tại ${matchedFlood.name}**!\n\n` +
                `Hiện trạm đo ghi nhận mực nước ngập sâu **${matchedFlood.depth_cm}cm** (${matchedFlood.advice}).\n\n` +
                `💡 **Khuyến nghị di chuyển**: Xe máy và ô tô gầm thấp tuyệt đối không đi qua đoạn này vì nguy cơ thủy kích rất cao. Hãy chuyển sang chế độ **Bản đồ Tác chiến** trên ứng dụng, hệ thống MoveSafe đã tự động vạch lộ trình vòng qua các tuyến phố cao ráo lân cận!`,
          action: {
            type: 'FOCUS_POINT',
            lat: matchedFlood.lat,
            lng: matchedFlood.lng,
            name: matchedFlood.name
          }
        };
      }

      return {
        text: `🚗 **Phân tích lộ trình thông minh tại ${cityName}**:\n\n` +
              `Hiện tại hệ thống Bot ghi nhận đang có **${floods.length} điểm ngập cục bộ** và **${traffics.length} điểm ùn ứ**.\n\n` +
              `📍 **Các rốn ngập cần tránh tuyệt đối**:\n` +
              floods.slice(0, 3).map(f => `• **${f.name}**: Ngập sâu ${f.depth_cm}cm (${f.passable_motorbike ? 'Xe máy đi chậm' : 'Xe máy KHÔNG THỂ QUA'})`).join('\n') +
              `\n\n👉 **Gợi ý**: Bạn có thể nhập trực tiếp Điểm đi và Điểm đến vào thanh tìm kiếm phía trên để MoveSafe kích hoạt thuật toán tự động bẻ hướng né ngập tức thì!`,
        action: { type: 'SHOW_FLOOD_LAYER' }
      };
    }

    // 2. Hỏi về thời tiết, mưa, bão
    if (lower.includes('mưa') || lower.includes('thời tiết') || lower.includes('nhiệt độ') || lower.includes('ngập không') || lower.includes('bão') || lower.includes('triều cường')) {
      const alertMsg = alerts.length > 0 ? alerts[0].content : 'Thời tiết có mây dông rải rác vào chiều tối.';
      return {
        text: `🌧️ **Dự báo thời tiết & Nguy cơ ngập úng (${cityName})**:\n\n` +
              `• **Trạng thái**: ${alertMsg}\n` +
              `• **Mức độ rủi ro ngập**: ${floods.some(f => f.danger_level === 'critical') ? '🔴 RẤT CAO (Có điểm ngập >30cm)' : '🟡 TRUNG BÌNH'}\n` +
              `• **Lời khuyên**: Nếu di chuyển bằng xe máy, hãy chuẩn bị áo mưa bộ và tránh đỗ xe ở các tầng hầm tòa nhà khu vực trũng thấp.`,
        action: { type: 'SHOW_WEATHER_LAYER' }
      };
    }

    // 3. Hỏi về tình trạng tắc đường, kẹt xe
    if (lower.includes('tắc') || lower.includes('kẹt') || lower.includes('ùn') || lower.includes('giao thông')) {
      return {
        text: `🚦 **Tình hình giao thông thực tế từ VOV & TomTom Traffic (${cityName})**:\n\n` +
              (traffics.length > 0
                ? traffics.slice(0, 3).map(t => `• 🚗 **${t.description}** (Độ trễ dự kiến: ~${Math.round(t.delaySeconds / 60)} phút)`).join('\n')
                : `• Giao thông hiện tại trên các tuyến trục chính tương đối ổn định, mật độ trung bình.`) +
              `\n\nBản đồ nhiệt giao thông (đường xanh/vàng/đỏ) đã được kích hoạt trực tiếp trên giao diện Live Map.`,
        action: { type: 'SHOW_TRAFFIC_LAYER' }
      };
    }

    // Câu trả lời tổng quan mặc định
    return {
      text: `Xin chào! Tôi là **Trợ lý Di chuyển Thông minh MoveSafe AI** 🤖.\n\n` +
            `Tôi theo dõi dữ liệu thời gian thực từ **HSDC Hà Nội**, **UDi Maps TP.HCM**, **VOV Giao Thông** và **TomTom Traffic**.\n\n` +
            `Bạn có thể hỏi tôi:\n` +
            `1. *"Đi từ Cầu Giấy sang Hà Đông đường nào không ngập?"*\n` +
            `2. *"Đường Nguyễn Khuyến hiện tại ngập sâu bao nhiêu cm?"*\n` +
            `3. *"Tình hình tắc đường tại các nút giao lớn lúc này?"*\n` +
            `4. Hoặc nhấn biểu tượng micro để tìm đường bằng giọng nói!`,
      action: null
    };
  }

  // Gọi Google Gemini API nếu người dùng cung cấp Key
  async callGeminiAPI(query, liveData, city, apiKey) {
    const contextPrompt = `Bạn là Trợ lý AI Giao Thông Thông Minh của nền tảng MoveSafe VN.
Dưới đây là dữ liệu thời gian thực hiện tại tại đô thị ${city}:
- Danh sách các điểm ngập đo được từ hệ thống HSDC/UDi Maps: ${JSON.stringify(liveData.floodPoints.slice(0, 8))}
- Dữ liệu sự cố tắc đường từ TomTom & VOV: ${JSON.stringify(liveData.trafficIncidents.slice(0, 5))}
- Cảnh báo thời tiết KTTV: ${JSON.stringify(liveData.weatherAlerts)}

Người dùng hỏi: "${query}"

Hãy trả lời bằng tiếng Việt một cách súc tích, thân thiện, mang tính hành động cao (khuyến cáo mực nước cụ thể bằng cm, gợi ý đường đi an toàn, cảnh báo xe máy/ô tô). Dùng emoji hợp lý.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await axios.post(url, {
      contents: [{ parts: [{ text: contextPrompt }] }]
    }, { timeout: 10000 });

    const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Không nhận được phản hồi từ AI.';
    return {
      text: reply,
      action: { type: 'SHOW_FLOOD_LAYER' }
    };
  }
}

module.exports = new AIAssistantService();
