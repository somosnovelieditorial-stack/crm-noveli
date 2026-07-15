-- SQL Schema for Somos Noveli Editorial CRM (Updated with Multi-tenant Organizations and RLS Permissions)
-- This script creates the required database tables, defines helper functions for multi-tenancy,
-- enables Row Level Security (RLS), and sets up organization-scoped policies.

-- =========================================================================
-- 0. CORE MULTI-TENANCY TABLES & FUNCTIONS
-- =========================================================================

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create organization_members table
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('administrador', 'editor', 'diseñador', 'corrector', 'contador', 'solo lectura')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    UNIQUE (organization_id, user_id)
);

-- Create user_profiles (Optional, but created for schema completeness)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Helper function to resolve the organization UUID of the active user
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid() AND active = true
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function to resolve the role of the active user
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
    SELECT role 
    FROM organization_members 
    WHERE user_id = auth.uid() AND active = true
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- =========================================================================
-- 1. BUSINESS TABLES
-- =========================================================================

-- 1. PROVIDERS Table
CREATE TABLE IF NOT EXISTS providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('abogado', 'diseñador', 'imprenta', 'contador', 'software', 'publicidad', 'otro')),
    email TEXT,
    phone TEXT,
    country TEXT,
    service_provided TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. CLIENTS Table
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    name TEXT NOT NULL,
    email TEXT,
    instagram TEXT,
    phone TEXT,
    country TEXT,
    city TEXT,
    client_type TEXT DEFAULT 'Nacional',
    preferred_currency TEXT DEFAULT 'CLP',
    status TEXT NOT NULL DEFAULT 'prospecto' CHECK (status IN (
      'prospecto', 'interesado', 'contrato enviado', 'acuerdo enviado',
      'link de pago enviado', 'esperando pago', 'pago recibido',
      'contrato firmado recibido', 'esperando contrato firmado',
      'esperando manuscrito/archivos', 'esperando archivos/materiales',
      'listo para iniciar', 'en proceso editorial', 'en proceso',
      'finalizado', 'perdido / rechazado', 'perdido'
    )),
    notes TEXT,
    
    -- Commercial & billing fields
    interest_service TEXT,
    total_agreed_amount NUMERIC(12,2) DEFAULT 0.00,
    includes_vat BOOLEAN DEFAULT FALSE,
    payment_status TEXT DEFAULT 'sin pago',
    amount_paid NUMERIC(12,2) DEFAULT 0.00,
    balance_due NUMERIC(12,2) DEFAULT 0.00,
    payment_method TEXT,
    paid_at DATE,
    payment_link_sent BOOLEAN DEFAULT FALSE,
    payment_link_sent_at DATE,
    contract_sent BOOLEAN DEFAULT FALSE,
    contract_sent_at DATE,
    contract_signed_received BOOLEAN DEFAULT FALSE,
    contract_signed_received_at DATE,
    files_received BOOLEAN DEFAULT FALSE,
    files_received_at DATE,
    ready_to_start BOOLEAN DEFAULT FALSE,
    agreement_notes TEXT,
    currency TEXT DEFAULT 'CLP',

    -- Dynamic requirements & services fields
    selected_services JSONB DEFAULT '[]'::jsonb,
    service_category TEXT DEFAULT 'editorial',
    agreement_period_type TEXT,
    materials_received BOOLEAN DEFAULT FALSE,
    materials_received_at DATE,
    partial_payment_authorized BOOLEAN DEFAULT FALSE,
    ready_to_start_reason TEXT,
    services_summary TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. PROSPECTS Table
CREATE TABLE IF NOT EXISTS prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    name TEXT NOT NULL,
    email TEXT,
    instagram TEXT,
    phone TEXT,
    contact TEXT,
    origin TEXT NOT NULL DEFAULT 'Instagram' CHECK (origin IN ('Instagram', 'web', 'referido', 'correo', 'otro')),
    interest_service TEXT,
    probability TEXT NOT NULL DEFAULT 'media' CHECK (probability IN ('baja', 'media', 'alta')),
    next_action TEXT,
    followup_date DATE,
    follow_up_date DATE,
    notes TEXT,
    country TEXT,
    city TEXT,
    client_type TEXT DEFAULT 'Nacional',
    preferred_currency TEXT DEFAULT 'CLP',
    converted_to_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    converted_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    converted_to_client BOOLEAN DEFAULT FALSE,
    converted_at TIMESTAMP WITH TIME ZONE,

    -- Commercial & billing fields
    total_agreed_amount NUMERIC(12,2) DEFAULT 0.00,
    agreed_amount NUMERIC(12,2) DEFAULT 0.00,
    amount NUMERIC(12,2) DEFAULT 0.00,
    includes_vat BOOLEAN DEFAULT FALSE,
    includes_iva BOOLEAN DEFAULT FALSE,
    payment_status TEXT DEFAULT 'sin pago' CHECK (payment_status IN ('sin pago', 'pendiente', 'pago parcial', 'pagado')),
    amount_paid NUMERIC(12,2) DEFAULT 0.00,
    balance_due NUMERIC(12,2) DEFAULT 0.00,
    payment_method TEXT,
    paid_at DATE,
    payment_date DATE,
    payment_link_sent BOOLEAN DEFAULT FALSE,
    payment_link_sent_at DATE,
    contract_sent BOOLEAN DEFAULT FALSE,
    contract_sent_at DATE,
    contract_signed_received BOOLEAN DEFAULT FALSE,
    contract_signed_received_at DATE,
    files_received BOOLEAN DEFAULT FALSE,
    files_received_at DATE,
    ready_to_start BOOLEAN DEFAULT FALSE,
    agreement_notes TEXT,
    currency TEXT DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD', 'EUR')),

    -- Dynamic requirements & services fields
    selected_services JSONB DEFAULT '[]'::jsonb,
    service_category TEXT DEFAULT 'editorial' CHECK (service_category IN ('editorial', 'publicidad', 'diseño', 'asesoría', 'otro')),
    agreement_period_type TEXT,
    agreement_start_date DATE,
    agreement_duration_value TEXT,
    agreement_duration_unit TEXT CHECK (agreement_duration_unit IN ('meses', 'semanas', 'días', 'años')),
    agreement_end_date DATE,
    materials_received BOOLEAN DEFAULT FALSE,
    materials_received_at DATE,
    partial_payment_authorized BOOLEAN DEFAULT FALSE,
    ready_to_start_reason TEXT,
    services_summary TEXT,
    status TEXT DEFAULT 'prospecto' CHECK (status IN (
      'prospecto', 'interesado', 'contrato enviado', 'acuerdo enviado',
      'link de pago enviado', 'esperando pago', 'pago recibido',
      'contrato firmado recibido', 'esperando contrato firmado',
      'esperando manuscrito/archivos', 'esperando archivos/materiales',
      'listo para iniciar', 'en proceso editorial', 'en proceso',
      'finalizado', 'perdido / rechazado', 'perdido'
    )),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. SERVICES Table
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('corrección', 'maquetación', 'portada', 'ebook', 'libro físico', 'difusión', 'derechos de autor', 'asesoría de publicación', 'otro')),
    service_type TEXT,
    title TEXT,
    book_title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'recibido' CHECK (status IN ('recibido', 'contrato pendiente', 'pago pendiente', 'en revisión', 'en corrección', 'en diseño', 'en maquetación', 'entregado', 'cerrado')),
    value NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_agreed_amount NUMERIC(12,2) DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD', 'EUR')),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    estimated_delivery DATE,
    estimated_delivery_date DATE,
    notes TEXT,
    stage TEXT,
    current_stage TEXT NOT NULL DEFAULT 'recepción de material',
    advance_percent INTEGER NOT NULL DEFAULT 0 CHECK (advance_percent >= 0 AND advance_percent <= 100),
    exchange_rate NUMERIC(12,4) NOT NULL DEFAULT 1.0000,
    value_converted NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    rate_date DATE,

    -- Missing columns
    service_name TEXT,
    amount_paid NUMERIC(12,2) DEFAULT 0.00,
    balance_due NUMERIC(12,2) DEFAULT 0.00,
    payment_status TEXT DEFAULT 'pendiente' CHECK (payment_status IN ('sin pago', 'pendiente', 'pago parcial', 'pagado')),
    payment_method TEXT,
    paid_at DATE,
    contract_duration_value INTEGER DEFAULT 6,
    contract_duration_unit TEXT DEFAULT 'meses' CHECK (contract_duration_unit IN ('meses', 'semanas', 'días', 'años')),
    contract_notes TEXT,
    agreement_notes TEXT,
    payment_link_sent BOOLEAN DEFAULT FALSE,
    payment_link_sent_at DATE,
    contract_sent BOOLEAN DEFAULT FALSE,
    contract_sent_at DATE,
    contract_signed_received BOOLEAN DEFAULT FALSE,
    contract_signed_received_at DATE,
    files_received BOOLEAN DEFAULT FALSE,
    files_received_at DATE,
    ready_to_start BOOLEAN DEFAULT FALSE,
    contract_start_date DATE,
    contract_end_date DATE,
    service_category TEXT DEFAULT 'editorial' CHECK (service_category IN ('editorial', 'publicidad', 'diseño', 'asesoría', 'otro')),
    agreement_period_type TEXT,
    materials_received BOOLEAN DEFAULT FALSE,
    materials_received_at DATE,
    partial_payment_authorized BOOLEAN DEFAULT FALSE,
    ready_to_start_reason TEXT,
    selected_services JSONB DEFAULT '[]'::jsonb,
    services_summary TEXT,
    progress INTEGER DEFAULT 0,
    stage_progress INTEGER DEFAULT 0,
    checklist_progress INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. SERVICE_STAGES (Timeline) Table
CREATE TABLE IF NOT EXISTS service_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    stage_name TEXT NOT NULL,
    name TEXT,
    description TEXT,
    order_index INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en proceso', 'completada')),
    start_date DATE,
    end_date DATE,
    started_at DATE,
    completed_at DATE,
    responsible TEXT,
    notes TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. INCOMES Table
CREATE TABLE IF NOT EXISTS incomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL,
    includes_vat BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'pagado' CHECK (status IN ('pagado', 'pendiente', 'parcial')),
    notes TEXT,
    source TEXT,
    exchange_rate NUMERIC(12,4) NOT NULL DEFAULT 1.0000,
    value_converted NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    rate_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. EXPENSES Table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
    category TEXT NOT NULL CHECK (category IN ('software', 'diseño', 'impresión', 'publicidad', 'legal', 'impuestos', 'oficina virtual', 'otros')),
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    includes_vat BOOLEAN NOT NULL DEFAULT FALSE,
    deductible BOOLEAN NOT NULL DEFAULT TRUE,
    affects_cashflow BOOLEAN NOT NULL DEFAULT TRUE,
    tax_payment BOOLEAN NOT NULL DEFAULT FALSE,
    tax_type TEXT,
    source TEXT,
    notes TEXT,
    payroll_payment_id UUID,
    status TEXT NOT NULL DEFAULT 'pagado' CHECK (status IN ('pagado', 'pendiente', 'parcial')),
    exchange_rate NUMERIC(12,4) NOT NULL DEFAULT 1.0000,
    value_converted NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    rate_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. SERVICE_CATALOG Table
CREATE TABLE IF NOT EXISTS service_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    name TEXT NOT NULL,
    description TEXT,
    base_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
    includes_vat BOOLEAN NOT NULL DEFAULT FALSE,
    category TEXT NOT NULL CHECK (category IN ('editorial', 'diseño', 'legal', 'asesoría', 'publicidad', 'impresión', 'otro', 'corrección', 'maquetación', 'difusión', 'derechos de autor', 'publicación')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    requires_manuscript BOOLEAN NOT NULL DEFAULT TRUE,
    requires_materials BOOLEAN NOT NULL DEFAULT FALSE,
    requires_signed_contract BOOLEAN NOT NULL DEFAULT TRUE,
    requires_agreement_sent BOOLEAN NOT NULL DEFAULT FALSE,
    requires_duration BOOLEAN NOT NULL DEFAULT FALSE,
    includes_text TEXT,
    excludes_text TEXT,
    default_work_timeline TEXT,
    default_payment_terms TEXT,
    default_start_conditions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. SERVICE_PACKS Table
CREATE TABLE IF NOT EXISTS service_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    name TEXT NOT NULL,
    description TEXT,
    price_special NUMERIC(12,2),
    currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
    includes_vat BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    category TEXT,
    requires_manuscript BOOLEAN NOT NULL DEFAULT TRUE,
    requires_materials BOOLEAN NOT NULL DEFAULT FALSE,
    requires_signed_contract BOOLEAN NOT NULL DEFAULT TRUE,
    requires_agreement_sent BOOLEAN NOT NULL DEFAULT FALSE,
    requires_duration BOOLEAN NOT NULL DEFAULT FALSE,
    includes_text TEXT,
    excludes_text TEXT,
    default_work_timeline TEXT,
    default_payment_terms TEXT,
    default_start_conditions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. SERVICE_PACK_ITEMS Table
CREATE TABLE IF NOT EXISTS service_pack_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    pack_id UUID NOT NULL REFERENCES service_packs(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES service_catalog(id) ON DELETE CASCADE
);

-- 11. QUOTATIONS Table
CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
    author_name TEXT,
    author_email TEXT,
    author_phone TEXT,
    author_instagram TEXT,
    origin TEXT,
    country TEXT,
    city TEXT,
    object TEXT,
    quote_number TEXT,
    issue_date DATE,
    valid_until DATE,
    validity_days INTEGER DEFAULT 15,
    manuscript_pages INTEGER DEFAULT 0,
    extension_adjustment_type TEXT DEFAULT 'percentage',
    extension_adjustment_value NUMERIC(12,2) DEFAULT 0.00,
    subtotal NUMERIC(12,2) DEFAULT 0.00,
    discount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12,2) DEFAULT 0.00,
    total NUMERIC(12,2) DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
    includes_iva BOOLEAN NOT NULL DEFAULT FALSE,
    iva_mode TEXT DEFAULT 'IVA incluido',
    tax_rate NUMERIC(5,2) DEFAULT 19.00,
    net_amount NUMERIC(12,2) DEFAULT 0.00,
    payment_plan_type TEXT DEFAULT '50_inicio_50_termino',
    upfront_percentage NUMERIC(5,2) DEFAULT 50.00,
    installments INTEGER DEFAULT 1,
    included_items JSONB DEFAULT '[]'::jsonb,
    excluded_items JSONB DEFAULT '[]'::jsonb,
    start_condition_items JSONB DEFAULT '[]'::jsonb,
    proposal_format TEXT DEFAULT 'Formal completo',
    show_signatures BOOLEAN DEFAULT TRUE,
    has_alternatives BOOLEAN DEFAULT FALSE,
    payment_terms TEXT,
    work_timeline TEXT,
    includes_notes TEXT,
    excludes_notes TEXT,
    start_conditions TEXT,
    legal_notes TEXT,
    other_notes TEXT,
    status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'enviada', 'aceptada', 'rechazada', 'vencida', 'convertida a prospecto')),
    pdf_url TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    converted_to_prospect BOOLEAN DEFAULT FALSE,
    converted_prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
    converted_at TIMESTAMP WITH TIME ZONE,
    converted_to_service BOOLEAN DEFAULT FALSE,
    service_id UUID,
    notes TEXT,
    exchange_rate NUMERIC(12,4) NOT NULL DEFAULT 1.0000,
    value_converted NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    rate_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. QUOTATION_ITEMS Table
CREATE TABLE IF NOT EXISTS quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    catalog_id UUID REFERENCES service_catalog(id) ON DELETE SET NULL,
    pack_id UUID REFERENCES service_packs(id) ON DELETE SET NULL,
    concept TEXT,
    description TEXT,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    quantity INTEGER NOT NULL DEFAULT 1,
    total NUMERIC(12,2) DEFAULT 0.00,
    source_type TEXT,
    display_order INTEGER DEFAULT 0
);

-- 13. QUICK_REPLIES Table
CREATE TABLE IF NOT EXISTS quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    title TEXT NOT NULL,
    shortcut TEXT,
    category TEXT,
    channel TEXT DEFAULT 'general' CHECK (channel IN ('Instagram', 'correo', 'WhatsApp', 'general')),
    message_text TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 14. DOCUMENTS Table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    name TEXT,
    file_path TEXT NOT NULL, -- Storage path
    file_type TEXT,
    title TEXT,
    document_type TEXT CHECK (document_type IN ('contrato', 'factura', 'boleta', 'comprobante de pago', 'manuscrito', 'portada', 'archivo final', 'documento legal', 'imagen', 'otro')),
    file_name TEXT,
    file_url TEXT,
    mime_type TEXT,
    file_size BIGINT,
    notes TEXT,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
    income_id UUID REFERENCES incomes(id) ON DELETE SET NULL,
    expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15. SETTINGS Table
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    editorial_name TEXT NOT NULL DEFAULT 'Somos Noveli Editorial',
    logo TEXT,
    email TEXT,
    address TEXT,
    base_country TEXT DEFAULT 'Chile',
    currency_primary TEXT DEFAULT 'CLP',
    currencies_secondary TEXT[] DEFAULT ARRAY['USD', 'EUR'],
    vat_rate NUMERIC(4,2) DEFAULT 19.00,
    bank_details TEXT,
    quotation_notes TEXT,
    quotation_legal TEXT,
    logo_url TEXT,
    favicon_url TEXT,
    UNIQUE(organization_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15.1. COMPANY_SETTINGS Table
CREATE TABLE IF NOT EXISTS company_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    company_name TEXT NOT NULL DEFAULT 'EDITORIAL NOVELI',
    commercial_name TEXT NOT NULL DEFAULT 'Somos Noveli Editorial',
    representative_name TEXT NOT NULL DEFAULT 'Javier Román González',
    representative_role TEXT NOT NULL DEFAULT 'Representante Noveli Editorial',
    official_email TEXT NOT NULL DEFAULT 'somosnovelieditorial@gmail.com',
    phone TEXT,
    website_url TEXT NOT NULL DEFAULT 'https://www.somosnovelieditorial.com',
    instagram_url TEXT NOT NULL DEFAULT 'https://www.instagram.com/editorialnoveli/',
    address TEXT NOT NULL DEFAULT 'Santa Magdalena 75 Of 304, Providencia',
    city TEXT NOT NULL DEFAULT 'Santiago',
    country TEXT NOT NULL DEFAULT 'Chile',
    tax_id TEXT,
    logo_url TEXT,
    favicon_url TEXT,
    signature_name TEXT NOT NULL DEFAULT 'Javier Román González',
    default_legal_text TEXT,
    default_footer_text TEXT NOT NULL DEFAULT 'Los derechos de la obra pertenecen siempre al autor.',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(organization_id)
);

-- 16. EXCHANGE_RATES Table
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    currency_from TEXT NOT NULL DEFAULT 'USD',
    currency_to TEXT NOT NULL DEFAULT 'CLP',
    rate NUMERIC(12,4) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    source TEXT DEFAULT 'Manual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(organization_id, currency_from, currency_to, date)
);

-- 17. EDITORIAL_STAGES Table
CREATE TABLE IF NOT EXISTS editorial_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    name TEXT NOT NULL,
    description TEXT,
    "order" INTEGER NOT NULL DEFAULT 1,
    color TEXT DEFAULT '#3b82f6',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 18. SERVICE_CHECKLISTS Table
CREATE TABLE IF NOT EXISTS service_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    task TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en proceso', 'completada')),
    completed BOOLEAN DEFAULT FALSE,
    completed_at DATE,
    responsible TEXT,
    due_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 19. ACTIVITY_LOG Table
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    user_email TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    entity_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 20. AGENDA_EVENTS Table
CREATE TABLE IF NOT EXISTS agenda_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    title TEXT NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    is_all_day BOOLEAN DEFAULT FALSE,
    color TEXT,
    category TEXT CHECK (category IN ('reunión', 'entrega', 'hito', 'cobro', 'otro')),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    date TEXT,
    time TEXT,
    type TEXT,
    status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en proceso', 'completada', 'vencida')),
    notes TEXT,
    stage_id UUID REFERENCES service_stages(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- =========================================================================
-- 2. ROW LEVEL SECURITY (RLS) ACTIVATION & POLICIES
-- =========================================================================

-- Enable RLS for all core and business tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_pack_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE editorial_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_events ENABLE ROW LEVEL SECURITY;

-- Clean drop any existing legacy policies
DROP POLICY IF EXISTS "Users can manage their own providers" ON providers;
DROP POLICY IF EXISTS "Users can manage their own clients" ON clients;
DROP POLICY IF EXISTS "Users can manage their own prospects" ON prospects;
DROP POLICY IF EXISTS "Users can manage their own services" ON services;
DROP POLICY IF EXISTS "Users can manage their own service_stages" ON service_stages;
DROP POLICY IF EXISTS "Users can manage their own incomes" ON incomes;
DROP POLICY IF EXISTS "Users can manage their own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can manage their own service_catalog" ON service_catalog;
DROP POLICY IF EXISTS "Users can manage their own service_packs" ON service_packs;
DROP POLICY IF EXISTS "Users can manage their own service_pack_items" ON service_pack_items;
DROP POLICY IF EXISTS "Users can manage their own quotations" ON quotations;
DROP POLICY IF EXISTS "Users can manage their own quotation_items" ON quotation_items;
DROP POLICY IF EXISTS "Users can manage their own quick_replies" ON quick_replies;
DROP POLICY IF EXISTS "Users can manage their own documents" ON documents;
DROP POLICY IF EXISTS "Users can manage their own settings" ON settings;
DROP POLICY IF EXISTS "Users can manage their own exchange_rates" ON exchange_rates;
DROP POLICY IF EXISTS "Users can manage their own editorial_stages" ON editorial_stages;
DROP POLICY IF EXISTS "Users can manage their own service_checklists" ON service_checklists;
DROP POLICY IF EXISTS "Users can manage their own activity_log" ON activity_log;
DROP POLICY IF EXISTS "Users can manage their own agenda_events" ON agenda_events;

-- RLS Policies for Organizations & Members
CREATE POLICY "Select organization" ON organizations FOR SELECT USING (id = get_user_org_id());
CREATE POLICY "Manage organization" ON organizations FOR ALL USING (id = get_user_org_id() AND get_user_role() = 'administrador');

CREATE POLICY "Select members" ON organization_members FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Manage members" ON organization_members FOR ALL USING (organization_id = get_user_org_id() AND get_user_role() = 'administrador');

CREATE POLICY "Select profile" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Manage profile" ON user_profiles FOR ALL USING (auth.uid() = id);

-- Macro helper generator: Group definitions of RLS Policies for business tables.
-- A user belongs to the same organization if get_user_org_id() matches the row's organization_id or they are the direct owner.
-- In addition, write access (Insert, Update, Delete) is blocked if user has 'solo lectura' role.

-- 1. PROVIDERS
CREATE POLICY "Select providers" ON providers FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert providers" ON providers FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update providers" ON providers FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete providers" ON providers FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 2. CLIENTS
CREATE POLICY "Select clients" ON clients FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert clients" ON clients FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update clients" ON clients FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete clients" ON clients FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 3. PROSPECTS
CREATE POLICY "Select prospects" ON prospects FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert prospects" ON prospects FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update prospects" ON prospects FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete prospects" ON prospects FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 4. SERVICES
CREATE POLICY "Select services" ON services FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert services" ON services FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update services" ON services FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete services" ON services FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 5. SERVICE_STAGES
CREATE POLICY "Select service_stages" ON service_stages FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert service_stages" ON service_stages FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update service_stages" ON service_stages FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete service_stages" ON service_stages FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 6. INCOMES
CREATE POLICY "Select incomes" ON incomes FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert incomes" ON incomes FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update incomes" ON incomes FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete incomes" ON incomes FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 7. EXPENSES
CREATE POLICY "Select expenses" ON expenses FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert expenses" ON expenses FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update expenses" ON expenses FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete expenses" ON expenses FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 8. SERVICE_CATALOG
CREATE POLICY "Select service_catalog" ON service_catalog FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert service_catalog" ON service_catalog FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update service_catalog" ON service_catalog FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete service_catalog" ON service_catalog FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 9. SERVICE_PACKS
CREATE POLICY "Select service_packs" ON service_packs FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert service_packs" ON service_packs FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update service_packs" ON service_packs FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete service_packs" ON service_packs FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 10. SERVICE_PACK_ITEMS
CREATE POLICY "Select service_pack_items" ON service_pack_items FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert service_pack_items" ON service_pack_items FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update service_pack_items" ON service_pack_items FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete service_pack_items" ON service_pack_items FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 11. QUOTATIONS
CREATE POLICY "Select quotations" ON quotations FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert quotations" ON quotations FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update quotations" ON quotations FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete quotations" ON quotations FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 12. QUOTATION_ITEMS
CREATE POLICY "Select quotation_items" ON quotation_items FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert quotation_items" ON quotation_items FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update quotation_items" ON quotation_items FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete quotation_items" ON quotation_items FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 13. QUICK_REPLIES
CREATE POLICY "Select quick_replies" ON quick_replies FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert quick_replies" ON quick_replies FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update quick_replies" ON quick_replies FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete quick_replies" ON quick_replies FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 14. DOCUMENTS
CREATE POLICY "Select documents" ON documents FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert documents" ON documents FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update documents" ON documents FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete documents" ON documents FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 15. SETTINGS (Only administrator role can modify settings)
CREATE POLICY "Select settings" ON settings FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert settings" ON settings FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND get_user_role() = 'administrador');
CREATE POLICY "Update settings" ON settings FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() = 'administrador');
CREATE POLICY "Delete settings" ON settings FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND get_user_role() = 'administrador');

-- 16. EXCHANGE_RATES
CREATE POLICY "Select exchange_rates" ON exchange_rates FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert exchange_rates" ON exchange_rates FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update exchange_rates" ON exchange_rates FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete exchange_rates" ON exchange_rates FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 17. EDITORIAL_STAGES
CREATE POLICY "Select editorial_stages" ON editorial_stages FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert editorial_stages" ON editorial_stages FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update editorial_stages" ON editorial_stages FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete editorial_stages" ON editorial_stages FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 18. SERVICE_CHECKLISTS
CREATE POLICY "Select service_checklists" ON service_checklists FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert service_checklists" ON service_checklists FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update service_checklists" ON service_checklists FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete service_checklists" ON service_checklists FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 19. ACTIVITY_LOG
CREATE POLICY "Select activity_log" ON activity_log FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert activity_log" ON activity_log FOR INSERT WITH CHECK (auth.uid() = user_id OR organization_id = get_user_org_id()); -- Anyone can log activity
CREATE POLICY "Update activity_log" ON activity_log FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() = 'administrador');
CREATE POLICY "Delete activity_log" ON activity_log FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND get_user_role() = 'administrador');

-- 20. AGENDA_EVENTS
CREATE POLICY "Select agenda_events" ON agenda_events FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert agenda_events" ON agenda_events FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update agenda_events" ON agenda_events FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete agenda_events" ON agenda_events FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));


-- =========================================================================
-- 3. PERFORMANCE INDEXES
-- =========================================================================

-- Legacy User ID Indexes
CREATE INDEX IF NOT EXISTS idx_providers_user_id ON providers(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_prospects_user_id ON prospects(user_id);
CREATE INDEX IF NOT EXISTS idx_services_user_id ON services(user_id);
CREATE INDEX IF NOT EXISTS idx_service_stages_serv ON service_stages(service_id);
CREATE INDEX IF NOT EXISTS idx_incomes_user_id ON incomes(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_catalog_user_id ON service_catalog(user_id);
CREATE INDEX IF NOT EXISTS idx_packs_user_id ON service_packs(user_id);
CREATE INDEX IF NOT EXISTS idx_pack_items_pack ON service_pack_items(pack_id);
CREATE INDEX IF NOT EXISTS idx_quotations_user_id ON quotations(user_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quot ON quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quick_replies_user_id ON quick_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_user_id ON exchange_rates(user_id);
CREATE INDEX IF NOT EXISTS idx_editorial_stages_user_id ON editorial_stages(user_id);
CREATE INDEX IF NOT EXISTS idx_service_checklists_serv ON service_checklists(service_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_agenda_events_user_id ON agenda_events(user_id);

-- New Multi-tenant Organization ID Indexes
CREATE INDEX IF NOT EXISTS idx_organization_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_providers_org_id ON providers(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_org_id ON clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_prospects_org_id ON prospects(organization_id);
CREATE INDEX IF NOT EXISTS idx_services_org_id ON services(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_stages_org_id ON service_stages(organization_id);
CREATE INDEX IF NOT EXISTS idx_incomes_org_id ON incomes(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_org_id ON expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_catalog_org_id ON service_catalog(organization_id);
CREATE INDEX IF NOT EXISTS idx_packs_org_id ON service_packs(organization_id);
CREATE INDEX IF NOT EXISTS idx_pack_items_org_id ON service_pack_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_quotations_org_id ON quotations(organization_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_org_id ON quotation_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_quick_replies_org_id ON quick_replies(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_org_id ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_settings_org_id ON settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_org_id ON exchange_rates(organization_id);
CREATE INDEX IF NOT EXISTS idx_editorial_stages_org_id ON editorial_stages(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_checklists_org_id ON service_checklists(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_org_id ON activity_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_agenda_events_org_id ON agenda_events(organization_id);


-- =========================================================================
-- 4. DEFAULT DATA & ADMINS ASSOCIATION
-- =========================================================================

-- Insert default organization
INSERT INTO organizations (id, name)
VALUES ('org-noveli-1234', 'Somos Noveli Editorial')
ON CONFLICT (id) DO NOTHING;

-- Insert admins
DO $$
DECLARE
    org_id UUID := 'org-noveli-1234';
    v_user_id UUID;
    j_user_id UUID;
BEGIN
    -- Look up user ID for v.barrios@novelieditorial.com
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'v.barrios@novelieditorial.com';
    IF v_user_id IS NOT NULL THEN
        INSERT INTO organization_members (organization_id, user_id, role)
        VALUES (org_id, v_user_id, 'administrador')
        ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'administrador';
    END IF;

    -- Look up user ID for j.roman@novelieditorial.com
    SELECT id INTO j_user_id FROM auth.users WHERE email = 'j.roman@novelieditorial.com';
    IF j_user_id IS NOT NULL THEN
        INSERT INTO organization_members (organization_id, user_id, role)
    END IF;
END $$;

-- =========================================================================
-- MODULE: STAFF & OPERATIONAL RESERVE
-- =========================================================================

-- 1. STAFF Table
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('fundador', 'colaborador', 'proveedor recurrente', 'externo')),
    agreed_payment NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
    payment_frequency TEXT NOT NULL CHECK (payment_frequency IN ('mensual', 'proyecto', 'único')),
    status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'inactivo')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS policies for staff
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Select staff" ON staff FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert staff" ON staff FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update staff" ON staff FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete staff" ON staff FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 2. PAYROLL PAYMENTS Table
CREATE TABLE IF NOT EXISTS payroll_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'pagado')),
    notes TEXT,
    operational_expense BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS policies for payroll_payments
ALTER TABLE payroll_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Select payroll" ON payroll_payments FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "Insert payroll" ON payroll_payments FOR INSERT WITH CHECK (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update payroll" ON payroll_payments FOR UPDATE USING (organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete payroll" ON payroll_payments FOR DELETE USING (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 3. OPERATIONAL RESERVE MOVEMENTS Table
CREATE TABLE IF NOT EXISTS operational_reserve_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    type TEXT NOT NULL CHECK (type IN ('entrada', 'salida', 'ajuste')),
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS policies for operational_reserve_movements
ALTER TABLE operational_reserve_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Select reserve" ON operational_reserve_movements FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "Insert reserve" ON operational_reserve_movements FOR INSERT WITH CHECK (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update reserve" ON operational_reserve_movements FOR UPDATE USING (organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete reserve" ON operational_reserve_movements FOR DELETE USING (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- 4. INCOME ALLOCATIONS Table
CREATE TABLE IF NOT EXISTS income_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) DEFAULT get_user_org_id(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    income_id UUID REFERENCES incomes(id) ON DELETE CASCADE,
    area TEXT NOT NULL CHECK (area IN ('sueldos', 'reserva operacional', 'gastos del autor', 'publicidad', 'proveedores', 'impuestos', 'utilidad Noveli', 'otro')),
    allocation_type TEXT NOT NULL CHECK (allocation_type IN ('porcentaje', 'monto fijo')),
    value NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    calculated_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS policies for income_allocations
ALTER TABLE income_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Select allocations" ON income_allocations FOR SELECT USING (auth.uid() = user_id OR organization_id = get_user_org_id());
CREATE POLICY "Insert allocations" ON income_allocations FOR INSERT WITH CHECK ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update allocations" ON income_allocations FOR UPDATE USING (auth.uid() = user_id OR organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete allocations" ON income_allocations FOR DELETE USING ((auth.uid() = user_id OR organization_id = get_user_org_id()) AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- ==========================================
-- TABLE: website_services
-- ==========================================
CREATE TABLE IF NOT EXISTS website_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111',
    user_id UUID,
    title TEXT NOT NULL,
    short_description TEXT,
    full_description TEXT,
    price_from NUMERIC(15,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'CLP',
    category VARCHAR(50) DEFAULT 'Editorial',
    featured BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE website_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permit all operations for website_services" ON website_services
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ==========================================
-- TABLE: website_books
-- ==========================================
CREATE TABLE IF NOT EXISTS website_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111',
    user_id UUID,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    cover_url TEXT,
    short_description TEXT,
    genre VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Destacado',
    featured BOOLEAN DEFAULT FALSE,
    sale_url TEXT,
    sale_platform VARCHAR(50) DEFAULT 'Amazon',
    active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT check_sale_platform CHECK (sale_platform IN ('Amazon', 'Buscalibre', 'Wattpad', 'Página del autor', 'Otro'))
);

ALTER TABLE website_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permit all operations for website_books" ON website_books
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ==========================================
-- TABLE: website_settings
-- ==========================================
CREATE TABLE IF NOT EXISTS website_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) DEFAULT get_user_org_id(),
    user_id UUID DEFAULT auth.uid(),
    site_name TEXT DEFAULT 'Somos Noveli Editorial',
    public_url TEXT DEFAULT 'https://www.somosnovelieditorial.com/',
    short_description TEXT,
    contact_email TEXT,
    instagram_url TEXT,
    hero_title TEXT DEFAULT 'Somos Noveli Editorial',
    hero_subtitle TEXT DEFAULT 'Tu historia merece ser contada',
    logo_url TEXT,
    favicon_url TEXT,
    active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE website_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Select settings" ON website_settings FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "Insert settings" ON website_settings FOR INSERT WITH CHECK (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update settings" ON website_settings FOR UPDATE USING (organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete settings" ON website_settings FOR DELETE USING (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- Note: website_services and website_books are already created earlier, but let's make sure they have visible_on_website
ALTER TABLE website_services ADD COLUMN IF NOT EXISTS visible_on_website BOOLEAN DEFAULT TRUE;
ALTER TABLE website_books ADD COLUMN IF NOT EXISTS visible_on_website BOOLEAN DEFAULT TRUE;

-- ==========================================
-- TABLE: website_links
-- ==========================================
CREATE TABLE IF NOT EXISTS website_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) DEFAULT get_user_org_id(),
    user_id UUID DEFAULT auth.uid(),
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    link_type VARCHAR(50) DEFAULT 'compra',
    related_type VARCHAR(50),
    related_id VARCHAR(100),
    active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE website_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Select links" ON website_links FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "Insert links" ON website_links FOR INSERT WITH CHECK (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update links" ON website_links FOR UPDATE USING (organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete links" ON website_links FOR DELETE USING (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- ==========================================
-- TABLE: website_sections
-- ==========================================
CREATE TABLE IF NOT EXISTS website_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) DEFAULT get_user_org_id(),
    user_id UUID DEFAULT auth.uid(),
    section_key VARCHAR(50) UNIQUE NOT NULL,
    title TEXT,
    subtitle TEXT,
    content TEXT,
    image_url TEXT,
    active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE website_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Select sections" ON website_sections FOR SELECT USING (organization_id = get_user_org_id());
CREATE POLICY "Insert sections" ON website_sections FOR INSERT WITH CHECK (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));
CREATE POLICY "Update sections" ON website_sections FOR UPDATE USING (organization_id = get_user_org_id()) WITH CHECK (get_user_role() IS NULL OR get_user_role() <> 'solo lectura');
CREATE POLICY "Delete sections" ON website_sections FOR DELETE USING (organization_id = get_user_org_id() AND (get_user_role() IS NULL OR get_user_role() <> 'solo lectura'));

-- Ensure default organization exists
INSERT INTO organizations (id, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'Editorial Noveli')
ON CONFLICT (id) DO NOTHING;

-- Migrate all records with null organization_id to the default organization
UPDATE providers SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE clients SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE prospects SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE services SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE service_stages SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE incomes SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE expenses SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE service_catalog SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE service_packs SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE service_pack_items SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE quotations SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE quotation_items SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE quick_replies SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE documents SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE settings SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE exchange_rates SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE editorial_stages SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE service_checklists SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE activity_log SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE agenda_events SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE company_settings SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE staff SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE payroll_payments SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE operational_reserve_movements SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE income_allocations SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL;
UPDATE website_services SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL OR organization_id != '11111111-1111-1111-1111-111111111111';
UPDATE website_books SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL OR organization_id != '11111111-1111-1111-1111-111111111111';
UPDATE website_settings SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL OR organization_id != '11111111-1111-1111-1111-111111111111';
UPDATE website_links SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL OR organization_id != '11111111-1111-1111-1111-111111111111';
UPDATE website_sections SET organization_id = '11111111-1111-1111-1111-111111111111' WHERE organization_id IS NULL OR organization_id != '11111111-1111-1111-1111-111111111111';
