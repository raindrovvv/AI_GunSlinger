/** Canvas/UI에서 웹폰트가 준비될 때까지 대기 */
export function loadGameFonts(): Promise<void> {
  const samples = [
    '400 16px "IBM Plex Sans KR"',
    '400 16px "Noto Sans KR"',
    '400 16px "Black Han Sans"',
    '400 16px "Gowun Batang"',
    '400 16px "Noto Serif KR"',
    '400 16px "Special Elite"',
  ]

  return Promise.allSettled(samples.map((sample) => document.fonts.load(sample))).then(() => {
    document.documentElement.classList.add('fonts-ready')
  })
}

export const CANVAS_LABEL_FONT =
  '"IBM Plex Sans KR", "Noto Sans KR", "Black Han Sans", sans-serif'
