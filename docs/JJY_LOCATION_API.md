# JJY 위치·경로·추천 기능 연결 안내

작성: 조준영 작업 지원(Codex) / 2026-10-21 / 브랜치: JJY

## 구현 범위

`/planner`에서 출발지 검색 → 참가자별 교통수단 선택 → 후보 비교 → 주변 장소 검색 → 실제 장소까지 경로 재조회 → 장소 선택·복사를 확인할 수 있다. 기존 `/` 화면은 유지했다.

사용자 확인 사항: 전국 검색, 2~8명, 후보 최대 6곳, 대중교통·자동차·도보, 무료 쿼터 사용, 별도 `/planner` 화면. 조회 시점 기준 시간과 음식점·카페/반경/키워드 필터를 현재 기본값으로 구현했다. 미래 약속 시각의 교통 예측과 가격·평점·영업 여부는 구현 범위에 포함되지 않는다.

지도 API 키를 설정하지 않으면 연결 안내와 명시적인 오류를 반환한다. 임의 시간, 직선거리 기반 가상 소요 시간, 가짜 장소로 대체하지 않는다.

## 실행 및 API 키 준비

```powershell
cd "D:\WORKSPACE\PBL WorkSpace\MeetPoint"
npm.cmd ci
npm.cmd run dev
```

브라우저: <http://localhost:3000/planner>. 현재 기능에는 Prisma DB 초기화가 필요하지 않다.

1. [카카오디벨로퍼스](https://developers.kakao.com/)에 로그인하고 개발자 계정을 등록한다.
2. 앱 관리에서 `앱 생성`을 선택하고 `MeetPoint` 앱을 만든다. 개인 개발자는 개발자나 팀을 나타내는 이름으로 회사명 항목을 작성할 수 있다. [앱 생성 안내](https://developers.kakao.com/docs/ko/tutorial/start)
3. `앱 → MeetPoint → 카카오맵 → 사용 설정 → 상태`를 `ON`으로 바꾸고 앱 정보의 `카카오맵 무료 쿼터` 표시를 확인한다. 무료 쿼터는 계정에서 첫 번째로 활성화한 앱에 제공되는 조건이 있다. 유료 API 사용은 활성화하지 않는 전제로 개발한다. [카카오맵 설정](https://developers.kakao.com/docs/ko/kakaomap/common)
4. `앱 → 플랫폼 키 → REST API 키`에서 키를 확인한다. [키 설정](https://developers.kakao.com/docs/ko/app-setting/app)
5. 프로젝트 루트의 `.env.local`에 다음 변수를 설정한다. 실제 키를 README, 화면, 채팅, GitHub에 넣지 않는다.

```dotenv
KAKAO_REST_API_KEY=발급받은_REST_API_키
# 자동차 길찾기에서 별도 앱 키를 사용할 때만 설정한다.
# 비어 있으면 위 키를 사용한다.
KAKAO_MOBILITY_REST_API_KEY=
```

6. 개발 서버를 종료(Ctrl+C) 후 `npm.cmd run dev`로 재시작한다.
7. 출발지를 검색한 뒤 서로 다른 두 지점으로 각 교통수단을 확인한다. 키 설정 여부 확인은 실제 API 사용 권한 검증이 아니다. 권한 오류는 API 활성화 및 해당 REST 키의 호출 허용 IP 설정을 확인한다. 자동차도 카카오 REST 키로 인증한다. [자동차 길찾기 시작](https://developers.kakaomobility.com/guide/navi-api/start.html)

카카오 응답이 `App(MeetPoint) disabled OPEN_MAP_AND_LOCAL service.`이면 해당 키가 속한 앱의 카카오맵 서비스가 비활성화된 상태다. 키 발급과 카카오맵 활성화는 별도다. 앱 이름과 카카오맵 사용 설정을 확인한다. 유료 API나 비즈월렛 설정을 요구하면 무료 쿼터가 적용되는 앱인지 먼저 확인한다.

키는 서버에서만 사용하며 `NEXT_PUBLIC_` 변수는 필요하지 않다. `.env.local`은 기존 `.gitignore`에 의해 제외된다. 이 화면은 지도 SDK를 삽입하지 않고 제공자가 반환한 지도/경로 링크를 제공하므로 JavaScript 지도 키도 필요하지 않다.

## 데이터 계약

좌표는 WGS84, `lat`은 위도, `lng`은 경도이다. 공급자 요청의 x에는 lng, y에는 lat을 전달한다. 내부 소요 시간은 **반올림하지 않은 분**, 거리는 미터다.

```ts
type Location = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: string;
  url?: string;
};
type Participant = {
  id: string;
  name: string;
  origin: Location;
  transport: 'transit' | 'car' | 'walk';
};
```

정확한 타입: `lib/meetpoint/types.ts`. 검색 API에서 선택한 Location을 그대로 origin으로 전달한다. 임의 입력 문구만으로는 추천하지 않는다. 참가자 ID는 서로 달라야 한다.

모든 성공 응답은 `{ "data": ... }`, 실패 응답은 다음 형식이다. 응답은 `Cache-Control: no-store`다.

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "화면에 표시할 한국어 안내",
    "retryable": false
  }
}
```

| 오류 코드 | 의미 / 처리 |
| --- | --- |
| INVALID_INPUT | 형식·범위 오류. 입력을 수정한다. |
| NOT_CONFIGURED | 서버 API 키가 비어 있다. |
| PROVIDER_AUTH | 키 또는 외부 API 사용 권한 확인이 필요하다. |
| QUOTA_EXCEEDED | 외부 API 호출 한도 초과. 반복 호출하지 않는다. |
| TIMEOUT | 외부 조회 시간 초과 또는 취소. |
| UPSTREAM_ERROR | 연결 문제 또는 해석할 수 없는 공급자 응답. |
| NO_ROUTE | 해당 교통수단의 경로를 구하지 못했다. |
| NO_CANDIDATES | 탐색 범위에서 후보를 구하지 못했다. |
| BUSY | 동시 조회 또는 분당 요청 제한. 잠시 뒤 시도한다. |

## 엔드포인트

### GET /api/locations/search?query=강남역

장소명 검색과 주소 검색을 합쳐 최대 20개를 반환한다. 검색어는 공백 제거 후 1~80자다.

```ts
{ data: { locations: Location[], notices: string[] } }
```

둘 중 하나가 실패해도 다른 검색의 결과가 있으면 notices와 함께 반환한다. 결과가 없고 조회 오류가 있으면 오류를 반환한다. 빈 검색 결과와 API 실패를 구분한다.

### POST /api/recommendations

Content-Type: application/json. 요청: `{ participants: Participant[] }`.

```ts
{
  data: {
    ranked: CandidateResult[];
    excluded: CandidateResult[];
    generatedAt: string;
    timeBasis: 'query-time';
    searchedCandidateCount: number;
    notices: string[];
  }
}
```

CandidateResult는 `{ candidate: Location, routes: RouteResult[], metrics: Metrics | null }`. metrics는 `{ maxMinutes, gapMinutes, averageMinutes }`. routes에는 각 참가자의 성공 또는 실패가 반드시 남는다. 실패가 있는 후보의 metrics는 null이며 ranked에서 제외된다. 전체 실패도 HTTP 200의 빈 ranked와 excluded로 표현하므로 프론트에서 빈 결과를 처리해야 한다.

성공 경로에는 status, participantId, destinationId, transport, durationMinutes, distanceMeters, fetchedAt, timeBasis, provider, 선택적 url이 있다. 실패 경로에는 status='error', participantId, destinationId, error가 있다. 실패에는 숫자 0의 소요 시간을 넣지 않는다.

### GET /api/places

파라미터: `lat`, `lng` 필수; `category=restaurant|cafe`(기본 restaurant), `radius=100~5000`(기본 1000m), 선택적 `query`(80자 이하), `page=1~45`(기본 1).

응답: `{ data: { places: Place[], page: number, hasNext: boolean } }`.

Place는 Location에 category, 선택적 phone/distanceMeters를 추가한다. 제공되는 주소·분류·전화·지도 링크만 전달한다. 평점, 가격, 영업 중 여부, 사진은 만들거나 추정하지 않는다. 더 보기는 hasNext가 true인 경우에만 요청한다.

### POST /api/routes

요청: `{ participants: Participant[], destination: Location }`.

응답: `{ data: CandidateResult }`. 선택한 실제 장소 좌표까지 재조회한다. metrics가 null이면 확정을 막고 실패한 참가자를 보여준다. 지역 후보까지의 시간과 음식점 문 앞까지의 시간은 서로 다를 수 있다.

### GET /api/meetpoint/status

설정된 키의 존재 여부와 지원 수단/인원/후보 상한만 반환한다. 키 값이나 유효성 검증 결과를 반환하지 않는다.

## 후보 탐색과 공정성

1. 참가자 중심 좌표와 도보 참가자 출발지, 멀리 떨어진 출발지 쪽의 중간 좌표에서 최대 3개 탐색점을 만든다.
2. 각 탐색점 반경 20km에서 지하철역, 기차역, 버스터미널을 검색한다. 수도권 좌표 목록을 고정하지 않는다.
3. 동일 ID와 500m 이내 가까운 후보를 정리한다. 탐색점마다 가까운 후보를 우선 포함한 다음, 참가자와의 최대 직선거리를 참고해 최대 6곳으로 줄인다. 직선거리는 이 사전 탐색에만 쓰며 최종 시간이나 순위로 표시하지 않는다.
4. 거점 후보가 아예 없으면 같은 탐색점의 카페 검색 결과를 후보로 삼고 안내한다.
5. 각 후보에 대해 모든 참가자의 실제 경로를 조회한다. 최대 4개를 동시에 조회하며 실패 경로를 제외된 후보에 기록한다.
6. 모든 경로가 성공한 후보만 **최대 → 차이 → 평균 → 후보 ID** 순으로 정렬한다. 반올림 전 숫자를 사용한다.

전국 검색이 가능하더라도 공급자가 제공하지 않는 지역·도시간 구간·장거리 도보 경로의 성공을 보장하지 않는다. 최대 6개를 비교하는 탐색 방식이며 전국의 전역 최적해가 아니다. 특정 출발지 조합에서 더 나은 후보를 놓칠 수 있다. 출발지 조합별 실제 검증을 거쳐 후보 탐색을 개선할 수 있도록 `candidateAnchors`, `shortlistCandidates`를 분리했다.

## 프론트 연결 규칙

- 출발지 문구를 수정하면 선택된 좌표를 즉시 해제한다. 오래된 검색 응답을 버린다.
- 이름·출발지·교통수단·참가자 추가/삭제 시 이전 추천과 장소 선택을 무효화한다.
- 추천 중 입력과 중복 요청을 막고 취소 버튼을 제공한다.
- 후보지·음식점/카페·검색 조건 변경 시 이전 장소의 재조회 결과를 무효화한다.
- 최종 장소의 모든 경로가 확인되어야 장소 선택 버튼을 표시한다.
- 현재 시각 기준 예상치임을 표시한다. 약속 시간 기반 예측이나 막차 확인으로 설명하지 않는다.
- 현재 화면의 선택·복사만 구현했다. 영구 저장과 계정 동기화는 프론트/서버 담당의 후속 연동 범위다.

## 호출량 및 운영 범위

추천 1회: 거점 검색 최대 9회 + 후보 경로 최대 48회. 후보가 없어 카페를 탐색하면 최대 3회가 추가된다. 장소 상세 시간 재조회는 최대 8회다. 출발지 검색은 버튼을 누를 때 2회 호출하며 타이핑마다 호출하지 않는다. 자동 재시도는 하지 않는다.

로컬 프로세스 단위로 추천/최종 장소 조회를 동시에 2개, 합쳐 분당 10회로 제한한다. 외부 요청은 10초, 전체 경로 작업은 55초 제한을 적용한다. 이 제한은 다중 서버에 공유되는 사용량 집계가 아니며 실제 무료 잔여량은 공급자 콘솔에서 확인한다. 유료 사용을 켜지 않은 앱으로 진행한다. [최신 쿼터 안내](https://developers.kakao.com/docs/ko/getting-started/quota)

## 검증

```powershell
npm.cmd run check
npm.cmd run test:meetpoint
npm.cmd run build
```

자동 테스트는 실제 비용을 쓰지 않는 공급자 응답 대역으로 계산, 좌표 순서, 초→분 변환, 조회 실패, 인증/쿼터, 응답 노출 방지, 입력 검증을 확인한다. 실제 API 키로 세 교통수단의 동작을 확인하는 작업은 별도다. 실제 키 미설정 상태에서 테스트 성공을 실서비스 연동 성공으로 표시하지 않는다.

2026-10-22 실제 연결 확인: MeetPoint 앱의 카카오맵 활성화 후 기존 권한 오류가 해소되었다. 강남역·양재역·선릉역·부산역 검색, 세 교통수단, 후보 6곳 추천, 주변 음식점·카페, 최종 장소 경로 재조회가 성공했다. 실제 브라우저에서도 검색부터 최종 장소 선택까지 확인했고 경고·오류 로그는 없었다. 대표 시나리오 검증이며 전국 모든 구간의 성공을 보장하지 않는다. [실제 연동 검증 결과](JJY_LIVE_VALIDATION_2026-10-22.md)와 [전날 작업 기록](JJY_WORKLOG_2026-10-21.md)을 참고한다.

## 공식 API 근거

- [카카오맵 REST API](https://developers.kakao.com/docs/ko/kakaomap/rest-api): 주소·키워드·카테고리 검색, 대중교통·도보 경로. 2026-10-21 확인.
- [카카오모빌리티 자동차 길찾기](https://developers.kakaomobility.com/guide/navi-api/directions): 자동차 경로 및 초 단위 소요 시간. 2026-10-21 확인.

교통수단별 공급자 응답 변환은 `lib/meetpoint/server/kakao.ts`에 모아두었다. 공급자를 바꿔도 프론트에서 사용하는 내부 계약은 유지할 수 있다.
