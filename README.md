# MoveSafe VN - Cổng Thông Tin Giao Thông & Dẫn Đường Né Ngập Thông Minh (AI Realtime)

> **Dự án Web Dự Thi Sáng Tạo & Đề Án Công Nghệ Đô Thị Thông Minh**  
> Tích hợp Thời Tiết • Quan Trắc Ngập Lụt HSDC/UDi Maps • Lưu Lượng Kẹt Xe TomTom Traffic • Dẫn Đường Né Rốn Ngập • Trợ Lý AI Thời Gian Thực.

---

## 🌟 Điểm Nhấn Sáng Tạo (Key Features)

1. **Giao Diện Kép Độc Đáo (Dual-Mode UX)**:
   - **Chế độ Google Portal (Tối Giản & Thông Minh)**: Thanh tìm kiếm phong cách Google hỗ trợ ngôn ngữ tự nhiên, tìm đường né ngập, tìm kiếm bằng giọng nói tiếng Việt (Web Speech API), bảng tin cảnh báo khẩn cấp và 3 thẻ widget thời tiết/ngập úng thời gian thực.
   - **Chế độ Bản Đồ Tác Chiến (Live Tactical Map)**: Bản đồ tương tác Leaflet toàn màn hình hiển thị trực quan các rốn ngập (marker giọt nước tỏa sóng theo mực nước cm), lớp lưu lượng kẹt xe TomTom Traffic (đường xanh/cam/đỏ thực tế).

2. **Thuật Toán Tìm Đường Né Ngập Thông Minh (Smart Flood-Avoidance Routing)**:
   - Tự động phân tích toàn bộ tọa độ trên lộ trình ngắn nhất so với các rốn ngập sâu đang hoạt động.
   - Nếu phát hiện rốn ngập nguy hiểm (xe máy dễ chết máy, ô tô nguy cơ thủy kích), hệ thống cảnh báo màu đỏ và **tự động bẻ góc tính toán lại lộ trình an toàn màu xanh lá** đi vòng qua khu vực cao ráo.

3. **Bot Bắt Dữ Liệu Địa Phương Chạy Ngầm (Node.js Worker Bot)**:
   - Tự động cào và chuẩn hóa dữ liệu từ **HSDC Hà Nội** (Công ty Thoát nước Hà Nội), **UDi Maps TP.HCM**, **VOV Giao Thông** và **Trung tâm Dự báo KTTV Quốc gia (nchmf.gov.vn)**.
   - Nạp 50+ sự cố giao thông thực tế từ **TomTom Live Traffic API v5** (sử dụng API key người dùng).
   - Tự động làm mới định kỳ mỗi 5 phút hoặc kích hoạt tức thời bằng nút `🔄` trên bản đồ.

4. **Trợ Lý AI Di Chuyển (AI Copilot & Realtime RAG)**:
   - Phân tích câu hỏi người dùng bằng tiếng Việt, trích xuất dữ liệu rốn ngập, kẹt xe và đưa ra lời khuyên thiết thực (mực nước cm, phương tiện an toàn).
   - Tự động điều khiển bản đồ bay đến tọa độ rốn ngập người dùng đang quan tâm.
   - Hỗ trợ cả **Bộ não AI nội bộ** (không cần API key) và **Google Gemini API**.

5. **Hệ Thống Báo Cáo Sự Cố Cộng Đồng (Crowdsourcing Realtime)**:
   - Người đi đường có thể bấm `+ Báo Ngập / Tắc`, chọn mức ngập (mắt cá chân, nửa bánh xe, lút yên xe) và gửi lên hệ thống.
   - Điểm báo cáo lập tức được ghim lên bản đồ và **đồng bộ đa tab / đa thiết bị theo thời gian thực** qua `BroadcastChannel` và REST API kèm âm thanh cảnh báo.

---

## 🚀 Hướng Dẫn Khởi Chạy Nhanh

### 1. Khởi động hệ thống
Mở terminal tại thư mục dự án và chạy:
```bash
npm start
```

### 2. Mở ứng dụng
Truy cập trình duyệt tại địa chỉ:
```
http://localhost:3000
```

---

## 🔑 Cấu Hình API Keys Tích Hợp

Các API Key được lưu trữ an toàn trong file `.env` (không đưa lên GitHub):
- Tạo file `.env` từ mẫu `.env.example`:
  ```env
  OPENWEATHER_KEY=your_openweather_key
  TOMTOM_KEY=your_tomtom_key
  GEMINI_KEY=your_gemini_key
  ```
- Hoặc bạn có thể dán trực tiếp trong mục **⚙️ Cài đặt** trên giao diện web bất cứ lúc nào.

---

## 📁 Cấu Trúc Thư Mục Dự Án

```
web du thi/
├── server/
│   ├── server.js              # Express REST API Server & phục vụ static files
│   ├── bot-service.js         # Worker Bot cào dữ liệu HSDC, UDi, VOV, NCHMF & TomTom
│   ├── ai-service.js          # Bộ não AI xử lý ngữ cảnh thời gian thực & Gemini RAG
│   └── config.js              # Cấu hình trung tâm, API keys và tọa độ đô thị
├── public/
│   ├── index.html             # Giao diện chính (Google Portal + Live Tactical Map)
│   ├── css/
│   │   └── style.css          # Hệ thống thiết kế Glassmorphism, animations và responsive
│   └── js/
│       ├── app.js             # Nhạc trưởng điều phối state và tương tác người dùng
│       ├── map-engine.js      # Quản lý Leaflet Map, TomTom Traffic Layer, Marker ngập
│       ├── weather-service.js # Dữ liệu thời tiết OpenWeather & Open-Meteo
│       ├── routing-service.js # Thuật toán tìm đường né ngập & kẹt xe
│       ├── ai-chat.js         # Trợ lý AI Copilot, voice recognition (Speech API)
│       └── crowdsource.js     # Báo cáo sự cố cộng đồng & đồng bộ đa tab realtime
└── data/
    ├── live_urban_cache.json   # Cache dữ liệu cào tổng hợp từ bot
    └── crowdsource_reports.json # Lưu trữ các báo cáo sự cố từ người dùng
```

---

## 🎯 Kịch Bản Thuyết Trình Demo Cho Ban Giám Khảo

1. **Demo Trang Chủ Google Portal**:
   - Chỉ cho ban giám khảo thấy thiết kế tối giản, trực quan, widget thời tiết hiển thị lượng mưa mm và mức độ rủi ro ngập.
   - Thử bấm vào nút micro 🎙️ hoặc gõ câu hỏi: *"Thời tiết hôm nay có mưa ngập không?"* để xem AI trả lời.
2. **Demo Tìm Đường Né Ngập (Tính Năng Đắt Giá Nhất)**:
   - Bấm sang chế độ **Bản Đồ Tác Chiến**.
   - Bấm nút **🚀 Tìm Đường**: Quan sát hệ thống phát hiện rốn ngập Nguyễn Khuyến (ngập sâu 35cm) trên đường ngắn nhất (vẽ nét đứt màu đỏ), và **tự động vẽ tuyến đường an toàn màu xanh lá** đi vòng qua khu vực khô ráo.
3. **Demo Bot Cào Dữ Liệu Thời Gian Thực**:
   - Bấm nút `🔄` ở góc phải bản đồ: Bot lập tức quét lại luồng dữ liệu HSDC, VOV và TomTom Traffic, hiển thị thông báo cập nhật thành công.
4. **Demo Báo Ngập Cộng Đồng Đồng Bộ Realtime**:
   - Mở 2 tab trình duyệt song song `http://localhost:3000`.
   - Ở tab 1, bấm `+ Báo Ngập / Tắc`, chọn mức ngập và gửi.
   - Ngay lập tức tab 2 phát âm thanh `Ping!` và marker điểm ngập mới xuất hiện tức thì trên bản đồ.
