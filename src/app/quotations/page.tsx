import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import QuotationsList from '@/components/quotation/QuotationsList'

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function SalesQuotationsPage() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user || authError) {
    redirect('/auth/login')
  }

  // Use admin client to fetch profile to bypass RLS
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="mx-auto max-w-6xl p-8">
        <QuotationsList user={profile} userId={user.id} />
      </div>
    </div>
  )

}
