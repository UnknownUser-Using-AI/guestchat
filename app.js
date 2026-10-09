(() => {
  const $ = (selector) => document.querySelector(selector);
  const entryView = $('#entryView');
  const chatView = $('#chatView');
  const nicknameForm = $('#nicknameForm');
  const nicknameInput = $('#nicknameInput');
  const nicknameCount = $('#nicknameCount');
  const nicknameError = $('#nicknameError');
  const setupNotice = $('#setupNotice');
  const currentNickname = $('#currentNickname');
  const currentAvatar = $('#currentAvatar');
  const currentRoomLabel = $('#currentRoomLabel');
  const headerRoomLabel = $('#headerRoomLabel');
  const roomIndex = $('#roomIndex');
  const roomList = $('#roomList');
  const roomCountLabel = $('#roomCountLabel');
  const entryRoomSelect = $('#entryRoomSelect');
  const newRoomInput = $('#newRoomInput');
  const roomHint = $('#roomHint');
  const shareRoomButton = $('#shareRoomButton');
  const changeNicknameButton = $('#changeNicknameButton');
  const resetChatButton = $('#resetChatButton');
  const notificationButton = $('#notificationButton');
  const notificationNote = $('#notificationNote');
  const messageForm = $('#messageForm');
  const messageInput = $('#messageInput');
  const messageCount = $('#messageCount');
  const messageError = $('#messageError');
  const messageList = $('#messageList');
  const messageArea = $('#messageArea');
  const participantCount = $('#participantCount');
  const connectionState = $('#connectionState');

  const DEFAULT_ROOMS = [
    { id: 'lounge', name: '잠깐의 라운지', icon: '◌' },
    { id: 'studio', name: '아이디어 작업실', icon: '✳' },
    { id: 'night', name: '느린 밤', icon: '☾' },
    { id: 'hobby', name: '취미 수다', icon: '✦' },
  ];
  const clientId = globalThis.crypto?.randomUUID?.() || `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const config = window.GUESTCHAT_SUPABASE_CONFIG || {};
  const hasSupabaseConfig = Boolean(config.url && config.anonKey && !String(config.url).includes('YOUR_') && !String(config.anonKey).includes('YOUR_'));
  const supabaseClient = hasSupabaseConfig && window.supabase?.createClient
    ? window.supabase.createClient(config.url, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    : null;

  let activeNickname = '';
  let isConnected = false;
  let currentRoom = null;
  let channel = null;
  let messages = [];
  let rooms = [...DEFAULT_ROOMS];
  let serviceWorkerReady = null;

  const updateCount = (input, output, max) => { output.textContent = `${input.value.length}/${max}`; };
  const initials = (nickname) => (nickname.trim().split(/\s+/).map((word) => word[0]).join('') || nickname.slice(0, 2)).slice(0, 2).toUpperCase();
  const formatTime = (timestamp) => new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(timestamp || Date.now()));
  const escapeText = (value) => String(value).replace(/[&<>\'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const setConnectionState = (label, online) => {
    connectionState.innerHTML = `<i class="status-dot"></i> ${escapeText(label)}`;
    connectionState.classList.toggle('detail-accent', Boolean(online));
    isConnected = Boolean(online);
  };
  const showSetupNotice = (text) => { setupNotice.textContent = text; setupNotice.classList.remove('is-hidden'); };
  const hideSetupNotice = () => { setupNotice.textContent = ''; setupNotice.classList.add('is-hidden'); };
  const showNicknameError = (text) => { nicknameError.textContent = text; nicknameInput.setAttribute('aria-invalid', text ? 'true' : 'false'); };
  const showMessageError = (text) => { messageError.textContent = text; messageInput.setAttribute('aria-invalid', text ? 'true' : 'false'); };
  const toRoomId = (name) => {
    const bytes = new TextEncoder().encode(name.trim());
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '').toLowerCase();
  };

  const syncRoomUrl = (room) => {
    const url = new URL(window.location.href);
    if (DEFAULT_ROOMS.some((item) => item.id === room.id)) url.searchParams.delete('room');
    else url.searchParams.set('room', room.name);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const requestedRoomName = new URLSearchParams(window.location.search).get('room')?.trim();
  if (requestedRoomName && requestedRoomName.length <= 24 && !DEFAULT_ROOMS.some((room) => room.name === requestedRoomName)) {
    rooms.push({ id: toRoomId(requestedRoomName), name: requestedRoomName, icon: '✦', custom: true });
  }

  const renderRooms = () => {
    roomList.innerHTML = rooms.map((room, index) => `
      <button class="room-option ${currentRoom?.id === room.id ? 'is-active' : ''}" type="button" data-room-id="${escapeText(room.id)}" aria-current="${currentRoom?.id === room.id ? 'page' : 'false'}">
        <span class="room-option-icon" aria-hidden="true">${escapeText(room.icon)}</span>
        <span class="room-option-name">${escapeText(room.name)}</span>
        ${currentRoom?.id === room.id ? '<span class="room-live-dot" aria-label="현재 방"></span>' : ''}
      </button>`).join('');
    roomCountLabel.textContent = `${String(rooms.length).padStart(2, '0')} ROOMS`;
    entryRoomSelect.innerHTML = rooms.map((room) => `<option value="${escapeText(room.id)}">${escapeText(room.name)}</option>`).join('');
    if (currentRoom) entryRoomSelect.value = currentRoom.id;
  };

  const renderMessages = () => {
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
    if (!channel) { participantCount.textContent = '0명'; return; }
    participantCount.textContent = `${Object.keys(channel.presenceState()).length}명`;
  };

  const notifyIncomingMessage = async (message) => {
    if (message.uid === clientId || !('Notification' in window) || Notification.permission !== 'granted') return;
    const title = `${message.nickname || '게스트'} · ${currentRoom?.name || '대화방'}`;
    const options = {
      body: message.text,
      icon: new URL('icon.svg', document.baseURI).href,
      tag: `guestchat-${message.id}`,
      renotify: false,
      data: { url: window.location.href },
    };
    try {
      if (serviceWorkerReady) {
        const registration = await serviceWorkerReady;
        await registration.showNotification(title, options);
      } else {
        new Notification(title, options);
      }
    } catch (error) {
      console.warn('Notification could not be shown.', error);
    }
  };

  const addIncomingMessage = (message) => {
    if (!message?.id || !message.text || messages.some((item) => item.id === message.id)) return;
    const normalized = { ...message, text: String(message.text).slice(0, 240), nickname: String(message.nickname || 'guest').slice(0, 18) };
    messages.push(normalized);
    renderMessages();
    void notifyIncomingMessage(normalized);
  };

  const disconnectRoom = async () => {
    const previous = channel;
    channel = null;
    isConnected = false;
    if (previous && supabaseClient) {
      try { await supabaseClient.removeChannel(previous); } catch (error) { console.warn('Room disconnect failed.', error); }
    }
  };

  const joinRoom = async (room) => {
    currentRoom = room;
    messages = [];
    renderMessages();
    currentRoomLabel.textContent = room.name;
    headerRoomLabel.textContent = room.name;
    $('#chatTitle').textContent = room.name;
    roomIndex.textContent = `ROOM ${String(rooms.findIndex((item) => item.id === room.id) + 1).padStart(2, '0')}`;
    participantCount.textContent = '0명';
    syncRoomUrl(room);
    renderRooms();
    await disconnectRoom();

    if (!supabaseClient) {
      setConnectionState('설정 필요', false);
      showSetupNotice('Supabase 설정을 불러오지 못했어요. 프로젝트 URL과 공개 키를 확인해 주세요.');
      return;
    }
    hideSetupNotice();
    setConnectionState('연결 중', false);
    const roomChannelName = `guestchat-room-${room.id}`;
    const roomChannel = supabaseClient.channel(roomChannelName, {
      config: { broadcast: { self: true }, presence: { key: clientId } },
    });
    channel = roomChannel;
    roomChannel
      .on('broadcast', { event: 'message' }, ({ payload }) => addIncomingMessage(payload))
      .on('presence', { event: 'sync' }, updateParticipantCount)
      .on('presence', { event: 'join' }, updateParticipantCount)
      .on('presence', { event: 'leave' }, updateParticipantCount)
      .subscribe(async (status) => {
        if (channel !== roomChannel) return;
        if (status === 'SUBSCRIBED') {
          setConnectionState('연결됨', true);
          const tracked = await roomChannel.track({ nickname: activeNickname, joinedAt: Date.now() });
          if (tracked && tracked !== 'ok') console.warn('Presence tracking returned:', tracked);
          updateParticipantCount();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnectionState('연결 실패', false);
          showSetupNotice('실시간 연결을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.');
        }
      });
  };

  const setNotificationStatus = () => {
    if (!('Notification' in window)) {
      notificationButton.textContent = '알림 미지원';
      notificationButton.disabled = true;
      notificationNote.textContent = '이 브라우저는 웹 알림을 지원하지 않아요.';
      return;
    }
    if (Notification.permission === 'granted') {
      notificationButton.textContent = '알림 켜짐';
      notificationButton.setAttribute('aria-pressed', 'true');
      notificationNote.textContent = '이 기기에서 다른 게스트의 새 메시지를 알려드려요. 방에 연결된 동안 동작합니다.';
    } else if (Notification.permission === 'denied') {
      notificationButton.textContent = '알림 차단됨';
      notificationButton.setAttribute('aria-pressed', 'false');
      notificationNote.textContent = '브라우저 설정에서 이 사이트의 알림을 허용해야 켤 수 있어요.';
    } else {
      notificationButton.textContent = '알림 켜기';
      notificationButton.setAttribute('aria-pressed', 'false');
      notificationNote.textContent = '알림은 이 기기에서 권한을 허용하고 방에 연결되어 있을 때 받을 수 있어요.';
    }
  };

  const registerServiceWorker = () => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    serviceWorkerReady = navigator.serviceWorker.register('./service-worker.js').then(() => navigator.serviceWorker.ready).catch((error) => {
      console.warn('Service worker registration failed.', error);
      return null;
    });
  };

  nicknameInput.addEventListener('input', () => {
    updateCount(nicknameInput, nicknameCount, 18);
    if (nicknameInput.value.trim()) showNicknameError('');
  });

  nicknameForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const nickname = nicknameInput.value.trim();
    if (!nickname) return showNicknameError('닉네임을 한 글자 이상 입력해 주세요.');
    if (nickname.length > 18) return showNicknameError('닉네임은 18자 안에서 정해 주세요.');
    const room = rooms.find((item) => item.id === entryRoomSelect.value) || rooms[0];
    activeNickname = nickname;
    currentNickname.textContent = activeNickname;
    currentAvatar.textContent = initials(activeNickname);
    entryView.classList.add('is-hidden');
    chatView.classList.remove('is-hidden');
    renderRooms();
    await joinRoom(room);
    messageInput.focus();
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
    if (!channel || !isConnected) return showMessageError('실시간 방에 연결된 뒤 메시지를 보낼 수 있어요.');
    const payload = { id: `${clientId}-${Date.now()}`, uid: clientId, nickname: activeNickname, text, createdAt: Date.now() };
    const activeChannel = channel;
    const result = await activeChannel.send({ type: 'broadcast', event: 'message', payload });
    if (result !== 'ok') return showMessageError('메시지를 보내지 못했어요. 연결을 확인해 주세요.');
    messageInput.value = '';
    messageInput.style.height = 'auto';
    updateCount(messageInput, messageCount, 240);
    showMessageError('');
  });

  roomList.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-room-id]');
    if (!button) return;
    const nextRoom = rooms.find((room) => room.id === button.dataset.roomId);
    if (!nextRoom || nextRoom.id === currentRoom?.id) return;
    await joinRoom(nextRoom);
    messageInput.focus();
  });

  $('#createRoomForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = newRoomInput.value.trim().replace(/\s+/g, ' ');
    if (!name) { roomHint.textContent = '방 이름을 입력해 주세요.'; return; }
    if (name.length > 24) { roomHint.textContent = '방 이름은 24자 이내로 입력해 주세요.'; return; }
    let room = rooms.find((item) => item.name.toLowerCase() === name.toLowerCase());
    if (!room) {
      room = { id: toRoomId(name), name, icon: '✦', custom: true };
      rooms.push(room);
    }
    newRoomInput.value = '';
    roomHint.textContent = '새 방을 열었어요. 초대 링크를 복사해 공유해 보세요.';
    await joinRoom(room);
  });

  shareRoomButton.addEventListener('click', async () => {
    if (!currentRoom) return;
    const url = new URL(window.location.href);
    if (DEFAULT_ROOMS.some((room) => room.id === currentRoom.id)) url.searchParams.delete('room');
    else url.searchParams.set('room', currentRoom.name);
    try {
      await navigator.clipboard.writeText(url.toString());
      roomHint.textContent = '초대 링크를 복사했어요.';
    } catch {
      roomHint.textContent = url.toString();
    }
  });

  notificationButton.addEventListener('click', async () => {
    if (!('Notification' in window)) return setNotificationStatus();
    if (Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch (error) { console.warn('Notification permission request failed.', error); }
    }
    setNotificationStatus();
    if (Notification.permission === 'granted') {
      try {
        if (serviceWorkerReady) (await serviceWorkerReady)?.showNotification('guest/chat 알림이 켜졌어요', { body: '이 기기에서 방의 새 메시지를 알려드릴게요.', icon: new URL('icon.svg', document.baseURI).href, tag: 'guestchat-ready' });
        else new Notification('guest/chat 알림이 켜졌어요', { body: '이 기기에서 방의 새 메시지를 알려드릴게요.' });
      } catch (error) { console.warn('Test notification failed.', error); }
    }
  });

  document.querySelectorAll('[data-message]').forEach((button) => button.addEventListener('click', () => {
    messageInput.value = button.dataset.message || '';
    messageInput.dispatchEvent(new Event('input'));
    messageInput.focus();
  }));

  changeNicknameButton.addEventListener('click', async () => {
    await disconnectRoom();
    activeNickname = '';
    currentRoom = null;
    chatView.classList.add('is-hidden');
    entryView.classList.remove('is-hidden');
    nicknameInput.value = '';
    updateCount(nicknameInput, nicknameCount, 18);
    showNicknameError('');
    nicknameInput.focus();
  });
  resetChatButton.addEventListener('click', () => { messages = []; renderMessages(); messageInput.focus(); });
  window.addEventListener('pagehide', () => { if (channel) void channel.untrack(); });
  window.addEventListener('online', () => { if (currentRoom && activeNickname) void joinRoom(currentRoom); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setNotificationStatus(); });

  renderRooms();
  if (requestedRoomName) {
    const room = rooms.find((item) => item.name === requestedRoomName);
    if (room) entryRoomSelect.value = room.id;
  }
  updateCount(nicknameInput, nicknameCount, 18);
  updateCount(messageInput, messageCount, 240);
  setConnectionState(supabaseClient ? '입장 대기' : '설정 필요', false);
  if (!supabaseClient) showSetupNotice('Supabase 설정이 필요해요. 공개 프로젝트 URL과 키를 확인해 주세요.');
  setNotificationStatus();
  registerServiceWorker();
})();
