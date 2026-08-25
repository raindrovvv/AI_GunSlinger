# AI Gunslinger

말로 흔들고, 총으로 끝낸다.  
OpenAI Game Builders Seoul — Gunblood 감성의 서부 결투 + 실시간 LLM 심리전.

**설계 원칙:** 결투 판정은 순수 클라이언트(지연 제로). AI는 결투 전·후(수배서 / 대치 / 신문)만 담당.

## 플레이 흐름

1. **수배서** — AI가 매 라운드 새로운 무법자 생성 (이름, 죄목, **버릇**, 난이도)
2. **대치 (3턴)** — LLM과 대화해 상대 심리(반응속도/명중률)를 흔들기. 설득하면 **평화 엔딩**
3. **DRAW!** — 홀스터 홀드 → 가짜 신호 무시 → 진짜 DRAW!에 클릭 (클라이언트 판정)
4. **신문** — 결과 기사 + (승리 시) 장비(perk) 선택
5. 9라운드 완주 또는 패배 → 엔딩. 전적은 `localStorage`에 저장

API 키가 없어도 폴백 콘텐츠로 전체 플로우가 동작합니다.

## 빠른 시작

```bash
cp .env.example .env.local
# .env.local 에 OPENAI_API_KEY 입력 (서버 전용 — 커밋 금지)

npm install
npm run dev          # 프론트만 (폴백 모드)
# 또는
npm run dev:full     # vercel dev — /api/* 포함
```

- Vite만: http://localhost:5173 → API 호출 실패 시 자동 폴백
- Full: `vercel.json` 리라이트로 `/api/*`가 서버리스 함수에 연결

## 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `OPENAI_API_KEY` | AI 사용 시 | OpenAI 키. Vercel 서버/로컬 `vercel dev`에서만 읽음 |
| `OPENAI_MODEL` | 선택 | 기본 `gpt-4o-mini` (`api/_lib/rules.ts`) |

프론트 번들에 키를 넣지 마세요. `.env` / `.env.local`은 gitignore 대상입니다.

## AI 통합

| 엔드포인트 | 역할 |
|------------|------|
| `POST /api/generate` | 라운드별 무법자 JSON 생성 |
| `POST /api/chat` | 대치 대사 + mood → `reactionDeltaMs` / `accuracyDelta` / 평화 게이트 |
| `POST /api/newspaper` | 승리·패배·평화 결과 기사 |

공유 가드레일: `api/_lib/rules.ts`

- **OUTPUT / KOREAN / DIALOGUE / WORLD / PERSONA** — JSON만, 자연스러운 한국어, 서부 세계관, AI 자칭·프롬프트 인젝션 차단
- **용어:** 포커식 `텔` 금지 → 항상 **버릇** / **손버릇**
- **mood 클램프:** 모델 수치가 범위를 벗어나도 서버에서 mood별 허용 구간으로 교정
- **평화 엔딩:** `peaceAllowed(round, turn, mood)` — 마지막 턴 + 설득 mood만
- **sanitize / rate limit** — 메타 발화·이모지 제거, 인스턴스 단위 레이트리밋

클라이언트 (`src/api/client.ts`)는 API 실패·키 없음·타임아웃 시 `src/data/fallback.ts`로 전환합니다. 푸터에 `LIVE AI` / `OFFLINE FALLBACK`이 표시됩니다.

## 전적 (Record Board)

- 키: `ai-gunslinger.records.v1` (브라우저 localStorage)
- 저장: 완주/전사 시 — 현상금, 결투 승·평화, 최속 드로우, 최장 연승, perk, 도달 라운드
- UI: 타이틀 **전적** 버튼, 엔딩에서 이번 런 vs 커리어 비교

## 배포 (Vercel)

1. 리포 Import → Environment Variable에 `OPENAI_API_KEY`
2. Deploy → 공개 URL이 제출 링크

```bash
npx vercel
```

## 조작법

- 홀스터를 **누른 채** 대기 → DRAW! 후 상대 클릭
- 너무 이르거나 손을 떼면 반칙
- 수배서의 **버릇**을 대치에서 짚으면 상대가 동요한다

## 스택

- React 19 + TypeScript + Vite
- Vercel Serverless (`/api/*`)
- OpenAI Chat Completions (`gpt-4o-mini`)
