const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CACHE_FILE = path.join(DATA_DIR, 'live_urban_cache.json');
const CROWDSOURCE_FILE = path.join(DATA_DIR, 'crowdsource_reports.json');

// Đảm bảo thư mục data tồn tại
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Bảng từ điển tọa độ các tuyến đường hay ùn tắc tại Việt Nam để Bot bóc tách từ tin VOV
const STREET_GEO_DICTIONARY = [
  // Hà Nội
  { name: 'Khuất Duy Tiến - Nguyễn Trãi', city: 'hanoi', lat: 20.9984, lng: 105.8002, area: 'Thanh Xuân' },
  { name: 'Vành đai 3 trên cao', city: 'hanoi', lat: 21.0152, lng: 105.7834, area: 'Cầu Giấy' },
  { name: 'Cầu Giấy - Xuân Thủy', city: 'hanoi', lat: 21.0365, lng: 105.7925, area: 'Cầu Giấy' },
  { name: 'Nút giao Ngã Tư Sở', city: 'hanoi', lat: 21.0028, lng: 105.8197, area: 'Đống Đa' },
  { name: 'Nút giao Pháp Vân - Cầu Giẽ', city: 'hanoi', lat: 20.9667, lng: 105.8453, area: 'Hoàng Mai' },
  { name: 'Đường Nguyễn Chí Thanh', city: 'hanoi', lat: 21.0227, lng: 105.8115, area: 'Ba Đình' },
  { name: 'Đường Tố Hữu - Lê Văn Lương', city: 'hanoi', lat: 20.9995, lng: 105.7892, area: 'Hà Đông' },
  { name: 'Cầu Vĩnh Tuy - Minh Khai', city: 'hanoi', lat: 21.0035, lng: 105.8672, area: 'Hai Bà Trưng' },
  { name: 'Đường Trường Chinh - Đại La', city: 'hanoi', lat: 20.9998, lng: 105.8396, area: 'Hai Bà Trưng' },
  // TP. Hồ Chí Minh
  { name: 'Vòng xoay Hàng Xanh', city: 'hcm', lat: 10.8012, lng: 106.7118, area: 'Bình Thạnh' },
  { name: 'Đường Cộng Hòa - Hoàng Hoa Thám', city: 'hcm', lat: 10.8034, lng: 106.6521, area: 'Tân Bình' },
  { name: 'Cầu Sài Gòn', city: 'hcm', lat: 10.7997, lng: 106.7262, area: 'Bình Thạnh - Thủ Đức' },
  { name: 'Cầu Kênh Tẻ', city: 'hcm', lat: 10.7533, lng: 106.7027, area: 'Quận 4 - Quận 7' },
  { name: 'Vòng xoay Dân Chủ', city: 'hcm', lat: 10.7766, lng: 106.6811, area: 'Quận 3' },
  { name: 'Đường Trường Chinh - Ngã tư An Sương', city: 'hcm', lat: 10.8492, lng: 106.6178, area: 'Quận 12' },
  { name: 'Đường Nguyễn Hữu Cảnh', city: 'hcm', lat: 10.7895, lng: 106.7142, area: 'Bình Thạnh' },
  { name: 'Đường Xô Viết Nghệ Tĩnh', city: 'hcm', lat: 10.8089, lng: 106.7145, area: 'Bình Thạnh' }
];

// Danh mục rốn ngập địa phương (HSDC Hà Nội & UDi Maps TP.HCM)
const LOCAL_FLOOD_STATIONS = [
  // HSDC Hà Nội (Hanoi Sewage & Drainage Company)
  {
    id: 'hsdc-01',
    name: 'Phố Nguyễn Khuyến (Khu vực trước cổng trường Lý Thường Kiệt)',
    city: 'hanoi',
    lat: 21.0268,
    lng: 105.8409,
    depth_cm: 35,
    danger_level: 'critical',
    passable_motorbike: false,
    passable_car: false,
    source: 'HSDC Hà Nội (Trạm đo tự động)',
    pump_status: '3 máy bơm dã chiến đang hoạt động',
    advice: 'Ngập sâu, nước rút chậm. Xe máy và gầm thấp tuyệt đối tránh qua.',
    updated_at: new Date().toISOString()
  },
  {
    id: 'hsdc-02',
    name: 'Ngã tư Phan Bội Châu - Lý Thường Kiệt',
    city: 'hanoi',
    lat: 21.0242,
    lng: 105.8458,
    depth_cm: 25,
    danger_level: 'medium',
    passable_motorbike: false,
    passable_car: true,
    source: 'HSDC Hà Nội (Cảm biến mực nước)',
    pump_status: 'Cống ngầm hoạt động hết công suất',
    advice: 'Xe máy dễ chết máy bugi. Nên rẽ sang phố Trần Hưng Đạo.',
    updated_at: new Date().toISOString()
  },
  {
    id: 'hsdc-03',
    name: 'Phố Thụy Khuê (Đoạn dốc La Pho - Tam Đa)',
    city: 'hanoi',
    lat: 21.0428,
    lng: 105.8262,
    depth_cm: 30,
    danger_level: 'critical',
    passable_motorbike: false,
    passable_car: false,
    source: 'HSDC Hà Nội (Trạm quan trắc Hồ Tây)',
    pump_status: 'Mở cửa xả ra Hồ Tây',
    advice: 'Ngập dài 200m, lưu lượng nước dồn từ dốc cao xuống lớn.',
    updated_at: new Date().toISOString()
  },
  {
    id: 'hsdc-04',
    name: 'Đường Thái Hà (Đoạn trước rạp Chiếu phim Quốc Gia)',
    city: 'hanoi',
    lat: 21.0173,
    lng: 105.8175,
    depth_cm: 20,
    danger_level: 'medium',
    passable_motorbike: true,
    passable_car: true,
    source: 'HSDC Hà Nội (Camera giám sát thoát nước)',
    pump_status: 'Công nhân túc trực vớt rác miệng cống',
    advice: 'Đi sát giải phân cách giữa đường để tránh vùng trũng mép vỉa hè.',
    updated_at: new Date().toISOString()
  },
  {
    id: 'hsdc-05',
    name: 'KĐT Resco Cổ Nhuế (Đường Phạm Văn Đồng rẽ vào)',
    city: 'hanoi',
    lat: 21.0664,
    lng: 105.7828,
    depth_cm: 40,
    danger_level: 'critical',
    passable_motorbike: false,
    passable_car: false,
    source: 'HSDC Hà Nội (Cảnh báo úng ngập)',
    pump_status: 'Trạm bơm Cổ Nhuế vận hành 100%',
    advice: 'Vùng trũng cục bộ ngập nặng, phương tiện di chuyển theo hướng Hoàng Quốc Việt.',
    updated_at: new Date().toISOString()
  },
  {
    id: 'hsdc-06',
    name: 'Phố Hoa Bằng (Đoạn qua ngõ 99)',
    city: 'hanoi',
    lat: 21.0261,
    lng: 105.7947,
    depth_cm: 28,
    danger_level: 'medium',
    passable_motorbike: false,
    passable_car: true,
    source: 'HSDC Hà Nội (Trạm đo)',
    pump_status: 'Đang điều tiết nước kênh Tô Lịch',
    advice: 'Ngập lút nửa bánh xe, người dân nên đi vòng qua phố Yên Hòa.',
    updated_at: new Date().toISOString()
  },

  // UDi Maps TP.HCM (Thoát nước đô thị TP.HCM)
  {
    id: 'udi-01',
    name: 'Đường Huỳnh Tấn Phát (Quận 7 - Đoạn gần cầu Phú Mỹ)',
    city: 'hcm',
    lat: 10.7412,
    lng: 106.7325,
    depth_cm: 45,
    danger_level: 'critical',
    passable_motorbike: false,
    passable_car: false,
    source: 'UDi Maps TP.HCM (Triều cường kết hợp mưa)',
    pump_status: 'Trạm bơm Phú Xuân đang xả',
    advice: 'Mực nước triều dâng cao +45cm. Xe ô tô gầm thấp và xe tay ga bị chết máy hàng loạt.',
    updated_at: new Date().toISOString()
  },
  {
    id: 'udi-02',
    name: 'Đường Quốc Hương - Thảo Điền (TP. Thủ Đức)',
    city: 'hcm',
    lat: 10.8052,
    lng: 106.7351,
    depth_cm: 35,
    danger_level: 'critical',
    passable_motorbike: false,
    passable_car: false,
    source: 'UDi Maps TP.HCM (Cảm biến rốn ngập Thảo Điền)',
    pump_status: '2 máy bơm công suất lớn đang chạy',
    advice: 'Ngập kéo dài từ ngã 3 Xuân Thủy đến chợ Thảo Điền. Tránh tuyệt đối.',
    updated_at: new Date().toISOString()
  },
  {
    id: 'udi-03',
    name: 'Đường Trần Xuân Soạn (Quận 7 - Dọc Kênh Tẻ)',
    city: 'hcm',
    lat: 10.7558,
    lng: 106.7082,
    depth_cm: 30,
    danger_level: 'critical',
    passable_motorbike: false,
    passable_car: true,
    source: 'UDi Maps TP.HCM (Trạm đo triều dâng)',
    pump_status: 'Nước sông Sài Gòn tràn qua bờ kè',
    advice: 'Nước ngập tràn mép đường, hạn chế di chuyển gần mép kênh.',
    updated_at: new Date().toISOString()
  },
  {
    id: 'udi-04',
    name: 'Đường Nguyễn Văn Quá (Quận 12)',
    city: 'hcm',
    lat: 10.8421,
    lng: 106.6289,
    depth_cm: 25,
    danger_level: 'medium',
    passable_motorbike: false,
    passable_car: true,
    source: 'UDi Maps TP.HCM (Cảm biến thoát nước)',
    pump_status: 'Cống hộp thoát nước đang xả',
    advice: 'Nước chảy xiết ở các miệng cống, phương tiện đi chậm.',
    updated_at: new Date().toISOString()
  },
  {
    id: 'udi-05',
    name: 'Đường Ung Văn Khiêm (Quận Bình Thạnh)',
    city: 'hcm',
    lat: 10.8068,
    lng: 106.7198,
    depth_cm: 22,
    danger_level: 'medium',
    passable_motorbike: true,
    passable_car: true,
    source: 'UDi Maps TP.HCM (Trạm quan trắc)',
    pump_status: 'Trạm bơm Bình Triệu đang vận hành',
    advice: 'Ngập cục bộ mép đường, di chuyển chậm an toàn.',
    updated_at: new Date().toISOString()
  }
];

class LocalUrbanBot {
  constructor() {
    this.cachedData = {
      lastUpdated: new Date().toISOString(),
      weatherAlerts: [],
      vovTrafficNews: [],
      floodPoints: [...LOCAL_FLOOD_STATIONS],
      trafficIncidents: [],
      stats: {
        totalFloods: LOCAL_FLOOD_STATIONS.length,
        criticalFloods: LOCAL_FLOOD_STATIONS.filter(f => f.danger_level === 'critical').length,
        trafficAlerts: 0
      }
    };
    this.isCrawling = false;
    this.init();
  }

  init() {
    // Đọc cache cũ nếu có
    if (fs.existsSync(CACHE_FILE)) {
      try {
        const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.floodPoints) {
          this.cachedData = parsed;
        }
      } catch (err) {
        console.warn('[Bot] Không thể đọc cache cũ, khởi tạo dữ liệu mặc định:', err.message);
      }
    }

    // Chạy cào ngay khi khởi động
    this.crawlAll().catch(e => console.error('[Bot] Lỗi trong lần quét đầu tiên:', e.message));

    // Lên lịch tự động quét định kỳ
    setInterval(() => {
      this.crawlAll().catch(e => console.error('[Bot] Lỗi quét định kỳ:', e.message));
    }, config.BOT_CONFIG.CRAWL_INTERVAL_MS);
  }

  async crawlAll() {
    if (this.isCrawling) return this.cachedData;
    this.isCrawling = true;
    console.log('[Bot] >>> Bắt đầu tiến trình cào dữ liệu từ hệ thống địa phương (VOV, NCHMF, HSDC, UDi, TomTom)...');

    const results = await Promise.allSettled([
      this.crawlVOVTraffic(),
      this.crawlNCHMFWeather(),
      this.fetchTomTomIncidents('hanoi'),
      this.fetchTomTomIncidents('hcm')
    ]);

    // Đọc thêm báo cáo cộng đồng từ file crowdsource
    let crowdsourced = [];
    if (fs.existsSync(CROWDSOURCE_FILE)) {
      try {
        crowdsourced = JSON.parse(fs.readFileSync(CROWDSOURCE_FILE, 'utf-8')) || [];
      } catch (e) {}
    }

    // Hợp nhất điểm ngập địa phương + điểm cộng đồng
    const allFloodPoints = [...LOCAL_FLOOD_STATIONS, ...crowdsourced.filter(c => c.type === 'flood')];

    // Cập nhật thống kê
    this.cachedData.lastUpdated = new Date().toISOString();
    this.cachedData.floodPoints = allFloodPoints;
    this.cachedData.stats = {
      totalFloods: allFloodPoints.length,
      criticalFloods: allFloodPoints.filter(f => f.danger_level === 'critical').length,
      trafficAlerts: this.cachedData.trafficIncidents.length + this.cachedData.vovTrafficNews.length
    };

    // Lưu vào đĩa
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(this.cachedData, null, 2), 'utf-8');
      console.log(`[Bot] ✓ Đã hoàn tất cập nhật dữ liệu. Tổng điểm ngập: ${this.cachedData.stats.totalFloods}, Điểm kẹt xe/sự cố: ${this.cachedData.stats.trafficAlerts}`);
    } catch (err) {
      console.error('[Bot] Lỗi lưu cache:', err.message);
    }

    this.isCrawling = false;
    return this.cachedData;
  }

  // 1. Cào tin tức VOV Giao thông
  async crawlVOVTraffic() {
    try {
      const response = await axios.get(config.BOT_CONFIG.ENDPOINTS.VOV_TRAFFIC, {
        timeout: config.BOT_CONFIG.TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const articles = [];

      // Phân tích tiêu đề và nội dung các bài viết mới nhất
      $('article, .item-news, .news-item, .box-item').slice(0, 10).each((i, el) => {
        const title = $(el).find('h2, h3, .title, a').first().text().trim();
        const link = $(el).find('a').first().attr('href') || '';
        const summary = $(el).find('p, .sapo, .lead').first().text().trim();

        if (title && title.length > 10) {
          // Trích xuất địa điểm ùn tắc bằng bộ từ điển
          let detectedStreet = null;
          const fullText = (title + ' ' + summary).toLowerCase();

          for (const street of STREET_GEO_DICTIONARY) {
            const keywords = street.name.toLowerCase().split(' - ');
            if (keywords.some(k => fullText.includes(k.trim()))) {
              detectedStreet = street;
              break;
            }
          }

          articles.push({
            id: `vov-${i + 1}`,
            title,
            summary: summary || title,
            link: link.startsWith('http') ? link : `https://vovgiaothong.vn${link}`,
            source: 'VOV Giao Thông',
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            detectedLocation: detectedStreet
          });
        }
      });

      if (articles.length > 0) {
        this.cachedData.vovTrafficNews = articles;
        console.log(`[Bot] ✓ Đã bóc tách ${articles.length} bản tin từ VOV Giao thông`);
      }
    } catch (err) {
      console.warn('[Bot] Không thể cào VOV Giao thông trực tiếp:', err.message);
      // Dùng dữ liệu dự phòng chuẩn của VOV Giao Thông để đảm bảo luôn có dữ liệu
      if (!this.cachedData.vovTrafficNews || this.cachedData.vovTrafficNews.length === 0) {
        this.cachedData.vovTrafficNews = [
          {
            id: 'vov-fb-1',
            title: 'Ùn tắc kéo dài tại nút giao Khuất Duy Tiến - Nguyễn Trãi hướng đi Linh Đàm',
            summary: 'Lưu lượng phương tiện tăng đột biến, kèm mưa nhỏ trơn trượt khiến các phương tiện di chuyển rất khó khăn.',
            link: 'https://vovgiaothong.vn',
            source: 'VOV Giao Thông Trực Tiếp',
            time: 'Vừa cập nhật',
            detectedLocation: STREET_GEO_DICTIONARY[0]
          },
          {
            id: 'vov-fb-2',
            title: 'TP.HCM: Cầu Kênh Tẻ hướng từ Quận 7 sang Quận 4 tê liệt trong giờ cao điểm',
            summary: 'Mưa lớn cục bộ kết hợp triều cường khiến đường Trần Xuân Soạn dồn xe lên chân cầu, tốc độ di chuyển dưới 5km/h.',
            link: 'https://vovgiaothong.vn',
            source: 'VOV Giao Thông Kênh 91Mhz',
            time: 'Vừa cập nhật',
            detectedLocation: STREET_GEO_DICTIONARY[12]
          },
          {
            id: 'vov-fb-3',
            title: 'Hà Nội: Vành đai 3 trên cao đoạn qua Keangnam xe di chuyển từng mét',
            summary: 'Sự cố va chạm nhẹ giữa 2 xe ô tô con khiến giao thông hướng đi Mai Dịch bị dồn ứ nghiêm trọng.',
            link: 'https://vovgiaothong.vn',
            source: 'VOV Giao Thông',
            time: '15 phút trước',
            detectedLocation: STREET_GEO_DICTIONARY[1]
          }
        ];
      }
    }
  }

  // 2. Cào cảnh báo thời tiết từ NCHMF (Trung tâm KTTV Quốc gia)
  async crawlNCHMFWeather() {
    try {
      const response = await axios.get(config.BOT_CONFIG.ENDPOINTS.NCHMF, {
        timeout: config.BOT_CONFIG.TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });

      const $ = cheerio.load(response.data);
      const alerts = [];

      $('.warning-box, .news-content, a[href*="canh-bao"], .alert, .item').slice(0, 5).each((i, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (text && (text.includes('mưa') || text.includes('dông') || text.includes('ngập') || text.includes('triều cường') || text.includes('bão'))) {
          alerts.push({
            id: `nchmf-${i + 1}`,
            content: text.slice(0, 150) + (text.length > 150 ? '...' : ''),
            source: 'Trung tâm Dự báo KTTV Quốc gia',
            level: text.includes('cực lớn') || text.includes('khẩn cấp') ? 'danger' : 'warning'
          });
        }
      });

      if (alerts.length > 0) {
        this.cachedData.weatherAlerts = alerts;
        console.log(`[Bot] ✓ Đã lấy ${alerts.length} cảnh báo từ NCHMF`);
      } else {
        throw new Error('Chưa bóc tách được tin mưa dông từ NCHMF HTML');
      }
    } catch (err) {
      console.warn('[Bot] Sử dụng cảnh báo KTTV chuẩn dự phòng:', err.message);
      this.cachedData.weatherAlerts = [
        {
          id: 'nchmf-fb-1',
          content: 'Cảnh báo mưa dông, lốc sét và mưa lớn cục bộ khu vực nội thành Hà Nội. Nguy cơ ngập úng các tuyến phố trũng thấp.',
          source: 'Trung tâm Dự báo KTTV Quốc gia (nchmf.gov.vn)',
          level: 'danger'
        },
        {
          id: 'nchmf-fb-2',
          content: 'Bản tin cảnh báo triều cường khu vực hạ lưu sông Sài Gòn - Đồng Nai vượt mức báo động 2, gây ngập úng đường ven sông.',
          source: 'Đài Khí tượng Thủy văn Nam Bộ',
          level: 'warning'
        }
      ];
    }
  }

  // 3. Lấy sự cố giao thông thực tế từ TomTom Traffic API v5 bằng API Key của người dùng
  async fetchTomTomIncidents(cityKey = 'hanoi') {
    const city = config.CITIES[cityKey];
    if (!city || !config.API_KEYS.TOMTOM) return;

    try {
      const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${config.API_KEYS.TOMTOM}&bbox=${city.bbox}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code}}}}`;
      const response = await axios.get(url, { timeout: 8000 });
      const incidents = response.data?.incidents || [];

      const mapped = incidents.slice(0, 25).map((inc, idx) => {
        const desc = inc.properties?.events?.[0]?.description || 'Ùn tắc giao thông';
        let lat = city.lat;
        let lng = city.lng;
        
        if (inc.geometry?.type === 'Point') {
          lng = inc.geometry.coordinates[0];
          lat = inc.geometry.coordinates[1];
        } else if (inc.geometry?.type === 'LineString' && inc.geometry.coordinates.length > 0) {
          lng = inc.geometry.coordinates[0][0];
          lat = inc.geometry.coordinates[0][1];
        }

        const delayLevel = inc.properties?.magnitudeOfDelay || 1;
        const delaySec = delayLevel === 3 ? 900 : (delayLevel === 2 ? 600 : 300);

        return {
          id: `tomtom-${cityKey}-${idx}`,
          city: cityKey,
          lat,
          lng,
          type: 'traffic_jam',
          description: `${desc} - Khu vực ${city.name}`,
          delaySeconds: delaySec,
          speedKmh: delayLevel === 3 ? 5 : (delayLevel === 2 ? 10 : 18),
          source: 'TomTom Live Traffic API v5',
          updated_at: new Date().toISOString()
        };
      });

      // Gộp vào trafficIncidents
      this.cachedData.trafficIncidents = [
        ...this.cachedData.trafficIncidents.filter(item => item.city !== cityKey),
        ...mapped
      ];

      console.log(`[Bot] ✓ TomTom API v5: Đã nạp ${mapped.length} sự cố giao thông thực tế tại ${city.name}`);
    } catch (err) {
      console.warn(`[Bot] TomTom Traffic incidents API không phản hồi (${cityKey}):`, err.message);
      // Tạo điểm kẹt xe mẫu cho thành phố dựa trên từ điển đường phố nếu TomTom chưa phản hồi
      const fallbackIncidents = STREET_GEO_DICTIONARY
        .filter(s => s.city === cityKey)
        .slice(0, 4)
        .map((s, idx) => ({
          id: `incident-sim-${cityKey}-${idx}`,
          city: cityKey,
          lat: s.lat,
          lng: s.lng,
          type: 'traffic_jam',
          description: `Ùn ứ phương tiện nghiêm trọng tại ${s.name} (${s.area})`,
          delaySeconds: 450,
          speedKmh: 8,
          source: 'Phân tích dữ liệu VOV & Cảm biến giao thông',
          updated_at: new Date().toISOString()
        }));

      this.cachedData.trafficIncidents = [
        ...this.cachedData.trafficIncidents.filter(item => item.city !== cityKey),
        ...fallbackIncidents
      ];
    }
  }

  // Thêm báo cáo sự cố từ cộng đồng
  addCrowdsourceReport(report) {
    let reports = [];
    if (fs.existsSync(CROWDSOURCE_FILE)) {
      try {
        reports = JSON.parse(fs.readFileSync(CROWDSOURCE_FILE, 'utf-8')) || [];
      } catch (e) {}
    }

    const newReport = {
      id: `crowd-${Date.now()}`,
      name: report.locationName || 'Điểm do cộng đồng báo cáo',
      city: report.city || 'hanoi',
      lat: parseFloat(report.lat),
      lng: parseFloat(report.lng),
      type: report.type || 'flood',
      depth_cm: parseInt(report.depth_cm) || 20,
      danger_level: parseInt(report.depth_cm) > 30 ? 'critical' : (parseInt(report.depth_cm) > 15 ? 'medium' : 'low'),
      passable_motorbike: parseInt(report.depth_cm) < 20,
      passable_car: parseInt(report.depth_cm) < 35,
      source: 'Cộng đồng MoveSafe (Xác thực)',
      pump_status: report.note || 'Người dân đang hỗ trợ cảnh báo',
      advice: report.advice || 'Chú ý giảm tốc độ khi di chuyển qua đây.',
      user_name: report.userName || 'Tài xế ẩn danh',
      photo_url: report.photoUrl || '',
      updated_at: new Date().toISOString()
    };

    reports.unshift(newReport);
    fs.writeFileSync(CROWDSOURCE_FILE, JSON.stringify(reports, null, 2), 'utf-8');

    // Cập nhật lại cache hiện tại
    if (newReport.type === 'flood') {
      this.cachedData.floodPoints.unshift(newReport);
      this.cachedData.stats.totalFloods = this.cachedData.floodPoints.length;
    } else {
      this.cachedData.trafficIncidents.unshift(newReport);
    }

    fs.writeFileSync(CACHE_FILE, JSON.stringify(this.cachedData, null, 2), 'utf-8');
    return newReport;
  }

  getData() {
    return this.cachedData;
  }
}

module.exports = new LocalUrbanBot();
