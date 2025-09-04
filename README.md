# Vetta MVP

AI-powered risk assessment for Buy Here Pay Here dealerships.

## Stack
- Next.js App Router
- Clerk (auth)
- Supabase (DB + RLS)
- OpenAI (risk analysis)
- Tailwind CSS
- @react-pdf/renderer (printable QR cards)

## Quickstart
1) Clone & install
   npm install

2) Create .env.local (see repo root)

3) Dev
   npm run dev

4) Supabase schema
   Run supabase/migrations/001_init.sql in the SQL Editor.

5) Deploy to Vercel
   - Connect GitHub repo
   - Add Environment Variables in Vercel (same as .env.local)
   - Deploy
