# guest/chat

닉네임만 정하면 여러 컴퓨터에서 함께 대화할 수 있는 게스트 채팅입니다. Supabase Realtime의 **Broadcast**와 **Presence**만 사용하며 메시지·닉네임을 데이터베이스에 저장하지 않습니다.

## Supabase 설정

1. [Supabase Dashboard](https://supabase.com/dashboard)에서 프로젝트를 생성합니다.
2. **Project Settings → API**에서 `Project URL`과 `anon public` 키를 확인합니다.
3. 두 값을 `supabase-config.js`의 `url`, `anonKey`에 입력합니다. `service_role` 키는 절대 넣지 마세요.
4. Supabase Dashboard의 **Database → Replication**이나 테이블 생성은 필요하지 않습니다. 이 앱은 Realtime Broadcast만 사용합니다.
5. `index.html`, `styles.css`, `app.js`, `supabase-config.js`를 포함한 파일을 GitHub 저장소에 올립니다.

## 어떻게 다른 컴퓨터와 연결되나요?

모든 브라우저가 같은 Supabase Realtime 채널 `guestchat-main-lounge`에 접속합니다. 메시지는 WebSocket Broadcast로 연결된 사용자에게만 전달되고 데이터베이스 테이블에는 기록되지 않습니다. Presence로 현재 라운지에 접속한 게스트 수도 표시합니다.

메시지는 브라우저 메모리와 Realtime 연결 중에만 존재하며, 새로고침·탭 종료·연결 종료 시 사라집니다. 별도의 채팅 기록이나 회원 계정은 만들지 않습니다.

## GitHub Pages 배포

저장소의 **Settings → Pages → Deploy from a branch → main / (root)**를 선택하면 됩니다. 별도 빌드 도구가 필요하지 않습니다. `.nojekyll` 파일도 포함되어 있습니다.

## 참고

Supabase의 anon public 키는 웹앱에 포함되는 공개 키입니다. 보안이 필요한 데이터나 관리자 작업에는 사용하지 말고, 이 프로젝트처럼 저장하지 않는 공개 Realtime 채널에만 사용하세요.
