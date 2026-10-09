# guest/chat

닉네임만 정하면 같은 방의 사람들과 실시간으로 대화하는 휘발성 게스트 채팅입니다. 계정 없이 입장하고, 닉네임이나 메시지를 데이터베이스에 저장하지 않습니다.

## 기능

- 기본 대화방 선택, 새 방 만들기, 공유 링크로 같은 방 입장
- Supabase Realtime Broadcast로 메시지 전달, Presence로 현재 방 접속자 수 표시
- 닉네임은 메모리와 현재 Realtime Presence에만 일시적으로 사용하며 localStorage/sessionStorage/데이터베이스에 저장하지 않음
- 알림 버튼을 직접 눌러 권한을 허용하면 같은 방의 새 메시지를 이 기기의 시스템 알림으로 표시
- 설치용 PWA manifest와 service worker, 모바일 반응형 화면

## Supabase

연결된 Supabase 프로젝트는 `guestchat` (`losuyalyjcurntylbwgy`, ap-southeast-1)입니다. 앱은 Supabase Realtime **Broadcast**와 **Presence**만 사용합니다. `public` 데이터베이스 테이블이나 채팅 기록은 만들지 않습니다. `supabase-config.js`에는 이 프로젝트의 브라우저 공개 Project URL과 publishable key만 둡니다. service_role/secret 키는 절대 브라우저에 넣지 마세요.

각 방은 `guestchat-room-<room-id>` Realtime 채널을 씁니다. 기본 방은 모두에게 미리 제공되며, 새로 만든 방은 초대 링크의 `room` 파라미터로 전달됩니다. 새로고침하거나 탭을 닫으면 이전 대화는 복구되지 않습니다.

## 알림 및 모바일 주의사항

웹 알림은 각 기기에서 사용자가 직접 **알림 켜기**를 눌러 허용해야 합니다. 앱이 열려 있고 Realtime에 연결되어 메시지를 수신하는 동안 Notification API 또는 service worker 알림을 표시합니다. 이 구현에는 푸시 구독 저장 및 서버 푸시 발송이 없으므로 브라우저가 닫혀 있거나 OS가 앱/연결을 중단한 동안에는 알림이 보장되지 않습니다.

Android는 HTTPS 브라우저에서 권한을 허용하면 사용할 수 있습니다. iPhone/iPad는 지원 OS에서 사이트를 홈 화면에 추가한 웹 앱으로 열고 그 안에서 알림 권한을 허용해야 할 수 있습니다. OS/브라우저별 정책에 따라 동작이 달라질 수 있습니다.

## GitHub Pages 배포

저장소의 **Settings → Pages → Deploy from a branch → `main` / `(root)`**를 선택합니다. 빌드 도구나 백엔드 서버는 필요하지 않습니다. `.nojekyll`이 포함되어 있습니다. HTTPS가 적용된 Pages 주소에서 서비스 워커와 Notification API를 사용하세요.
