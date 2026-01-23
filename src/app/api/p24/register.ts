// src/pages/api/p24/register.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'

const {
  P24_MERCHANT_ID,
  P24_POS_ID,
  P24_CRC_KEY,
  P24_ENVIRONMENT,
} = process.env

const P24_URL =
  P24_ENVIRONMENT === 'production'
    ? 'https://secure.przelewy24.pl'
    : 'https://sandbox.przelewy24.pl'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  const { sessionId, amount, currency = 'PLN', description, email, ...rest } = req.body
  if (!sessionId || !amount || !description || !email) {
    return res.status(400).json({ error: 'Brakuje wymaganych pól.' })
  }

  // 1) Oblicz podpis
  const signString = [
    P24_MERCHANT_ID,
    P24_POS_ID,
    sessionId,
    amount,
    currency,
    P24_CRC_KEY,
  ].join('|')
  const sign = crypto.createHash('sha384').update(signString).digest('hex')

  // 2) Przygotuj payload
  const payload = {
    merchantId: Number(P24_MERCHANT_ID),
    posId:      Number(P24_POS_ID),
    sessionId,
    amount:     Number(amount),
    currency,
    description,
    email,
    sign,
    // opcjonalnie: urlReturn, urlStatus, clientName, clientAddress, itd.
    ...rest,
  }

  try {
    const r = await fetch(`${P24_URL}/api/v1/transaction/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await r.json()
    if (data.status !== 'success') {
      console.error('P24 register error:', data)
      return res.status(502).json({ error: 'Rejestracja transakcji nie powiodła się', detail: data })
    }
    // 3) Zwróć klientowi token i redirect URL
    return res.status(200).json({
      token: data.data.token,
      url:   data.data.redirectUrl,
    })
  } catch (err: any) {
    console.error('Fetch P24 error:', err)
    return res.status(500).json({ error: 'Błąd połączenia z Przelewy24' })
  }
}
