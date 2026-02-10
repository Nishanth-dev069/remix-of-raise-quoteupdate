import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import QuotationBuilder from '@/components/quotation/QuotationBuilder'

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function SalesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Use service role to fetch products to bypass RLS for sales users
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

  // Fetch initial data in parallel with optimized queries
  const [productsResponse, settingsResponse, profileResponse] = await Promise.all([
    supabaseAdmin
      .from('products')
      .select('id, name, description, price, image_url, sku, specs, features, category, addons, image_format')
      .eq('active', true)
      .order('name'),
    supabaseAdmin
      .from('settings')
      .select('id, company_name, company_logo, company_address, company_phone, company_email, tax_rate, currency_symbol')
      .eq('id', 1)
      .single(),
    supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, role, active, phone')
      .eq('id', user.id)
      .single()
  ])

  // Role-check and redirect for admin
  if (profileResponse.data?.role === 'admin') {
    redirect('/admin/quotations')
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <QuotationBuilder
        initialProducts={productsResponse.data || []}
        settings={settingsResponse.data}
        user={profileResponse.data}
      />
    </div>
  )
}
