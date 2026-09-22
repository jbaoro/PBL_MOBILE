# MeetPoint

여러 참가자의 출발 위치와 이동 시간을 비교해 모두에게 공정한 약속 장소를 추천하는 Next.js 데모입니다.

현재 버전은 외부 지도·경로 API 없이 예시 참가자와 후보 장소 데이터를 사용합니다.

## 시작하기

### 요구 사항

- Node.js 20 이상 권장
- npm

### 설치 및 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

### 확인 명령

```bash
npm run build
```

`build`는 타입 검사와 프로덕션 빌드를 함께 수행합니다. 현재 ESLint 설정 파일은 아직 없기 때문에 `npm run lint` 실행 시 초기 설정 선택 화면이 표시될 수 있습니다.

## 프로젝트 구조

```text
app/
├─ layout.tsx      공통 레이아웃과 메타데이터
├─ page.tsx        참가자 입력 및 추천 결과 화면
└─ globals.css     전역 스타일과 반응형 스타일
```

## 협업 방법

현재 기본 브랜치는 `master`입니다. 작업할 때는 최신 브랜치를 먼저 받고 기능별 브랜치를 만들어 주세요.

```bash
git checkout master
git pull origin master
git checkout -b feature/작업내용
```

작업이 끝나면 빌드를 확인한 뒤 커밋합니다.

```bash
npm run build
git add .
git commit -m "feat: 작업 내용"
git push -u origin feature/작업내용
```

커밋 메시지는 다음 접두사를 권장합니다.

- `feat`: 기능 추가
- `fix`: 버그 수정
- `style`: 스타일 수정
- `refactor`: 동작 변경 없는 코드 정리
- `docs`: 문서 수정

Pull Request에는 변경 내용, 확인 방법, 남은 작업을 간단히 적어 주세요.

## 현재 구현 범위

- 참가자 이름, 출발 위치, 이동 수단, 예상 시간 입력
- 참가자 평균 이동시간 계산
- 후보 장소별 추천 점수와 공정성 표시
- 모바일 화면 대응

후속 작업으로 실제 지도/경로 API 연결, 참가자 추가·삭제, 데이터 저장 기능을 붙일 수 있습니다.
