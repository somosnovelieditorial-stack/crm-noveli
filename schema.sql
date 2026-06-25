-- SQL Schema for Somos Noveli Editorial CRM (Updated with Stage Trackings and Timelines)
-- This script creates the required database tables, enables Row Level Security (RLS),
-- and sets up RLS policies so that each authenticated user can only access their own data.

-- 1. PROVIDERS Table
CREATE TABLE IF NOT EXISTS providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
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
    name TEXT NOT NULL,
    email TEXT,
    instagram TEXT,
    phone TEXT,
    country TEXT,
    status TEXT NOT NULL DEFAULT 'prospecto' CHECK (status IN ('prospecto', 'cliente', 'activo', 'finalizado', 'perdido')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. PROSPECTS Table
CREATE TABLE IF NOT EXISTS prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    name TEXT NOT NULL,
    contact TEXT,
    origin TEXT NOT NULL DEFAULT 'Instagram' CHECK (origin IN ('Instagram', 'web', 'referido', 'correo', 'otro')),
    interest_service TEXT,
    probability TEXT NOT NULL DEFAULT 'media' CHECK (probability IN ('baja', 'media', 'alta')),
    next_action TEXT,
    followup_date DATE,
    notes TEXT,
    converted_to_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. SERVICES Table
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('corrección', 'maquetación', 'portada', 'ebook', 'libro físico', 'difusión', 'derechos de autor', 'asesoría de publicación', 'otro')),
    book_title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'recibido' CHECK (status IN ('recibido', 'contrato pendiente', 'pago pendiente', 'en revisión', 'en corrección', 'en diseño', 'en maquetación', 'entregado', 'cerrado')),
    value NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    estimated_delivery DATE,
    notes TEXT,
    current_stage TEXT NOT NULL DEFAULT 'recepción de material',
    advance_percent INTEGER NOT NULL DEFAULT 0 CHECK (advance_percent >= 0 AND advance_percent <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. SERVICE_STAGES (Timeline) Table
CREATE TABLE IF NOT EXISTS service_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    stage_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en proceso', 'completada')),
    start_date DATE,
    end_date DATE,
    responsible TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. INCOMES Table
CREATE TABLE IF NOT EXISTS incomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL,
    includes_vat BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'pagado' CHECK (status IN ('pagado', 'pendiente', 'parcial')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. EXPENSES Table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
    category TEXT NOT NULL CHECK (category IN ('software', 'diseño', 'impresión', 'publicidad', 'legal', 'impuestos', 'oficina virtual', 'otros')),
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    includes_vat BOOLEAN NOT NULL DEFAULT FALSE,
    deductible BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. SERVICE_CATALOG Table
CREATE TABLE IF NOT EXISTS service_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    name TEXT NOT NULL,
    description TEXT,
    base_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
    includes_vat BOOLEAN NOT NULL DEFAULT FALSE,
    category TEXT NOT NULL CHECK (category IN ('corrección', 'diseño', 'maquetación', 'difusión', 'derechos de autor', 'publicación', 'asesoría', 'otro')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. SERVICE_PACKS Table
CREATE TABLE IF NOT EXISTS service_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    name TEXT NOT NULL,
    description TEXT,
    price_special NUMERIC(12,2),
    currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
    includes_vat BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. SERVICE_PACK_ITEMS Table
CREATE TABLE IF NOT EXISTS service_pack_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    pack_id UUID NOT NULL REFERENCES service_packs(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES service_catalog(id) ON DELETE CASCADE
);

-- 11. QUOTATIONS Table
CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
    discount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD')),
    status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'enviada', 'aceptada', 'rechazada', 'vencida')),
    notes TEXT,
    includes_vat BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. QUOTATION_ITEMS Table
CREATE TABLE IF NOT EXISTS quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    service_id UUID REFERENCES service_catalog(id) ON DELETE SET NULL,
    pack_id UUID REFERENCES service_packs(id) ON DELETE SET NULL,
    custom_name TEXT,
    price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    quantity INTEGER NOT NULL DEFAULT 1
);

-- 13. QUICK_REPLIES Table
CREATE TABLE IF NOT EXISTS quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    title TEXT NOT NULL,
    category TEXT,
    channel TEXT NOT NULL DEFAULT 'general' CHECK (channel IN ('Instagram', 'correo', 'WhatsApp', 'general')),
    message_text TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 14. DOCUMENTS Table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
    name TEXT NOT NULL,
    file_path TEXT NOT NULL, -- Storage path
    file_type TEXT NOT NULL CHECK (file_type IN ('boleta', 'factura', 'comprobante de pago', 'contrato', 'archivo de cliente', 'otro')),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
    income_id UUID REFERENCES incomes(id) ON DELETE SET NULL,
    expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) for all tables
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

-- Enable Policies (Users can only manage their own data)
CREATE POLICY "Users can manage their own providers" ON providers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own clients" ON clients FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own prospects" ON prospects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own services" ON services FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own service_stages" ON service_stages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own incomes" ON incomes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own expenses" ON expenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own service_catalog" ON service_catalog FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own service_packs" ON service_packs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own service_pack_items" ON service_pack_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own quotations" ON quotations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own quotation_items" ON quotation_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own quick_replies" ON quick_replies FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own documents" ON documents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Performance Indexes
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
