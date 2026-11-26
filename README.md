# MeetPoint

참여자들의 출발 위치와 이동 시간을 비교해 모두에게 공정한 약속 장소를 추천하는 Next.js 프로젝트입니다.

기본 주소(`/`)에서 약속을 만들고 **모임 정보 → 참가자 → 추천 지역 → 주변 장소 → 장소 확인 → 확정·공유**의 단계별 화면으로 진행합니다. 한 사람이 모든 참가자의 출발지와 이동 수단을 입력하며, 약속은 서버 없이 이 기기(브라우저 저장소)에 저장됩니다. `/planner`는 API 동작을 확인하는 개발용 화면입니다.

## 단계별 화면 (2026-11-25)

| 단계 | 주소 | 내용 |
| --- | --- | --- |
| 약속 목록 | `/` | 이 기기에 저장된 약속, 새 약속 만들기, 삭제 |
| 1. 모임 정보 | `/meetings/[id]/info` | 모임 이름(필수), 날짜·시간(선택, 시간 미정 가능) |
| 2. 참가자 | `/meetings/[id]/participants` | 2~8명, 이름·색상·출발지 검색·이동 수단 |
| 3. 추천 지역 | `/meetings/[id]/recommend` | 실제 경로 비교 후보 순위, 균형도, 추천 이유, 검색 범위, 제외 사유 |
| 4. 주변 장소 | `/meetings/[id]/places` | 음식점·카페, 반경·키워드, 더 보기 |
| 5. 장소 확인 | `/meetings/[id]/places/selected` | 고른 장소까지 모든 참가자의 이동시간 재조회, 모두 성공해야 확정 |
| 6. 확정·공유 | `/meetings/[id]/done` | 휴대폰 공유 시트(안 되면 복사), 지도·길찾기, 캘린더(.ics) 추가 |

앞 단계가 끝나지 않으면 뒤 단계 주소로 들어가도 해야 할 단계로 돌아갑니다. 출발지나 이동 수단을 바꾸면 이후 추천·선택·확정 결과는 지워집니다. 공유 글과 일정에는 참가자의 출발지 주소를 넣지 않습니다.

실제 조회에는 서버 환경 변수 `KAKAO_REST_API_KEY`와 카카오맵 API 활성화가 필요합니다. 키는 `.env.local`에 설정하며 무료 쿼터가 적용되는 앱을 사용합니다. 카카오 키가 없으면 오류 안내를 표시하고 가짜 결과로 대체하지 않습니다. 조회 기준은 현재 시점이며 미래 약속 시각의 교통 예측은 포함하지 않습니다. 같은 경로(10분)·역/장소 검색(30분) 결과는 서버 메모리에 잠시 저장해 호출 수를 줄입니다.

[발급·실행·API 계약·추천 기준·프론트 연결 안내](docs/JJY_LOCATION_API.md)를 참고하세요. `npm run test:meetpoint`로 외부 API 비용 없이 계산 및 오류 처리를 검증할 수 있습니다. 실제 키를 이용한 세 수단의 라이브 검증은 별도입니다.

2026-10-22: MeetPoint 앱의 카카오맵 활성화 후 기존 권한 오류가 해소되었습니다. 장소 검색, 세 교통수단, 후보 6곳 추천, 주변 음식점·카페와 최종 장소 재조회를 실제 API로 확인했고 브라우저에서도 장소 선택까지 완료했습니다. [실제 연동 검증 결과](docs/JJY_LIVE_VALIDATION_2026-10-22.md)를 참고하세요.

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

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다. 출발지 검색·추천·장소 검색에는 `.env.local`의 `KAKAO_REST_API_KEY`가 필요합니다. 약속 저장에는 DB가 필요하지 않습니다.

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
├─ api/                    백엔드 Route Handler (카카오 검색·경로·추천)
├─ page.tsx                약속 목록 (기본 주소)
├─ meetings/[id]/          단계별 화면 (info, participants, recommend, places, places/selected, done)
├─ planner/                API 확인용 개발 화면
├─ components/Icons.tsx    SVG 아이콘
├─ layout.tsx              공통 레이아웃
└─ globals.css             전역 스타일
components/
├─ flow/FlowLayout.tsx     단계 화면 공통 틀 (상단 바·진행 막대·하단 버튼)
└─ meeting/                참가자·출발지 검색·결과 표시 조각
features/meeting/
├─ model.ts                약속 데이터와 단계 규칙 (순수 함수, 앱에서도 재사용)
├─ store.ts                약속 저장소 (기기 저장 자동화)
├─ display.ts, share.ts    표시 계산, 공유 글·캘린더 파일 만들기
└─ useMeetingStep.ts       단계 진입 확인
lib/
├─ meetpoint/              추천 계산·검증·타입, server/ (카카오 연동·캐시·요청 제한)
├─ api/client.ts           API 호출 (앱 전환 시 NEXT_PUBLIC_API_BASE_URL로 서버 주소 지정)
└─ platform/               저장·공유·ID 어댑터 (앱 전환 시 교체 지점)
tests/meetpoint/           단위·시나리오 테스트 (npm run test:meetpoint)
prisma/                    User 모델과 초기 마이그레이션 (현재 화면에서는 사용하지 않음)
docs/                      제출 자료, 세부 결정, API 계약, 검증 기록
```

## 현재 구현 범위

- 단계별 화면으로 약속 만들기부터 확정·공유까지 (위 표 참고), 휴대폰 화면 기준 레이아웃
- 전국 출발지 검색, 대중교통·자동차·도보 실제 경로 비교 (카카오맵·카카오모빌리티)
- 공정성 추천: 최대 이동시간 → 시간 차이 → 평균 순, 근거리·중거리·장거리 구분, 출발지 주변 후보, 후보 부족 시 추가 탐색
- 추천 이유·검색 범위·제외 사유 표시, 장소까지 이동시간 재조회
- 기기 내 약속 저장(여러 개), 공유 시트·복사·캘린더 추가
- 외부 API 호출 상한·사용자별 요청 제한·결과 캐시

후속 범위: 실제 휴대폰에서 공유 확인(배포 필요), 카카오톡 공유 카드(JavaScript 키·도메인 등록 필요), 공유용 결과 페이지, PWA 설치, 앱(Expo) 전환. User 모델과 회원가입 API(501 응답)는 남아 있지만 현재 흐름에서는 사용하지 않습니다.

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
| 2026-10-21 | 조준영(Codex 보조) | JJY | 전국 출발지 검색, 세 교통수단 API, 공정성 추천, 주변 장소·최종 경로 재조회, 별도 /planner, 연결 문서 | 정적 검사·단위 테스트 18개·브라우저 대역 흐름 통과; 자동차 실제 조회 통과; 무료 쿼터 적용 앱 확인 및 나머지 실제 연동 검증은 사용자 요청으로 다음 작업에 진행 |
| 2026-10-22 | 조준영(Codex 보조) | JJY | 카카오맵 활성화 후 실제 API 및 화면 흐름 검증, 결과 문서화 | 서울·부산 검색, 세 교통수단, 후보 6곳, 음식점·카페, 최종 장소 재조회·선택 성공; `docs/JJY_LIVE_VALIDATION_2026-10-22.md` |
| 2026-10-28 | 서하늘(Antigravity 보조) | `SHN` | 자체 제작 SVG 아이콘 시스템, 모던 컬러 이니셜 아바타, 공정성 게이지 바, 모바일 최적화 및 master(백엔드·카카오 연동) 통합 | 정적 검사(`check`) 및 프로덕션 빌드 통과; 단위 테스트 18개 전건 통과; 메인 화면과 /planner 상호 연결 완료 |
| 2026-10-28 | 서하늘(Antigravity 보조) | `master` | 하드코딩 완전 제거, 메인-플래너 실시간 카카오 API 연동, 전국 거점/중심점 확장, 후보지 투표, 주변 장소 탐색 및 세션 동기화 | 정적 검사(`check`) 및 프로덕션 빌드 통과; 단위 테스트 18개 전건 통과; 전국 20개 거점 알고리즘 실측 완료 |
| 2026-11-25 | 조준영(Claude 보조) | `feat/step-flow` | 단계별 화면 기반: 약속 저장소·API 클라이언트·공통 화면 틀·약속 목록 | 정적 검사·빌드 통과; PR #8 |
| 2026-11-25 | 조준영(Claude 보조) | `feat/step-flow` | 추천 개선: 근거리·장거리 구분, 출발지 주변 후보, 추가 탐색, 호출 상한, 사용자별 요청 제한, 추천 이유·제외 사유 | 단위 테스트 41개(시나리오 13개 포함) 통과; PR #8 |
| 2026-11-25 | 조준영(Claude 보조) | `feat/step-flow` | 메인(/)을 약속 목록으로, 모임 정보·참가자 추가/수정 화면 | 헤드리스 Chrome 흐름 확인; PR #8 |
| 2026-11-25 | 조준영(Claude 보조) | `feat/step-flow` | 추천 지역 화면 (균형도·순위·미니 지도·참가자별 시간) | 단위 테스트 45개 통과; PR #9 |
| 2026-11-25 | 조준영(Claude 보조) | `feat/step-flow` | 주변 장소·장소 확인 화면 (재조회·확정 조건) | 단위 테스트 46개 통과; PR #10 |
| 2026-11-25 | 조준영(Claude 보조) | `feat/step-flow` | 약속 확정·공유 화면 (공유 시트·복사·캘린더), 시간 미정 저장 수정 | 단위 테스트 52개 통과; PR #11 |
| 2026-11-25 | 조준영(Claude 보조) | `feat/step-flow` | 정리: 기존 데모 화면·가짜 데이터 제거, 미사용 전역 스타일 정리, 카카오 결과 캐시, README 갱신 | 단위 테스트 56개 통과·빌드 통과 |
| 2026-11-26 | 서하늘(Antigravity 보조) | `SHN` | 프론트엔드 UI/UX·퍼포먼스 전면 개편: `next/font` 자체 호스팅 폰트, 60fps HiDPI 인터랙티브 Canvas 지도, 참가자 바텀시트·원탭 수단 전환·분포 미리보기, 추천 후보 실시간 동기화·레이더 로딩, 클라이언트 LRU 검색/장소 캐시, Shimmer 스켈레톤, 확정 컨페티, PWA 매니페스트·설치 버튼 | 단위 테스트 56개 통과, `npm run check`(ESLint·타입 검사 경고/오류 0건), 프로덕션 빌드 및 모바일 브라우저 UI 검증 통과 |

새 기록 형식:

```text
| YYYY-MM-DD | 실명 | 개인 브랜치 | 기능 번호와 구현/수정 내용 | 검사 결과 또는 PR 링크 |
```
