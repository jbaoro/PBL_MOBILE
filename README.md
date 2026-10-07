# MeetPoint

참여자들의 출발 위치와 이동 시간을 비교해 모두에게 공정한 약속 장소를 추천하는 Next.js 프로젝트입니다.

현재 베이스는 **예시 데이터 기반 화면 데모**입니다. Prisma ORM과 SQLite, User 모델의 기초 설정이 있으며, 실제 경로 조회·장소 검색·약속 저장·로그인·PWA 설치는 개발 예정 기능입니다.

## 10월 7일 PBL 제출 자료

- [역할 분담과 GitHub 셋업 제출서](docs/PBL_SUBMISSION.md)
- [프로젝트 세부 결정 사항](docs/PROJECT_DECISIONS.md)
- [셋업 확인 결과와 스냅샷](docs/SETUP_SNAPSHOT.md)

| 항목 | 내용 |
| --- | --- |
| 원본 원격 저장소 | https://github.com/jbaoro/PBL_MOBILE |
| 저장소 소유자 | 오윤식 / `jbaoro` |
| 베이스 브랜치 | `master` |
| 협업 방식 제안 | 안내문 방법 (1): 원격 저장소 1개 + 팀원별 로컬 저장소/브랜치 + PR 리뷰·병합 |
| 확인된 구성원 | 오윤식, 조준영, 서하늘 |
| 교수 Collaborator 등록 | 소유자가 Settings에서 등록 여부 확인 및 처리 필요 |

### 팀원과 역할 분담안

| 이름 | GitHub 계정 | 브랜치 | 주 담당 | 세부 산출물 |
| --- | --- | --- | --- | --- |
| 오윤식 | `jbaoro` | `master` | 저장소 관리, DB와 서버 기반 | 환경 변수 예제, Prisma 모델/마이그레이션, API 공통 구조, 접근 관리, 충돌 확인·PR 통합 |
| 조준영 | `Junyeong0721` | `JJY` | 지도·경로·장소 API, 추천 로직 | 주소/역 검색, 교통수단별 경로 조회, 후보 지역 선정, 최대·차이·평균 순 정렬, 장소 검색 |
| 서하늘 | `tjgksmf1012` | `SHN` | 화면, 사용자 흐름, 기기 내 저장, PWA | S01~S05 화면, 입력/검증, 로딩·오류·빈 결과, 확정/저장/복사, 모바일 대응, PWA 설치 |

이름과 브랜치 연결은 사용자 확인 정보이고 계정은 기존 Git 커밋에서 확인했습니다. **세부 역할은 팀 합의 전 제안안**입니다. 기획 검토, 연동 확인, 모바일 테스트, README 이력 갱신은 공동 책임입니다. 안내문의 4명은 예시로 해석하여 현재 확인된 3명에 맞췄습니다. 추가 구성원이 있으면 표와 제출서를 보완합니다.

`master`는 오윤식 담당이면서 팀의 통합 베이스입니다. 다른 팀원은 개인 브랜치에서 PR을 제출하고 오윤식이 리뷰·충돌 확인·병합합니다.

## 기술 스택

- Next.js 14 App Router
- React 18
- TypeScript
- Prisma ORM 7
- SQLite

## 시작하기

### 요구 사항

- Node.js 20.19 이상인 20 LTS / 22.12 이상인 22 LTS / 24 이상 중 동일한 메이저 버전
- npm

### 패키지 설치

```bash
npm ci
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
npm run db:validate
```

스키마를 사용하는 Prisma Client를 생성합니다.

```bash
npm run db:generate
```

DB 모델을 변경하고 마이그레이션을 작성할 때는 다음 명령을 사용합니다. 적용 검증 상태는 셋업 확인 결과에 기록합니다.

```bash
npm run db:migrate -- --name 변경내용
npm run db:generate
```

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다. 현재 데모 실행에는 외부 API 키나 DB 저장 기능이 필요하지 않습니다.

macOS/Linux의 환경 파일 복사 명령은 `cp .env.example .env`입니다. Windows에서 npm이 없으면 Node.js 설치 후 새 터미널을 열거나 다음과 같이 실행합니다.

```powershell
$env:Path += ";C:\Program Files\nodejs"
npm.cmd ci
npm.cmd run dev
```

### 공통 확인 명령

```bash
npm run check
npm run build
```

`check`는 ESLint와 TypeScript를 검사합니다. ESLint 설정을 포함하므로 초기 설정 선택 화면이 뜨지 않습니다. `build`는 타입 검사와 프로덕션 빌드를 수행합니다.

DB가 필요한 기능을 개발하기 전에는 `npm run db:setup`으로 공유된 초기 마이그레이션과 Client를 준비합니다. 이 명령은 없는 로컬 SQLite 파일을 만들고 마이그레이션을 적용하며 기존 DB를 초기화하지 않습니다. SQL은 공유하고 각 팀원의 로컬 DB 파일은 공유하지 않습니다. 기존 마이그레이션만 적용할 때는 `npm run db:deploy`를 사용합니다.

## 프로젝트 구조

```text
app/
├─ api/                 백엔드 Route Handler
├─ layout.tsx           공통 레이아웃
├─ page.tsx             메인 화면
└─ globals.css          전역 스타일
prisma/
├─ schema.prisma        데이터베이스 모델 정의
└─ migrations/          공유하는 초기 User 테이블 SQL
scripts/prepare-sqlite.mjs  새 로컬 DB 파일 생성(기존 파일 보존)
prisma.config.ts        Prisma CLI와 데이터베이스 연결 설정
generated/prisma/       자동 생성되는 Prisma Client (Git 제외)
docs/                   제출 자료, 세부 결정, 셋업 기록
.eslintrc.json           공통 정적 검사 설정
.github/PULL_REQUEST_TEMPLATE.md
```

## 현재 구현 범위

- 참여자 이름, 출발 위치, 이동 수단, 예상 시간 입력
- 참여자별 평균 이동시간 계산
- 후보 장소별 추천 점수와 공정성 표시
- 모바일 화면 대응
- Prisma와 SQLite 초기 설정

User 모델은 정의되어 있으나 회원가입 API는 준비 중이라는 HTTP 501 응답만 제공합니다. 입력 검증, 비밀번호 해싱, 중복 확인, DB 저장과 인증은 아직 구현되지 않았습니다.

`SHN`에는 참가자 관리와 화면 개선 커밋이 별도로 있습니다. 통합 전에는 `master`의 완료 기능으로 표시하지 않습니다. 데모의 점수와 공정성 수치는 고정된 예시이며 실제 교통 데이터 결과가 아닙니다. 1차 목표는 F01~F06과 S01~S05, 실제 이동시간 기반 비교와 현재 기기 내 저장입니다.

## 작업 방법

기본 브랜치는 `master`입니다. 서하늘은 `SHN`, 조준영은 `JJY`, 오윤식은 `master`를 담당합니다. 최초 clone 후 서하늘의 개인 브랜치를 선택하는 예시는 다음과 같습니다. 이미 로컬 브랜치가 있으면 `git switch SHN`을 사용합니다.

```bash
git fetch origin
git switch --track origin/SHN
```

작업 시작 전 자신의 브랜치를 갱신하고 최신 베이스를 병합합니다.

```bash
git switch SHN
git pull --ff-only origin SHN
git fetch origin
git merge origin/master
```

작업이 끝나면 검사와 빌드를 확인하고 **README 작업 이력에 날짜, 작업자 실명, 업데이트 내용, 확인 결과를 추가**한 뒤 커밋합니다. 필요한 파일만 커밋하고 `개인 브랜치 → master` PR을 제출합니다. 매주 수요일 수업 시작 전에 push·리뷰·병합·README 갱신을 마칩니다. 공통 파일 변경은 작업 전에 조율합니다.

```bash
npm run check
npm run build
git add <변경한파일> README.md
git commit -m "feat: 작업 내용"
git push origin SHN
```

커밋 유형은 다음 기준을 사용합니다.

- `feat`: 기능 추가
- `fix`: 버그 수정
- `refactor`: 동작 변경 없는 코드 정리
- `docs`: 문서 수정
- `chore`: 도구 및 환경 설정

## 작업 이력

9월 기록은 기존 Git 커밋에 근거한 정리입니다. 팀원은 이후 실제 수행한 작업을 커밋 또는 병합 때마다 새 행으로 추가합니다.

| 날짜 | 작업자 | 브랜치 | 업데이트 내용 | 확인 결과 / 근거 |
| --- | --- | --- | --- | --- |
| 2026-09-22 | 오윤식 | `master` | Next.js 데모와 Windows 실행 안내 구성 | 기존 저장소 이력 |
| 2026-09-22 | 조준영 | `JJY` | 브랜치 작업 확인 및 PR 통합 | `f804848`, 기존 PR #1~#3 |
| 2026-09-24 | 오윤식 | `master` | Prisma·SQLite 기반, User 모델, 개발 도구 추가 | `3b2b2e5`, `07709b2`, `42dc411` |
| 2026-09-30 | 서하늘 | `SHN` | API 미구현 응답, 모바일 카드 스타일, 추천 강조·미니 노선도·참가자 관리 UI | `da647c5`, `ee8fb89`, `6a2d08f`; master 통합 전 |
| 2026-10-07 | 서하늘(Codex 보조) | `chore/pbl-setup` | 역할·제출 문서, 실행 안내, Prisma 설정 표준화, 초기 DB/마이그레이션, 정적 검사, 빈 API 빌드 오류 수정 | `docs/SETUP_SNAPSHOT.md` 참조; master 통합 전 |

새 기록 형식:

```text
| YYYY-MM-DD | 실명 | 개인 브랜치 | 기능 번호와 구현/수정 내용 | 검사 결과 또는 PR 링크 |
```
