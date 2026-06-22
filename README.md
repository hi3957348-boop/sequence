# 단어 카드 게임

선생님이 단어/문장 카드 게임을 만들고, 학생들이 게임 코드로 참여할 수 있는 웹 앱입니다.

---

## 시작하기 — 순서대로 따라하세요

### 1단계. Firebase 프로젝트 만들기

1. [Firebase 콘솔](https://console.firebase.google.com) 접속 → **프로젝트 추가**
2. 프로젝트 이름 입력 후 생성
3. 왼쪽 메뉴 **빌드 → Authentication** → 시작하기 → **이메일/비밀번호** 사용 설정
4. 왼쪽 메뉴 **빌드 → Firestore Database** → 데이터베이스 만들기 → **프로덕션 모드**로 시작
5. 왼쪽 메뉴 **빌드 → Hosting** → 시작하기

---

### 2단계. Firebase 설정 값 넣기

Firebase 콘솔 → 프로젝트 설정(톱니바퀴) → **내 앱** → 웹 앱 추가(`</>`) → 설정 값 복사

`public/js/firebase-config.js` 파일을 열어 아래 부분을 교체:

```js
const firebaseConfig = {
  apiKey:            "복사한 값",
  authDomain:        "복사한 값",
  projectId:         "복사한 값",
  storageBucket:     "복사한 값",
  messagingSenderId: "복사한 값",
  appId:             "복사한 값"
};
```

---

### 3단계. Firestore 보안 규칙 적용

Firebase 콘솔 → Firestore → **규칙** 탭 → `firestore.rules` 파일 내용을 붙여넣기 → 게시

---

### 4단계. GitHub 저장소 만들기

```bash
git init
git add .
git commit -m "초기 커밋"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

### 5단계. GitHub Actions로 자동 배포 설정

1. Firebase 콘솔 → 프로젝트 설정 → **서비스 계정** → **새 비공개 키 생성** → JSON 다운로드
2. GitHub 저장소 → Settings → Secrets → Actions → **New repository secret**
   - 이름: `FIREBASE_SERVICE_ACCOUNT`
   - 값: 다운로드한 JSON 파일 전체 내용 붙여넣기
3. `.github/workflows/deploy.yml` 파일에서 `YOUR_PROJECT_ID`를 실제 Firebase 프로젝트 ID로 교체

이제 `main` 브랜치에 push할 때마다 자동으로 Firebase Hosting에 배포됩니다.

---

### 6단계. 수동 배포 (선택사항)

```bash
npm install -g firebase-tools
firebase login
firebase deploy
```

---

## 사용 방법

### 선생님

1. 앱 접속 → **선생님 — 게임 만들기**
2. 회원가입 또는 로그인
3. **새 게임 만들기** → 카드 입력 → 정답 순서 지정 → 제시 방법 선택 → **저장**
4. 생성된 **6자리 코드**를 학생들에게 공유

### 학생

1. 앱 접속 → **게임 참여하기**
2. 선생님께 받은 6자리 코드 입력
3. 소리 또는 화면을 보고 순서대로 카드 클릭!

---

## 파일 구조

```
word-card-game/
├── public/
│   ├── index.html          # 메인 HTML
│   ├── css/
│   │   └── style.css       # 스타일
│   └── js/
│       ├── firebase-config.js  # ← Firebase 키 입력 필요
│       └── app.js          # 앱 로직 전체
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions 자동 배포
├── firebase.json           # Firebase Hosting 설정
├── firestore.rules         # Firestore 보안 규칙
├── firestore.indexes.json  # Firestore 인덱스
└── README.md
```

---

## 주요 기능

- 선생님 회원가입/로그인 (Firebase Auth)
- 게임 저장/수정/삭제 (Firestore)
- 6자리 랜덤 코드로 학생 참여
- 단어/문장 카드 지원
- 보여주기 / 들려주기 / 둘 다 제시 방법
- 정답 순서 지정 (나머지는 방해 카드)
- 라운드 반복, 성공/실패 통계
