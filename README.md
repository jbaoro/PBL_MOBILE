# MeetPoint

참여자들의 출발 위치와 이동 시간을 비교해 모두에게 공정한 약속 장소를 추천하는 Next.js 프로젝트입니다.

현재는 프론트엔드 데모와 회원가입 백엔드의 기초 설정을 진행하고 있습니다. 데이터 저장에는 Prisma ORM과 SQLite를 사용합니다.

## 기술 스택

- Next.js 14 App Router
- React 18
- TypeScript
- Prisma ORM 7
- SQLite

## 시작하기

### 요구 사항

- Node.js 20.19 이상
- npm

### 패키지 설치

```bash
npm install
```

### 환경 변수 설정

프로젝트 루트의 `.env.example`을 복사해 `.env`를 만듭니다.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

`.env`의 기본 SQLite 연결 주소는 다음과 같습니다.

```env
DATABASE_URL="file:./dev.db"
```

`.env`와 로컬 SQLite DB 파일은 Git에 커밋하지 않습니다.

### Prisma 확인

스키마가 올바른지 검사합니다.

```bash
npx prisma validate
```

스키마를 사용하는 Prisma Client를 생성합니다.

```bash
npx prisma generate
```

모델 설계가 확정된 뒤 첫 마이그레이션을 만들 때는 다음 명령을 사용합니다.

```bash
npx prisma migrate dev --name init
```

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

## 프로젝트 구조

```text
app/
├─ api/                 백엔드 Route Handler
├─ layout.tsx           공통 레이아웃
├─ page.tsx             메인 화면
└─ globals.css          전역 스타일
prisma/
└─ schema.prisma        데이터베이스 모델 정의
prisma7.config.ts       Prisma CLI와 데이터베이스 연결 설정
generated/prisma/       자동 생성되는 Prisma Client (Git 제외)
```

## 현재 구현 범위

- 참여자 이름, 출발 위치, 이동 수단, 예상 시간 입력
- 참여자별 평균 이동시간 계산
- 후보 장소별 추천 점수와 공정성 표시
- 모바일 화면 대응
- Prisma와 SQLite 초기 설정

다음 단계로 `User` 모델을 완성하고 회원가입 API에 입력 검증, 비밀번호 해싱, 중복 이메일 확인, DB 저장 기능을 추가할 예정입니다.

## 작업 방법

기본 브랜치는 `master`입니다. 새 기능은 별도 브랜치에서 작업합니다.

```bash
git checkout master
git pull origin master
git checkout -b feature/작업내용
```

작업이 끝나면 빌드를 확인한 뒤 커밋합니다.

```bash
npm run build
git add <변경한 파일>
git commit -m "feat: 작업 내용"
```

커밋 유형은 다음 기준을 사용합니다.

- `feat`: 기능 추가
- `fix`: 버그 수정
- `refactor`: 동작 변경 없는 코드 정리
- `docs`: 문서 수정
- `chore`: 도구 및 환경 설정
