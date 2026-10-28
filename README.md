# jw_financial_tools

고객 상담용 금융 시뮬레이터 및 계산 도구 모음입니다.

## 메트라이프 변액리치정기보험 초안

[시뮬레이터 열기](./metlife-variable-term.html) · [데이터·계산 범위와 검증](./docs/metlife-variable-term.md)

40세 남녀·10억 원·90세 만기의 공식 설계 예시를 조회합니다. 남성 추가납입 100% 비교, 사망보장, 적립형 전환의 주요 요건 확인, CSV 저장, 인쇄/PDF를 지원합니다. 범용 계리 추정 엔진은 아직 포함하지 않습니다.

개발: `node scripts/build-metlife.mjs` · 검증: `node --test tests/metlife.test.cjs`
