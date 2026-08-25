import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const ok = !!process.env.OPENAI_API_KEY
  return res.status(ok ? 200 : 503).json({ ok })
}
