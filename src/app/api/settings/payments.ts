// src/pages/api/settings/payments.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Pobierz jedyny wiersz z settings
    const { data, error } = await supabase
      .from('payment_settings')
      .select('*')
      .limit(1)
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    const payload = req.body
    // upsert: jeżeli jest, nadpisz; jeżeli nie, wstaw nowy
    const { data, error } = await supabase
      .from('payment_settings')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  res.setHeader('Allow', ['GET', 'POST', 'PATCH'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
