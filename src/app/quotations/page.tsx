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

  // Fetch quotations with proper filtering
  let quotationsQuery = supabaseAdmin
    .from('quotations')
    .select(`
      id,
      quotation_number,
      customer_name,
      grand_total,
      created_at,
      pdf_url,
      created_by,
      profiles!created_by (full_name)
    `)
    .order('created_at', { ascending: false })

  // Filter by user ID for non-admin users
  if (profile?.role !== 'admin') {
    quotationsQuery = quotationsQuery.eq('created_by', user.id)
  }

  const { data: quotations } = await quotationsQuery

  // Transform the data to match the expected type
  const transformedQuotations = (quotations || []).map((q: any) => ({
    id: q.id,
    quotation_number: q.quotation_number,
    customer_name: q.customer_name,
    grand_total: q.grand_total,
    created_at: q.created_at,
    pdf_url: q.pdf_url,
    profiles: {
      full_name: q.profiles?.[0]?.full_name || q.profiles?.full_name || 'Unknown'
    }
  }))

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="mx-auto max-w-6xl p-8">
        <QuotationsList
          user={profile}
          userId={user.id}
          initialQuotations={transformedQuotations}
        />
      </div>
    </div>
  )

}
