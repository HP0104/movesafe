/**
 * AIChat - Giao diện và logic tương tác Trợ lý AI Copilot
 */

class AIChat {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.recognition = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.initSpeech();
  }

  initSpeech() {
    // Khởi tạo nhận diện giọng nói tiếng Việt
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'vi-VN';
      this.recognition.continuous = false;
      this.recognition.interimResults = false;

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('[Voice] Nhận diện được:', transcript);
        const searchInput = document.getElementById('search-input');
        const chatInput = document.getElementById('ai-chat-input');
        if (searchInput) searchInput.value = transcript;
        if (chatInput) chatInput.value = transcript;

        // Tự động gửi câu hỏi vào AI
        this.open();
        this.sendMessage(transcript);
        this.stopListening();
      };

      this.recognition.onerror = () => this.stopListening();
      this.recognition.onend = () => this.stopListening();
    }
  }

  toggleVoiceSearch() {
    if (!this.recognition) {
      alert('Trình duyệt của bạn chưa hỗ trợ nhận diện giọng nói Web Speech API.');
      return;
    }
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  startListening() {
    if (!this.recognition) return;
    this.isListening = true;
    document.querySelectorAll('.btn-voice').forEach(btn => btn.classList.add('mic-active'));
    try {
      this.recognition.start();
    } catch (e) {}
  }

  stopListening() {
    this.isListening = false;
    document.querySelectorAll('.btn-voice').forEach(btn => btn.classList.remove('mic-active'));
    try {
      if (this.recognition) this.recognition.stop();
    } catch (e) {}
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    this.isOpen = true;
    const win = document.getElementById('ai-chat-window');
    if (win) win.classList.add('open');
    if (this.messages.length === 0) {
      this.addBotMessage(`Xin chào! Tôi là **Trợ lý AI MoveSafe** 🤖.\nTôi theo dõi mực nước trạm đo HSDC, UDi Maps và kẹt xe TomTom.\nBạn cần tôi tư vấn tuyến đường khô ráo hay kiểm tra rốn ngập nào?`);
    }
  }

  close() {
    this.isOpen = false;
    const win = document.getElementById('ai-chat-window');
    if (win) win.classList.remove('open');
  }

  clearMessages() {
    this.messages = [];
    this.renderMessages();
  }

  addUserMessage(text) {
    this.messages.push({ sender: 'user', text });
    this.renderMessages();
  }

  addBotMessage(text) {
    this.messages.push({ sender: 'bot', text });
    this.renderMessages();
  }

  renderMessages() {
    const body = document.getElementById('ai-chat-body');
    if (!body) return;

    body.innerHTML = this.messages.map(m => `
      <div class="gm-chat-bubble ${m.sender === 'user' ? 'gm-bubble-user' : 'gm-bubble-bot'}">
        ${m.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
      </div>
    `).join('');

    body.scrollTop = body.scrollHeight;
  }

  async sendMessage(queryText) {
    const input = document.getElementById('ai-chat-input');
    const query = queryText || (input ? input.value.trim() : '');
    if (!query) return;

    if (input) input.value = '';
    this.addUserMessage(query);

    // Hiển thị đang suy nghĩ
    this.addBotMessage('⏳ *Đang phân tích dữ liệu thời gian thực...*');

    try {
      const currentCity = window.appState ? window.appState.currentCity : 'hanoi';
      const geminiKey = localStorage.getItem('movesafe_gemini_key') || '';

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, city: currentCity, apiKey: geminiKey })
      });

      const data = await res.json();
      // Xóa tin nhắn chờ
      this.messages.pop();

      if (data.status === 'success' && data.response) {
        this.addBotMessage(data.response.text);

        // Thực hiện hành động trên bản đồ nếu có
        if (data.response.action && window.mapEngine) {
          const act = data.response.action;
          if (act.type === 'FOCUS_POINT' && act.lat && act.lng) {
            window.appState.switchMode('map');
            window.mapEngine.map.flyTo([act.lat, act.lng], 16);
          } else if (act.type === 'SHOW_FLOOD_LAYER') {
            window.appState.switchMode('map');
          }
        }
      } else {
        this.addBotMessage('Có lỗi khi xử lý câu hỏi. Vui lòng thử lại.');
      }
    } catch (err) {
      this.messages.pop();
      this.addBotMessage('Không thể kết nối đến máy chủ AI. Đang hiển thị phân tích dự phòng: Tuyến đường của bạn cần chú ý các rốn ngập sâu trên 20cm.');
    }
  }
}

window.aiChat = new AIChat();
