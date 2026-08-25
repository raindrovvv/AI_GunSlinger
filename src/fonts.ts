/** Canvas/UI에서 한글·커스텀 폰트가 준비될 때까지 대기 */
export function loadGameFonts(): Promise<void> {
  const samples = [
    '700 16px "Paperlogy"',
    '400 16px "IBM Plex Sans KR"',
    '400 16px "Black Han Sans"',
    '400 16px "Special Elite"',
  ]

  return Promise.all(samples.map((sample) => document.fonts.load(sample))).then(() => undefined)
}

export const CANVAS_LABEL_FONT =
  '"IBM Plex Sans KR", "Black Han Sans", "Paperlogy", sans-serif'
