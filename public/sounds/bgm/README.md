# AI Gunslinger BGM Files Guide

이 폴더(`public/sounds/bgm/`)에 Suno 또는 생성형 AI로 만든 BGM 오디오 파일(.mp3)을 넣으시면 게임에서 자동으로 페이즈별 음악이 재생됩니다.

## 🎵 지원하는 트랙 파일명 (우선순위 순)

1. **메인 타이틀 / 로딩**: `title.mp3` (없을 시 `main.mp3` 대체)
2. **수배서 & 대치 (심리전)**: `standoff.mp3` (없을 시 `tension.mp3` -> `title.mp3` -> `main.mp3` 대체)
3. **결투 (DRAW!)**: `duel.mp3` (없을 시 `tension.mp3` 대체, 파일 없으면 총성에 집중하도록 조용히 처리)
4. **신문 & 퍽 선택 (살롱/결과)**: `saloon.mp3` (없을 시 `newspaper.mp3` -> `title.mp3` -> `main.mp3` 대체)
5. **승리 엔딩**: `victory.mp3` (없을 시 `saloon.mp3` -> `title.mp3` -> `main.mp3` 대체)
6. **패배 엔딩**: `gameover.mp3` (없을 시 `defeat.mp3` -> `title.mp3` -> `main.mp3` 대체)

> 💡 **간편 사용 팁**: 만약 1개의 대표 BGM만 사용하고 싶다면, `main.mp3` 파일 하나만 이 폴더에 넣어도 모든 화면에서 부드럽게 재생됩니다.

## 🚀 Vercel 배포 & 웹 최적화 권장 사양
- **포맷**: MP3 (44.1kHz, 128~192 kbps 추천)
- **용량**: 트랙당 약 1~2MB 내외 (초기 웹 로딩 지연 최소화 및 Vercel CDN 캐싱 극대화)
- **루프**: 끊김 없이 반복 재생되도록 인트로/아웃트로가 매끄러운 곡 권장
