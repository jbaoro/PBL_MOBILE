# 프로젝트 수행에 필요한 세부 결정 사항과 GitHub 셋업 제출

프로젝트: **MeetPoint** / 제출 기준일: **2026년 10월 7일(수)**

팀원: **오윤식 · 조준영 · 서하늘** / 작성: 서하늘(Codex 보조)

> 제출 준비본. 이름/브랜치 연결은 확인되었으며 세부 역할과 협업 방식은 제안안이다. 교수 등록 확인과 셋업 PR의 master 통합 후 최종 제출 상태로 갱신한다.

## 1. 구성원 역할 분담 세부 내용

| 구성원 | 주요 역할(안) | 세부 책임과 산출물 |
| --- | --- | --- |
| 오윤식 | 저장소 관리자, DB/백엔드 기반 | 베이스 관리, 팀원·교수 접근 등록, 환경 변수 예제, Prisma/SQLite 모델·마이그레이션, API 공통 구조, 충돌 확인·리뷰·병합, 수요일 전 통합 확인 |
| 조준영 | 외부 API와 추천 알고리즘 | 주소/역 검색·좌표, 교통수단별 경로 API 검증·연동, 후보 지역, 최대·차이·평균 계산/정렬, 식당·카페 검색과 상세, 경로 실패/재조회 |
| 서하늘 | 프론트엔드, 사용자 흐름과 PWA | S01 입력~S05 확정 화면, 입력 검증·로딩·오류·빈 결과, 기기 내 저장·재조회·복사, 모바일 대응·PWA 설치, 제출 문서 정리 |

공동 책임은 기획 검토, API 계약 합의, 모바일 시나리오 확인, 리뷰와 README 갱신이다. 1차 핵심 범위는 로그인 없이 대표자가 입력하는 F01~F06이며 초대·투표·계정·알림은 후속 확장이다. 세부 내용은 [개발 결정안](PROJECT_DECISIONS.md)에 수록한다.

## 2. GitHub 협업 방식과 브랜치 정보

**선택 제안: 안내문 방법 (1).** 원본 원격 저장소 1개를 공유하고 각자 로컬 저장소와 담당 브랜치에서 작업한다. 기존 저장소 구조와 일치하는 방식이다.

- 원본 URL: https://github.com/jbaoro/PBL_MOBILE
- clone URL: https://github.com/jbaoro/PBL_MOBILE.git
- 원본 소유자: 오윤식 / GitHub `jbaoro`
- 베이스 브랜치: `master`

| 브랜치 | 담당자 | GitHub 계정 | 설명 |
| --- | --- | --- | --- |
| master | 오윤식 | jbaoro | 오윤식 담당이자 팀 통합 베이스 |
| JJY | 조준영 | Junyeong0721 | 조준영 개인 작업 |
| SHN | 서하늘 | tjgksmf1012 | 서하늘 개인 작업 |

목록: https://github.com/jbaoro/PBL_MOBILE/branches

이름/브랜치는 사용자 확인 정보, 계정은 Git 기록에 근거한다. `chore/pbl-setup`은 이번 셋업의 리뷰용 브랜치이며 추가 구성원이 아니다. 팀원은 변경 내용·검사 결과·README 이력을 PR에 포함하고 오윤식이 리뷰·충돌 확인·병합한다.

### 교수 Collaborator 등록

안내문에 기재된 교수 계정을 원본 저장소에 등록해야 한다. 연결된 서하늘 계정에는 push 권한이 있으며 admin 권한은 없다. **교수 등록 여부를 확인하거나 초대를 발송하지 않았으므로 완료로 표시하지 않는다.**

오윤식 계정으로 [Settings → Collaborators](https://github.com/jbaoro/PBL_MOBILE/settings/access)를 열어 다음을 확인한다.

1. 안내문 기재 교수 계정을 검색한다.
2. 미등록이면 Add people에서 안내문의 주소 또는 확인된 GitHub 아이디로 초대한다.
3. Pending invitation과 수락 완료를 구분한다. 이미 등록되었다면 다시 초대하지 않는다.
4. 등록/수락 상태 화면을 제출 스냅샷에 추가한다.

## 3. 프로젝트 베이스 셋업과 스냅샷

현재 기본 브랜치 `origin/master`를 베이스로 사용한다. 안내문의 `origin/main`은 예시이므로 이름 변경은 필요하지 않다. 이번 수정은 검증한 리뷰용 브랜치에서 PR로 제출한다. **통합 전에는 변경이 master에 적용됐다고 표시하지 않는다.**

기존 베이스는 Next.js·React·TypeScript 데모, 환경 변수 예제, Prisma User 모델을 포함한다. 이번 셋업은 빈 API의 빌드 오류를 수정하고 정적 검사 설정, Prisma 설정 표준화, 공유 초기 마이그레이션과 기존 DB를 보존하는 초기화 명령, 실행/역할/협업 문서와 작업 이력을 추가한다.

```bash
git clone https://github.com/jbaoro/PBL_MOBILE.git
cd PBL_MOBILE
git switch master
npm ci
```

Windows는 `Copy-Item .env.example .env`, macOS/Linux는 `cp .env.example .env`로 환경 파일을 만든 뒤:

```bash
npm run db:validate
npm run db:generate
npm run db:setup
npm run check
npm run build
npm run dev
```

현재 데모는 DB 저장이나 외부 API 키 없이 실행된다. PR 통합 후 위 명령을 master에서 재확인한다. 검증 환경·결과·커밋과 스냅샷은 [SETUP_SNAPSHOT.md](SETUP_SNAPSHOT.md)에 기록한다.

제출 첨부 항목: 원본/README 화면, master·JJY·SHN 목록, 설치·검사·빌드 결과, 실제 데모 화면, 교수 등록/수락 화면(관리자 추가 필요).

## 4. README 작업 이력 운영

팀원은 **커밋 업데이트 또는 병합 때마다** 루트 README에 날짜, 실명, 브랜치, 변경 내용, 확인 결과를 추가한다. 기존 기록과 다른 사람의 행을 지우지 않는다.

```text
| YYYY-MM-DD | 실명 | 개인 브랜치 | 구현/수정 사항 | 검사 결과 또는 PR 링크 |
```

매주 수요일 수업 시작 전에 개인 브랜치 push, 팀장 리뷰/통합과 README 갱신을 수행한다. 교수자는 개인 작업과 PR, 베이스 업데이트를 확인할 수 있다.

## 제출 전 확인

- [x] 실명과 브랜치 표 작성
- [x] 세부 역할 분담안 작성
- [x] 방법 (1)의 원본 URL·소유자·브랜치 정리
- [x] 실행 안내와 README 작업 이력 준비
- [ ] 역할 분담과 협업 방식 팀 합의
- [ ] 교수 Collaborator 등록/수락 확인
- [ ] 셋업 PR의 master 통합
- [ ] 통합 master 기준 최종 스냅샷

안내문의 4인 구성은 예시로 해석하여 현재 확인된 3명에 맞췄다. 추가 팀원이 있으면 표를 보완한다. 학교 제출 시스템 업로드나 교수에게 메시지 발송은 별도 단계이며 수행하지 않았다.
