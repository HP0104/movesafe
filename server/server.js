const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const botService = require('./bot-service');
const aiService = require('./ai-service');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// 1. API Cấu hình công khai cho Frontend
app.get('/api/config', (req, res) => {
  res.json({
    status: 'success',
    apiKeys: {
      tomtom: config.API_KEYS.TOMTOM,
      openweather: config.API_KEYS.OPENWEATHER,
      hasGemini: !!config.API_KEYS.GEMINI
    },
    cities: config.CITIES,
    systemTime: new Date().toISOString()
  });
});

// 2. API Lấy dữ liệu thời gian thực từ Bot
app.get('/api/live-data', (req, res) => {
  const data = botService.getData();
  res.json({
    status: 'success',
    data
  });
});

// 3. API Kích hoạt Bot cào dữ liệu ngay lập tức
app.post('/api/bot/refresh', async (req, res) => {
  try {
    const updated = await botService.crawlAll();
    res.json({
      status: 'success',
      message: 'Đã hoàn tất chu trình cào dữ liệu từ hệ thống địa phương!',
      data: updated
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 4. API Gửi báo cáo cộng đồng (Crowdsourcing)
app.post('/api/crowdsource/report', (req, res) => {
  try {
    const report = req.body;
    if (!report || !report.lat || !report.lng) {
      return res.status(400).json({ status: 'error', message: 'Thiếu tọa độ sự cố' });
    }

    const saved = botService.addCrowdsourceReport(report);
    res.json({
      status: 'success',
      message: 'Báo cáo sự cố đã được xác thực và ghim lên bản đồ!',
      report: saved
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 5. API Trợ lý AI Thông Minh
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { query, city, apiKey } = req.body;
    if (!query) {
      return res.status(400).json({ status: 'error', message: 'Vui lòng cung cấp câu hỏi' });
    }

    const response = await aiService.processQuery({
      query,
      city: city || 'hanoi',
      userApiKey: apiKey || config.API_KEYS.GEMINI
    });

    res.json({
      status: 'success',
      response
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Fallback route cho Single Page Application
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Khởi động server có cơ chế tự động chuyển cổng nếu cổng 3000 bị bận
function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`=======================================================`);
    console.log(`🚀 [MoveSafe VN] Server & Bot đã hoạt động trên PORT ${port}`);
    console.log(`🌐 Truy cập ứng dụng tại: http://localhost:${port}`);
    console.log(`📡 Bot cào dữ liệu: HSDC Hà Nội, UDi TP.HCM, VOV, TomTom`);
    console.log(`=======================================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[MoveSafe] ⚠️ Cổng ${port} đang bận, tự động chuyển sang cổng ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('[MoveSafe] Lỗi máy chủ:', err.message);
    }
  });
}

startServer(config.PORT || 3000);
