import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import AdminQuotationsClient from '@/components/admin/AdminQuotationsClient'

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function QuotationsTrackingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Use service role to fetch all quotations and bypass RLS
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

  // Verify user is admin
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/')
  }

  // Fetch all quotations with service role to bypass RLS
  const { data: quotations, error } = await supabaseAdmin
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
    .limit(100)

  if (error) {
    console.error('Error fetching quotations:', error)
  }

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

  return <AdminQuotationsClient initialQuotations={transformedQuotations} />
}
