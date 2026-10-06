(() => {
  const entryView = document.querySelector('#entryView');
  const chatView = document.querySelector('#chatView');
  const nicknameForm = document.querySelector('#nicknameForm');
  const nicknameInput = document.querySelector('#nicknameInput');
  const nicknameCount = document.querySelector('#nicknameCount');
  const nicknameError = document.querySelector('#nicknameError');
  const setupNotice = document.querySelector('#setupNotice');
  const currentNickname = document.querySelector('#currentNickname');
  const currentAvatar = document.querySelector('#currentAvatar');
  const changeNicknameButton = document.querySelector('#changeNicknameButton');
  const resetChatButton = document.querySelector('#resetChatButton');
  const messageForm = document.querySelector('#messageForm');
  const messageInput = document.querySelector('#messageInput');
  const messageCount = document.querySelector('#messageCount');
  const messageError = document.querySelector('#messageError');
  const messageList = document.querySelector('#messageList');
  const messageArea = document.querySelector('#messageArea');
  const participantCount = document.querySelector('#participantCount');
  const connectionState = document.querySelector('#connectionState');

  const CHANNEL_NAME = 'guestchat-main-lounge';
  const MESSAGE_TTL = 60 * 60 * 1000;
  const config = window.GUESTCHAT_SUPABASE_CONFIG || {};
  const clientId = globalThis.crypto?.randomUUID?.() || `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let activeNickname = '';
  let channel = null;
  let messages = [];
  let isConnected = false;

  const hasSupabaseConfig = Boolean(
    config.url && config.anonKey &&
    !String(config.url).includes('YOUR_') &&
    !String(config.anonKey).includes('YOUR_')
  );

  const updateCount = (input, output, max) => { output.textContent = `${input.value.length}/${max}`; };
  const initials = (nickname) => (nickname.trim().split(/\s+/).map((word) => word[0]).join('') || nickname.slice(0, 2)).slice(0, 2).toUpperCase();
  const formatTime = (timestamp) => new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(timestamp || Date.now()));
  const escapeText = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

  const setConnectionState = (label, online) => {
    connectionState.innerHTML = `<i class="status-dot"></i> ${escapeText(label)}`;
    connectionState.classList.toggle('detail-accent', Boolean(online));
  };
  const showSetupNotice = (text) => { setupNotice.textContent = text; setupNotice.classList.remove('is-hidden'); };
  const hideSetupNotice = () => { setupNotice.textContent = ''; setupNotice.classList.add('is-hidden'); };
  const showNicknameError = (text) => { nicknameError.textContent = text; nicknameInput.setAttribute('aria-invalid', text ? 'true' : 'false'); };
  const showMessageError = (text) => { messageError.textContent = text; messageInput.setAttribute('aria-invalid', text ? 'true' : 'false'); };

  const renderMessages = () => {
    const now = Date.now();
    messages = messages.filter((message) => !message.expiresAt || message.expiresAt > now);
    messageList.innerHTML = messages.map((message) => {
      const own = message.uid === clientId;
      const nickname = message.nickname || 'guest';
      return `<article class="message ${own ? 'is-own' : ''}">
        ${own ? '' : `<div class="avatar" aria-hidden="true">${escapeText(initials(nickname))}</div>`}
        <div><div class="message-meta"><span>${escapeText(nickname)}</span><span class="message-time">${escapeText(formatTime(message.createdAt))}</span></div>
        <div class="message-bubble">${escapeText(message.text)}</div></div></article>`;
    }).join('');
    messageArea.scrollTo({ top: messageArea.scrollHeight, behavior: 'smooth' });
  };

  const updateParticipantCount = () => {
    if (!channel) return;
    const state = channel.presenceState();
    participantCount.textContent = `${Object.keys(state).length}명`;
  };

  const addIncomingMessage = (message) => {
    if (!message?.id || !message.text || messages.some((item) => item.id === message.id)) return;
    if (message.expiresAt && message.expiresAt <= Date.now()) return;
    messages.push(message);
    messages.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    renderMessages();
  };

  const connectSupabase = () => {
    if (!hasSupabaseConfig || !window.supabase?.createClient) {
      setConnectionState('설정 필요', false);
      showSetupNotice('Supabase 설정이 아직 없어요. supabase-config.js에 URL과 anon key를 넣어 주세요.');
      return;
    }
    try {
      const supabase = window.supabase.createClient(config.url, config.anonKey, { auth: { persistSession: false } });
      channel = supabase.channel(CHANNEL_NAME, { config: { broadcast: { self: true }, presence: { key: clientId } } });
      channel
        .on('broadcast', { event: 'message' }, ({ payload }) => addIncomingMessage(payload))
        .on('presence', { event: 'sync' }, updateParticipantCount)
        .on('presence', { event: 'join' }, updateParticipantCount)
        .on('presence', { event: 'leave' }, updateParticipantCount)
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            isConnected = true;
            setConnectionState('연결됨', true);
            hideSetupNotice();
            if (activeNickname) await channel.track({ nickname: activeNickname, joinedAt: Date.now() });
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            isConnected = false;
            setConnectionState('연결 실패', false);
            showSetupNotice('Supabase Realtime에 연결하지 못했어요. URL과 anon key를 확인해 주세요.');
          }
        });
    } catch (error) {
      console.error(error);
      setConnectionState('연결 실패', false);
      showSetupNotice('Supabase 설정을 읽지 못했어요.');
    }
  };

  const enterChat = async () => {
    activeNickname = nicknameInput.value.trim();
    currentNickname.textContent = activeNickname;
    currentAvatar.textContent = initials(activeNickname);
    entryView.classList.add('is-hidden');
    chatView.classList.remove('is-hidden');
    if (channel) await channel.track({ nickname: activeNickname, joinedAt: Date.now() });
    messageInput.focus();
  };

  const leaveChatForNicknameEdit = async () => {
    if (channel) await channel.untrack();
    nicknameInput.value = activeNickname;
    updateCount(nicknameInput, nicknameCount, 18);
    showNicknameError('');
    chatView.classList.add('is-hidden');
    entryView.classList.remove('is-hidden');
    nicknameInput.focus();
  };

  nicknameInput.addEventListener('input', () => { updateCount(nicknameInput, nicknameCount, 18); if (nicknameInput.value.trim()) showNicknameError(''); });
  nicknameForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const nickname = nicknameInput.value.trim();
    if (!isConnected) return showNicknameError('실시간 서버에 연결된 뒤 입장할 수 있어요.');
    if (!nickname) return showNicknameError('닉네임을 한 글자 이상 입력해 주세요.');
    if (nickname.length > 18) return showNicknameError('닉네임은 18자 안에서 정해 주세요.');
    showNicknameError('');
    enterChat();
  });

  messageInput.addEventListener('input', () => {
    updateCount(messageInput, messageCount, 240);
    messageInput.style.height = 'auto';
    messageInput.style.height = `${Math.min(messageInput.scrollHeight, 110)}px`;
    if (messageInput.value.trim()) showMessageError('');
  });
  messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); messageForm.requestSubmit(); }
  });
  messageForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return showMessageError('메시지를 입력한 뒤 보내 주세요.');
    if (!channel || !isConnected) return showMessageError('아직 실시간 연결 중이에요.');
    const payload = { id: `${clientId}-${Date.now()}`, uid: clientId, nickname: activeNickname, text, createdAt: Date.now(), expiresAt: Date.now() + MESSAGE_TTL };
    const result = await channel.send({ type: 'broadcast', event: 'message', payload });
    if (result !== 'ok') return showMessageError('메시지를 보내지 못했어요.');
    messageInput.value = '';
    messageInput.style.height = 'auto';
    updateCount(messageInput, messageCount, 240);
    showMessageError('');
  });

  document.querySelectorAll('[data-message]').forEach((button) => button.addEventListener('click', () => {
    messageInput.value = button.dataset.message || '';
    messageInput.dispatchEvent(new Event('input'));
    messageInput.focus();
  }));
  changeNicknameButton.addEventListener('click', leaveChatForNicknameEdit);
  resetChatButton.addEventListener('click', () => { messages = []; renderMessages(); messageInput.focus(); });
  window.addEventListener('beforeunload', () => { if (channel) channel.untrack(); });

  updateCount(nicknameInput, nicknameCount, 18);
  updateCount(messageInput, messageCount, 240);
  setConnectionState('연결 중', false);
  connectSupabase();
})();
