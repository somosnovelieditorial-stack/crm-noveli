import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

const useRealSupabase = supabaseUrl && supabaseAnonKey && 
                        supabaseUrl !== 'YOUR_SUPABASE_URL' && 
                        supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY';

let supabaseInstance;

// Helper to pre-generate 10 standard stages for a service
const generateMockStagesForService = (serviceId, activeStageIndex = 0) => {
  const stagesList = [
    'recepción de material', 'contrato firmado', 'pago realizado', 'revisión inicial',
    'corrección', 'diseño de portada', 'maquetación', 'revisión del autor',
    'entrega final', 'cerrado'
  ];

  return stagesList.map((stage, idx) => {
    let status = 'pendiente';
    let start_date = null;
    let end_date = null;
    
    if (idx < activeStageIndex) {
      status = 'completada';
      start_date = new Date(Date.now() - (45 - idx * 5) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      end_date = new Date(Date.now() - (40 - idx * 5) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    } else if (idx === activeStageIndex) {
      status = 'en proceso';
      start_date = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    return {
      id: `stage-${serviceId}-${idx}`,
      user_id: "mock-user-123",
      service_id: serviceId,
      stage_name: stage,
      status,
      start_date,
      end_date,
      responsible: idx % 2 === 0 ? "Juan Pérez (Diseño/Maq)" : "Isabel V. (Editora)",
      notes: status === 'completada' ? `Etapa completada con éxito conforme a plazos.` : status === 'en proceso' ? `Etapa actual en desarrollo.` : `Pendiente de inicio.`
    };
  });
};

// Initial mock database state
const INITIAL_MOCK_DATA = {
  providers: [
    {
      id: "prov-1",
      user_id: "mock-user-123",
      name: "Juan Pérez Design",
      type: "diseñador",
      email: "juan@perezdesign.com",
      phone: "+56 9 8765 4321",
      country: "Chile",
      service_provided: "Diseño de portadas y maquetación",
      notes: "Excelente diseñador, puntual en las entregas.",
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "prov-2",
      user_id: "mock-user-123",
      name: "Imprenta Andina",
      type: "imprenta",
      email: "contacto@imprentaandina.cl",
      phone: "+56 2 2345 6789",
      country: "Chile",
      service_provided: "Impresión de libros físicos en offset y digital",
      notes: "Descuento del 10% por más de 500 copias.",
      created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "prov-3",
      user_id: "mock-user-123",
      name: "Estudio Jurídico Letras",
      type: "abogado",
      email: "derechos@estudioletras.com",
      phone: "+34 612 345 678",
      country: "España",
      service_provided: "Asesoría de propiedad intelectual y contratos de autor",
      notes: "Cobran por contrato revisado.",
      created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    }
  ],
  clients: [
    {
      id: "client-1",
      user_id: "mock-user-123",
      name: "Isabel Allende",
      email: "isabel.allende@novels.com",
      instagram: "@isabelallende",
      phone: "+1 415 555 0199",
      country: "Chile",
      city: "Santiago",
      client_type: "nacional",
      preferred_currency: "CLP",
      status: "en proceso editorial",
      notes: "Autora premium. Prefiere comunicación por correo electrónico.",
      interest_service: "libro físico",
      total_agreed_amount: 1800000,
      includes_vat: true,
      payment_status: "pago parcial",
      amount_paid: 900000,
      balance_due: 900000,
      payment_method: "transferencia",
      paid_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      payment_link_sent: true,
      payment_link_sent_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      contract_sent: true,
      contract_sent_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      contract_signed_received: true,
      contract_signed_received_at: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      files_received: true,
      files_received_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ready_to_start: true,
      agreement_notes: "Edición especial tapa dura con detalles dorados.",
      currency: "CLP",
      created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "client-2",
      user_id: "mock-user-123",
      name: "Gabriel García Márquez",
      email: "gabo@macondo.org",
      instagram: "@gabo_oficial",
      phone: "+57 300 123 4567",
      country: "Colombia",
      city: "Bogotá",
      client_type: "internacional",
      preferred_currency: "USD",
      status: "finalizado",
      notes: "Proyecto de reedición cerrado exitosamente.",
      interest_service: "maquetación",
      total_agreed_amount: 1500,
      includes_vat: false,
      payment_status: "pagado",
      amount_paid: 1500,
      balance_due: 0,
      payment_method: "paypal",
      paid_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      payment_link_sent: true,
      payment_link_sent_at: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      contract_sent: true,
      contract_sent_at: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      contract_signed_received: true,
      contract_signed_received_at: new Date(Date.now() - 92 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      files_received: true,
      files_received_at: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ready_to_start: true,
      agreement_notes: "Edición especial tapa blanda.",
      currency: "USD",
      created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "client-3",
      user_id: "mock-user-123",
      name: "Mario Vargas Llosa",
      email: "mario.vargas@catedral.pe",
      instagram: "@mvargasllosa",
      phone: "+51 999 888 777",
      country: "Perú",
      city: "Lima",
      client_type: "internacional",
      preferred_currency: "USD",
      status: "en proceso editorial",
      notes: "Trabajando en corrección de estilo para su nueva novela.",
      interest_service: "corrección",
      total_agreed_amount: 1200,
      includes_vat: false,
      payment_status: "pagado",
      amount_paid: 1200,
      balance_due: 0,
      payment_method: "paypal",
      paid_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      payment_link_sent: true,
      payment_link_sent_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      contract_sent: true,
      contract_sent_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      contract_signed_received: true,
      contract_signed_received_at: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      files_received: true,
      files_received_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ready_to_start: true,
      agreement_notes: "Corrección de estilo y sugerencias narrativas.",
      currency: "USD",
      created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "client-4",
      user_id: "mock-user-123",
      name: "Laura Restrepo",
      email: "laura.restrepo@letras.com",
      instagram: "@laurarestrepootro",
      phone: "+57 311 987 6543",
      country: "Colombia",
      city: "Medellín",
      client_type: "internacional",
      preferred_currency: "USD",
      status: "prospecto",
      notes: "Interesada en asesoría de publicación e impresión digital.",
      interest_service: "asesoría de publicación",
      total_agreed_amount: 0,
      includes_vat: false,
      payment_status: "sin pago",
      amount_paid: 0,
      balance_due: 0,
      payment_method: "transferencia",
      paid_at: null,
      payment_link_sent: false,
      payment_link_sent_at: null,
      contract_sent: false,
      contract_sent_at: null,
      contract_signed_received: false,
      contract_signed_received_at: null,
      files_received: false,
      files_received_at: null,
      ready_to_start: false,
      agreement_notes: "Pendiente de cotización.",
      currency: "USD",
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    }
  ],
  prospects: [
    {
      id: "prosp-1",
      user_id: "mock-user-123",
      name: "Roberto Bolaño",
      contact: "@roberto_bolano_instagram",
      origin: "Instagram",
      interest_service: "libro físico",
      probability: "alta",
      next_action: "Enviar cotización final de diseño de portada e impresión",
      followup_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: "El manuscrito está listo. Tirada de 300 copias.",
      converted_to_client_id: null,
      country: "Chile",
      city: "Santiago",
      client_type: "nacional",
      preferred_currency: "CLP",
      total_agreed_amount: 1200000,
      includes_vat: true,
      payment_status: "sin pago",
      amount_paid: 0,
      balance_due: 1200000,
      payment_method: "transferencia",
      paid_at: null,
      payment_link_sent: false,
      payment_link_sent_at: null,
      contract_sent: false,
      contract_sent_at: null,
      contract_signed_received: false,
      contract_signed_received_at: null,
      files_received: false,
      files_received_at: null,
      ready_to_start: false,
      agreement_notes: "Conversaciones iniciales.",
      currency: "CLP",
      created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "prosp-2",
      user_id: "mock-user-123",
      name: "Gabriela Mistral",
      contact: "gabriela@valleelqui.cl",
      origin: "web",
      interest_service: "asesoría de publicación",
      probability: "media",
      next_action: "Llamar para agendar reunión de asesoría",
      followup_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: "Tiene poemas inéditos. Quiere conocer los canales de distribución.",
      converted_to_client_id: null,
      country: "Chile",
      city: "Vicuña",
      client_type: "nacional",
      preferred_currency: "CLP",
      total_agreed_amount: 500000,
      includes_vat: false,
      payment_status: "sin pago",
      amount_paid: 0,
      balance_due: 500000,
      payment_method: "transferencia",
      paid_at: null,
      payment_link_sent: false,
      payment_link_sent_at: null,
      contract_sent: false,
      contract_sent_at: null,
      contract_signed_received: false,
      contract_signed_received_at: null,
      files_received: false,
      files_received_at: null,
      ready_to_start: false,
      agreement_notes: "",
      currency: "CLP",
      created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "prosp-3",
      user_id: "mock-user-123",
      name: "Julio Cortázar",
      contact: "Julio en París (Referido por Carlos Fuentes)",
      origin: "referido",
      interest_service: "corrección",
      probability: "baja",
      next_action: "Mandar correo de introducción y tarifas",
      followup_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: "Novela de estructura no lineal. Requiere maquetación avanzada.",
      converted_to_client_id: null,
      country: "Argentina",
      city: "Buenos Aires",
      client_type: "internacional",
      preferred_currency: "EUR",
      total_agreed_amount: 800,
      includes_vat: false,
      payment_status: "sin pago",
      amount_paid: 0,
      balance_due: 800,
      payment_method: "paypal",
      paid_at: null,
      payment_link_sent: false,
      payment_link_sent_at: null,
      contract_sent: false,
      contract_sent_at: null,
      contract_signed_received: false,
      contract_signed_received_at: null,
      files_received: false,
      files_received_at: null,
      ready_to_start: false,
      agreement_notes: "",
      currency: "EUR",
      created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
    }
  ],
  services: [
    {
      id: "serv-1",
      user_id: "mock-user-123",
      client_id: "client-1",
      type: "libro físico",
      book_title: "La Casa de los Espíritus (Edición Especial)",
      status: "en maquetación",
      value: 1800000,
      currency: "CLP",
      exchange_rate: 1.0,
      value_converted: 1800000,
      rate_date: new Date().toISOString().split('T')[0],
      start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      estimated_delivery: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: "Requiere tapa dura y detalles dorados en la portada.",
      current_stage: "maquetación",
      advance_percent: 70,
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "serv-2",
      user_id: "mock-user-123",
      client_id: "client-3",
      type: "corrección",
      book_title: "La fiesta del chivo (Revisión)",
      status: "en corrección",
      value: 1200,
      currency: "USD",
      exchange_rate: 940.0,
      value_converted: 1128000,
      rate_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      start_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      estimated_delivery: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: "El cliente paga en dólares vía PayPal. Corrección de estilo.",
      current_stage: "corrección",
      advance_percent: 45,
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "serv-3",
      user_id: "mock-user-123",
      client_id: "client-2",
      type: "ebook",
      book_title: "Cien años de soledad (Digital)",
      status: "cerrado",
      value: 450000,
      currency: "CLP",
      exchange_rate: 1.0,
      value_converted: 450000,
      rate_date: new Date().toISOString().split('T')[0],
      start_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      estimated_delivery: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: "Entrega en formatos ePUB y PDF optimizado.",
      current_stage: "cerrado",
      advance_percent: 100,
      created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    }
  ],
  service_stages: [
    ...generateMockStagesForService("serv-1", 6),
    ...generateMockStagesForService("serv-2", 4),
    ...generateMockStagesForService("serv-3", 9)
  ],
  incomes: [
    {
      id: "inc-1",
      user_id: "mock-user-123",
      client_id: "client-1",
      service_id: "serv-1",
      amount: 900000,
      currency: "CLP",
      exchange_rate: 1.0,
      value_converted: 900000,
      rate_date: new Date().toISOString().split('T')[0],
      date: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      payment_method: "transferencia",
      includes_vat: true,
      status: "parcial",
      notes: "Primer pago del 50%. Factura emitida con IVA.",
      created_at: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "inc-2",
      user_id: "mock-user-123",
      client_id: "client-3",
      service_id: "serv-2",
      amount: 1200,
      currency: "USD",
      exchange_rate: 940.0,
      value_converted: 1128000,
      rate_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      date: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      payment_method: "paypal",
      includes_vat: false,
      status: "pagado",
      notes: "Pago completo del servicio en USD.",
      created_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "inc-3",
      user_id: "mock-user-123",
      client_id: "client-2",
      service_id: "serv-3",
      amount: 450000,
      currency: "CLP",
      exchange_rate: 1.0,
      value_converted: 450000,
      rate_date: new Date().toISOString().split('T')[0],
      date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      payment_method: "transferencia",
      includes_vat: true,
      status: "pagado",
      notes: "Pago total del Ebook.",
      created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
    }
  ],
  expenses: [
    {
      id: "exp-1",
      user_id: "mock-user-123",
      provider_id: "prov-1",
      category: "diseño",
      amount: 300000,
      currency: "CLP",
      exchange_rate: 1.0,
      value_converted: 300000,
      rate_date: new Date().toISOString().split('T')[0],
      date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      includes_vat: true,
      deductible: true,
      notes: "Diseño de portada para el proyecto de Isabel Allende.",
      created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "exp-2",
      user_id: "mock-user-123",
      provider_id: null,
      category: "software",
      amount: 25000,
      currency: "CLP",
      exchange_rate: 1.0,
      value_converted: 25000,
      rate_date: new Date().toISOString().split('T')[0],
      date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      includes_vat: false,
      deductible: true,
      notes: "Suscripción Adobe Creative Cloud.",
      created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "exp-3",
      user_id: "mock-user-123",
      provider_id: null,
      category: "oficina virtual",
      amount: 35000,
      currency: "CLP",
      exchange_rate: 1.0,
      value_converted: 35000,
      rate_date: new Date().toISOString().split('T')[0],
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      includes_vat: true,
      deductible: true,
      notes: "Dirección comercial y tributaria.",
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    }
  ],
  service_catalog: [
    {
      id: "cat-1",
      user_id: "mock-user-123",
      name: "Corrección Ortotipográfica y de Estilo",
      description: "Revisión completa de gramática, redacción, coherencia.",
      base_price: 350000,
      currency: "CLP",
      includes_vat: false,
      category: "corrección",
      active: true,
      requires_manuscript: true,
      requires_materials: false,
      requires_signed_contract: true,
      requires_agreement_sent: false,
      requires_duration: false,
      created_at: new Date().toISOString()
    },
    {
      id: "cat-2",
      user_id: "mock-user-123",
      name: "Maquetación Editorial Profesional (InDesign)",
      description: "Diagramación interna de páginas para impresión física.",
      base_price: 250000,
      currency: "CLP",
      includes_vat: false,
      category: "maquetación",
      active: true,
      requires_manuscript: true,
      requires_materials: false,
      requires_signed_contract: true,
      requires_agreement_sent: false,
      requires_duration: false,
      created_at: new Date().toISOString()
    },
    {
      id: "cat-3",
      user_id: "mock-user-123",
      name: "Diseño de Portada Ilustrada",
      description: "Diseño premium e ilustración para la tapa frontal.",
      base_price: 300000,
      currency: "CLP",
      includes_vat: true,
      category: "diseño",
      active: true,
      requires_manuscript: false,
      requires_materials: true,
      requires_signed_contract: false,
      requires_agreement_sent: true,
      requires_duration: false,
      created_at: new Date().toISOString()
    },
    {
      id: "cat-4",
      user_id: "mock-user-123",
      name: "Publicación Ebook (Kindle/ePUB)",
      description: "Conversión a formato reflowable y publicación.",
      base_price: 150000,
      currency: "CLP",
      includes_vat: false,
      category: "editorial",
      active: true,
      requires_manuscript: true,
      requires_materials: false,
      requires_signed_contract: true,
      requires_agreement_sent: false,
      requires_duration: false,
      created_at: new Date().toISOString()
    },
    {
      id: "cat-5",
      user_id: "mock-user-123",
      name: "Impresión Tirada Corta (100 Copias)",
      description: "Impresión de tapa blanda, papel bond de 80g.",
      base_price: 650000,
      currency: "CLP",
      includes_vat: true,
      category: "editorial",
      active: true,
      requires_manuscript: true,
      requires_materials: false,
      requires_signed_contract: true,
      requires_agreement_sent: false,
      requires_duration: false,
      created_at: new Date().toISOString()
    },
    {
      id: "cat-6",
      user_id: "mock-user-123",
      name: "Sesión de Asesoría de Publicación",
      description: "Reunión estratégica de 1 hora sobre derecho de autor.",
      base_price: 65,
      currency: "USD",
      includes_vat: false,
      category: "asesoría",
      active: true,
      requires_manuscript: false,
      requires_materials: false,
      requires_signed_contract: false,
      requires_agreement_sent: true,
      requires_duration: true,
      created_at: new Date().toISOString()
    }
  ],
  service_packs: [
    {
      id: "pack-1",
      user_id: "mock-user-123",
      name: "Full eBook",
      description: "Servicio completo para libro digital/eBook.",
      price_special: 450000,
      currency: "CLP",
      includes_vat: false,
      active: true,
      category: "editorial",
      requires_manuscript: true,
      requires_materials: false,
      requires_signed_contract: true,
      requires_agreement_sent: false,
      requires_duration: false,
      created_at: new Date().toISOString()
    },
    {
      id: "pack-2",
      user_id: "mock-user-123",
      name: "Full Físico",
      description: "Servicio completo para libro físico.",
      price_special: 950000,
      currency: "CLP",
      includes_vat: true,
      active: true,
      category: "editorial",
      requires_manuscript: true,
      requires_materials: false,
      requires_signed_contract: true,
      requires_agreement_sent: false,
      requires_duration: false,
      created_at: new Date().toISOString()
    },
    {
      id: "pack-3",
      user_id: "mock-user-123",
      name: "Full Total",
      description: "Servicio completo libro físico + eBook.",
      price_special: 1350000,
      currency: "CLP",
      includes_vat: true,
      active: true,
      category: "editorial",
      requires_manuscript: true,
      requires_materials: false,
      requires_signed_contract: true,
      requires_agreement_sent: false,
      requires_duration: false,
      created_at: new Date().toISOString()
    },
    {
      id: "pack-4",
      user_id: "mock-user-123",
      name: "Pack Difusión",
      description: "Servicio de publicidad o difusión editorial.",
      price_special: 250000,
      currency: "CLP",
      includes_vat: false,
      active: true,
      category: "publicidad",
      requires_manuscript: false,
      requires_materials: false,
      requires_signed_contract: false,
      requires_agreement_sent: true,
      requires_duration: true,
      created_at: new Date().toISOString()
    },
    {
      id: "pack-5",
      user_id: "mock-user-123",
      name: "Pack Portada",
      description: "Diseño o adaptación de portada.",
      price_special: 200000,
      currency: "CLP",
      includes_vat: true,
      active: true,
      category: "diseño",
      requires_manuscript: false,
      requires_materials: true,
      requires_signed_contract: false,
      requires_agreement_sent: true,
      requires_duration: false,
      created_at: new Date().toISOString()
    },
    {
      id: "pack-6",
      user_id: "mock-user-123",
      name: "Pack Corrección",
      description: "Corrección de texto.",
      price_special: 300000,
      currency: "CLP",
      includes_vat: false,
      active: true,
      category: "corrección",
      requires_manuscript: true,
      requires_materials: false,
      requires_signed_contract: true,
      requires_agreement_sent: false,
      requires_duration: false,
      created_at: new Date().toISOString()
    },
    {
      id: "pack-7",
      user_id: "mock-user-123",
      name: "Pack Maquetación",
      description: "Maquetación interior.",
      price_special: 220000,
      currency: "CLP",
      includes_vat: false,
      active: true,
      category: "maquetación",
      requires_manuscript: true,
      requires_materials: false,
      requires_signed_contract: true,
      requires_agreement_sent: false,
      requires_duration: false,
      created_at: new Date().toISOString()
    }
  ],
  service_pack_items: [
    { id: "pitem-1", user_id: "mock-user-123", pack_id: "pack-1", service_id: "cat-2" },
    { id: "pitem-2", user_id: "mock-user-123", pack_id: "pack-1", service_id: "cat-3" },
    { id: "pitem-3", user_id: "mock-user-123", pack_id: "pack-1", service_id: "cat-4" },
    { id: "pitem-4", user_id: "mock-user-123", pack_id: "pack-2", service_id: "cat-1" },
    { id: "pitem-5", user_id: "mock-user-123", pack_id: "pack-2", service_id: "cat-2" },
    { id: "pitem-6", user_id: "mock-user-123", pack_id: "pack-2", service_id: "cat-3" },
    { id: "pitem-7", user_id: "mock-user-123", pack_id: "pack-2", service_id: "cat-5" },
    { id: "pitem-8", user_id: "mock-user-123", pack_id: "pack-3", service_id: "cat-1" },
    { id: "pitem-9", user_id: "mock-user-123", pack_id: "pack-3", service_id: "cat-2" },
    { id: "pitem-10", user_id: "mock-user-123", pack_id: "pack-3", service_id: "cat-3" },
    { id: "pitem-11", user_id: "mock-user-123", pack_id: "pack-3", service_id: "cat-4" },
    { id: "pitem-12", user_id: "mock-user-123", pack_id: "pack-3", service_id: "cat-5" },
    { id: "pitem-14", user_id: "mock-user-123", pack_id: "pack-5", service_id: "cat-3" },
    { id: "pitem-15", user_id: "mock-user-123", pack_id: "pack-6", service_id: "cat-1" },
    { id: "pitem-16", user_id: "mock-user-123", pack_id: "pack-7", service_id: "cat-2" }
  ],
  quotations: [
    {
      id: "quot-1",
      user_id: "mock-user-123",
      client_id: null,
      prospect_id: "prosp-1",
      discount: 20000,
      currency: "CLP",
      exchange_rate: 1.0,
      value_converted: 600000,
      rate_date: new Date().toISOString().split('T')[0],
      status: "enviada",
      notes: "Enviado por correo. Incluye descuento especial.",
      includes_vat: true,
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "quot-2",
      user_id: "mock-user-123",
      client_id: "client-1",
      prospect_id: null,
      discount: 0,
      currency: "CLP",
      exchange_rate: 1.0,
      value_converted: 1500000,
      rate_date: new Date().toISOString().split('T')[0],
      status: "borrador",
      notes: "Revisando tarifas para tirada especial.",
      includes_vat: false,
      created_at: new Date().toISOString()
    }
  ],
  quotation_items: [
    {
      id: "qitem-1",
      user_id: "mock-user-123",
      quotation_id: "quot-1",
      service_id: null,
      pack_id: "pack-1",
      custom_name: null,
      price: 620000,
      quantity: 1
    },
    {
      id: "qitem-2",
      user_id: "mock-user-123",
      quotation_id: "quot-2",
      service_id: "cat-5",
      pack_id: null,
      custom_name: "Impresión Tirada Corta - Re-edición Tapa Dura",
      price: 750000,
      quantity: 2
    }
  ],
  quick_replies: [
    {
      id: "reply-1",
      user_id: "mock-user-123",
      title: "Saludo Inicial Instagram",
      category: "Ventas",
      channel: "Instagram",
      message_text: "¡Hola! Gracias por escribirnos a Somos Noveli 📚✨. ¿De qué trata tu obra?",
      active: true,
      created_at: new Date().toISOString()
    }
  ],
  documents: [
    {
      id: "doc-1",
      user_id: "mock-user-123",
      name: "Contrato_Isabel_Allende_2026.pdf",
      file_path: "mock/docs/contrato_allende.pdf",
      file_type: "contrato",
      client_id: "client-1",
      provider_id: null,
      income_id: null,
      expense_id: null,
      service_id: "serv-1",
      quotation_id: null,
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    }
  ],
  settings: [
    {
      id: "settings-1",
      organization_id: "11111111-1111-1111-1111-111111111111",
      editorial_name: "Somos Noveli Editorial",
      logo: "",
      logo_url: "",
      favicon_url: "",
      email: "contacto@somosnoveli.cl",
      address: "Av. Providencia 1234, Santiago",
      base_country: "Chile",
      currency_primary: "CLP",
      currencies_secondary: ["USD", "EUR"],
      vat_rate: 19,
      bank_details: "Banco de Chile - Cta Corriente: 123456789 - RUT: 76.123.456-7",
      quotation_notes: "Vigencia de cotización: 15 días.",
      quotation_legal: "Precios expuestos pueden variar según adicionales."
    }
  ],
  exchange_rates: [
    { id: "rate-1", currency_from: "USD", currency_to: "CLP", rate: 940, date: new Date().toISOString().split('T')[0], source: "Manual", created_at: new Date().toISOString() },
    { id: "rate-2", currency_from: "EUR", currency_to: "CLP", rate: 1010, date: new Date().toISOString().split('T')[0], source: "Manual", created_at: new Date().toISOString() },
    { id: "rate-3", currency_from: "USD", currency_to: "EUR", rate: 0.93, date: new Date().toISOString().split('T')[0], source: "Manual", created_at: new Date().toISOString() }
  ],
  editorial_stages: [
    { id: "estage-1", name: "recepción de material", description: "Recepción de manuscrito y archivos del autor", order: 1, color: "#94a3b8", active: true },
    { id: "estage-2", name: "contrato firmado", description: "Firma mutua del acuerdo editorial", order: 2, color: "#3b82f6", active: true },
    { id: "estage-3", name: "pago realizado", description: "Primer abono o pago completo verificado", order: 3, color: "#10b981", active: true },
    { id: "estage-4", name: "revisión inicial", description: "Primera lectura diagnóstica por editor asignado", order: 4, color: "#6366f1", active: true },
    { id: "estage-5", name: "corrección", description: "Corrección de estilo y ortotipográfica", order: 5, color: "#f59e0b", active: true },
    { id: "estage-6", name: "diseño de portada", description: "Propuestas de portada e ilustración", order: 6, color: "#ec4899", active: true },
    { id: "estage-7", name: "maquetación", description: "Diagramación interna en InDesign", order: 7, color: "#8b5cf6", active: true },
    { id: "estage-8", name: "revisión del autor", description: "Aprobación de galeradas por el autor", order: 8, color: "#06b6d4", active: true },
    { id: "estage-9", name: "entrega final", description: "Envío de archivos finales a imprenta/tiendas", order: 9, color: "#10b981", active: true },
    { id: "estage-10", name: "cerrado", description: "Libro impreso, distribuido y proyecto archivado", order: 10, color: "#64748b", active: true }
  ],
  service_checklists: [
    { id: "chk-1", service_id: "serv-1", task: "Revisar ortografía de capítulo 1", status: "completada", responsible: "Isabel V.", due_date: new Date(Date.now() + 5*24*60*60*1000).toISOString().split('T')[0], notes: "Todo bien" },
    { id: "chk-2", service_id: "serv-1", task: "Diseñar lomo y contraportada", status: "en proceso", responsible: "Juan Pérez", due_date: new Date(Date.now() + 10*24*60*60*1000).toISOString().split('T')[0], notes: "Esperando dimensiones de imprenta" },
    { id: "chk-3", service_id: "serv-1", task: "Enviar pruebas de color", status: "pendiente", responsible: "Juan Pérez", due_date: new Date(Date.now() + 12*24*60*60*1000).toISOString().split('T')[0], notes: "" }
  ],
  activity_log: [
    { id: "act-1", user_id: "mock-user-123", user_email: "admin@somosnoveli.cl", date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), module: "clients", action: "creación", description: "Cliente Isabel Allende creado", entity_id: "client-1" }
  ],
  agenda_events: [
    { id: "evt-1", user_id: "mock-user-123", title: "Reunión de lanzamiento con Isabel Allende", description: "Definir cronograma final y detalles de tapa dura", date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], time: "11:00", type: "reunión", created_at: new Date().toISOString() },
    { id: "evt-2", user_id: "mock-user-123", title: "Revisar muestras Imprenta Andina", description: "Verificar muestras de impresión física de prueba", date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], time: "15:30", type: "evento", created_at: new Date().toISOString() }
  ],
  organizations: [
    { id: "11111111-1111-1111-1111-111111111111", name: "Somos Noveli Editorial", created_at: new Date().toISOString() }
  ],
  organization_members: [
    { id: "member-1", organization_id: "11111111-1111-1111-1111-111111111111", user_id: "mock-user-123", role: "administrador", created_at: new Date().toISOString() }
  ],
  staff: [
    { id: "staff-1", user_id: "mock-user-123", organization_id: "11111111-1111-1111-1111-111111111111", name: "Valentina Barrios", role: "Directora Editorial", type: "fundador", agreed_payment: 2500000, currency: "CLP", payment_frequency: "mensual", status: "activo", notes: "Fundadora", created_at: new Date().toISOString() },
    { id: "staff-2", user_id: "mock-user-123", organization_id: "11111111-1111-1111-1111-111111111111", name: "Javier Román", role: "Director Comercial", type: "fundador", agreed_payment: 2500000, currency: "CLP", payment_frequency: "mensual", status: "activo", notes: "Fundador", created_at: new Date().toISOString() }
  ],
  payroll_payments: [],
  operational_reserve_movements: [],
  income_allocations: []
};

// LocalStorage database engine helper
const getMockDb = () => {
  const data = localStorage.getItem('somos_noveli_crm_db');
  if (!data) {
    localStorage.setItem('somos_noveli_crm_db', JSON.stringify(INITIAL_MOCK_DATA));
    return INITIAL_MOCK_DATA;
  }
  
  // Clean merge in case new tables/properties are missing from a pre-existing DB
  const parsed = JSON.parse(data);
  let updated = false;
  
  Object.keys(INITIAL_MOCK_DATA).forEach(table => {
    if (!parsed[table]) {
      parsed[table] = INITIAL_MOCK_DATA[table];
      updated = true;
    }
  });

  // Check services for new properties
  if (parsed.services) {
    parsed.services = parsed.services.map(s => {
      const orig = INITIAL_MOCK_DATA.services.find(o => o.id === s.id);
      if (orig && s.advance_percent === undefined) {
        s.current_stage = orig.current_stage;
        s.advance_percent = orig.advance_percent;
        updated = true;
      }
      return s;
    });
  }

  if (updated) {
    localStorage.setItem('somos_noveli_crm_db', JSON.stringify(parsed));
  }
  
  return parsed;
};

const saveMockDb = (db) => {
  localStorage.setItem('somos_noveli_crm_db', JSON.stringify(db));
};

// Mock Query Builder that behaves similarly to Supabase postgrest-js
class MockQueryBuilder {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.orderConfig = null;
    this.singleRow = false;
  }

  select(columns = '*') {
    return this;
  }

  eq(column, value) {
    this.filters.push({ column, value });
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.orderConfig = { column, ascending };
    return this;
  }

  single() {
    this.singleRow = true;
    return this;
  }

  // To make it awaitable like a Promise
  async then(onfulfilled, onrejected) {
    try {
      const db = getMockDb();
      let records = db[this.table] || [];

      // Filter
      for (const filter of this.filters) {
        records = records.filter(row => row[filter.column] === filter.value);
      }

      // Sort
      if (this.orderConfig) {
        const { column, ascending } = this.orderConfig;
        records.sort((a, b) => {
          let valA = a[column];
          let valB = b[column];
          
          if (typeof valA === 'string') {
            return ascending ? valA.localeCompare(valB) : valB.localeCompare(valA);
          }
          return ascending ? valA - valB : valB - valA;
        });
      }

      // MULTICURRENCY DYNAMIC POPULATION FOR LEGACY ROWS
      if (['services', 'incomes', 'expenses', 'quotations'].includes(this.table)) {
        records = records.map(row => {
          if (row.exchange_rate === undefined) {
            row.exchange_rate = row.currency === 'USD' ? 940 : row.currency === 'EUR' ? 1010 : 1;
            const amt = Number(row.value || row.amount || 0);
            row.value_converted = amt * row.exchange_rate;
            row.rate_date = row.start_date || row.date || row.created_at?.split('T')[0] || new Date().toISOString().split('T')[0];
          }
          return row;
        });
      }

      // AUTO-POPULATE RELATIONSHIPS FOR EASY FRONT-END USE
      if (this.table === 'services') {
        records = records.map(row => {
          row.client = db.clients.find(c => c.id === row.client_id) || null;
          row.stages = (db.service_stages || []).filter(st => st.service_id === row.id).sort((a, b) => {
            return a.id.localeCompare(b.id);
          });
          row.checklists = (db.service_checklists || []).filter(chk => chk.service_id === row.id);
          return row;
        });
      }
      if (this.table === 'incomes') {
        records = records.map(row => {
          row.client = db.clients.find(c => c.id === row.client_id) || null;
          row.service = db.services.find(s => s.id === row.service_id) || null;
          return row;
        });
      }
      if (this.table === 'expenses') {
        records = records.map(row => {
          row.provider = db.providers.find(p => p.id === row.provider_id) || null;
          return row;
        });
      }
      if (this.table === 'service_pack_items') {
        records = records.map(row => {
          row.service = db.service_catalog.find(s => s.id === row.service_id) || null;
          return row;
        });
      }
      if (this.table === 'quotations') {
        records = records.map(row => {
          row.client = db.clients.find(c => c.id === row.client_id) || null;
          row.prospect = db.prospects.find(p => p.id === row.prospect_id) || null;
          row.items = (db.quotation_items || []).filter(item => item.quotation_id === row.id).map(item => {
            item.service = db.service_catalog.find(s => s.id === item.service_id) || null;
            item.pack = db.service_packs.find(p => p.id === item.pack_id) || null;
            return item;
          });
          return row;
        });
      }
      if (this.table === 'quotation_items') {
        records = records.map(row => {
          row.service = db.service_catalog.find(s => s.id === row.service_id) || null;
          row.pack = db.service_packs.find(p => p.id === row.pack_id) || null;
          return row;
        });
      }
      if (this.table === 'documents') {
        records = records.map(row => {
          row.client = db.clients.find(c => c.id === row.client_id) || null;
          row.provider = db.providers.find(p => p.id === row.provider_id) || null;
          row.service = db.services.find(s => s.id === row.service_id) || null;
          row.income = db.incomes.find(i => i.id === row.income_id) || null;
          row.expense = db.expenses.find(e => e.id === row.expense_id) || null;
          row.quotation = db.quotations.find(q => q.id === row.quotation_id) || null;
          return row;
        });
      }

      const result = this.singleRow ? (records[0] || null) : records;
      const data = JSON.parse(JSON.stringify(result));
      return onfulfilled({ data, error: null });
    } catch (err) {
      if (onrejected) {
        return onrejected(err);
      }
      return { data: null, error: err };
    }
  }

  insert(newData) {
    return new MockMutationBuilder(this, 'insert', newData);
  }

  update(updateData) {
    return new MockMutationBuilder(this, 'update', updateData);
  }

  delete() {
    return new MockMutationBuilder(this, 'delete');
  }

  upsert(newData, options) {
    return new MockMutationBuilder(this, 'upsert', newData, options);
  }

  async _executeUpsert(newData, options) {
    const db = getMockDb();
    const records = db[this.table] || [];
    const onConflict = options?.onConflict || 'id';

    const itemsToUpsert = Array.isArray(newData) ? newData : [newData];
    const upsertedItems = [];

    for (const item of itemsToUpsert) {
      const existingIdx = records.findIndex(r => r[onConflict] === item[onConflict]);
      const current = existingIdx >= 0 ? records[existingIdx] : {};
      
      const mergedItem = {
        id: item.id || current.id || genId(this.table),
        user_id: item.user_id || current.user_id || getMockUser().id,
        created_at: current.created_at || new Date().toISOString(),
        ...current,
        ...item
      };

      if (['services', 'incomes', 'expenses', 'quotations'].includes(this.table)) {
        if (mergedItem.exchange_rate === undefined) {
          mergedItem.exchange_rate = mergedItem.currency === 'USD' ? 940 : mergedItem.currency === 'EUR' ? 1010 : 1;
        }
        const amt = Number(mergedItem.value || mergedItem.amount || 0);
        mergedItem.value_converted = amt * mergedItem.exchange_rate;
        mergedItem.rate_date = mergedItem.start_date || mergedItem.date || new Date().toISOString().split('T')[0];
      }

      if (existingIdx >= 0) {
        records[existingIdx] = mergedItem;
      } else {
        records.push(mergedItem);
      }
      upsertedItems.push(mergedItem);
    }

    db[this.table] = records;
    saveMockDb(db);

    const returnData = Array.isArray(newData) ? upsertedItems : upsertedItems[0];
    return { data: JSON.parse(JSON.stringify(returnData)), error: null };
  }

  async _executeInsert(newData) {
    const db = getMockDb();
    const records = db[this.table] || [];
    
    const itemsToInsert = Array.isArray(newData) ? newData : [newData];
    const insertedItems = itemsToInsert.map(item => {
      const newItem = {
        id: item.id || genId(this.table),
        user_id: getMockUser().id,
        created_at: new Date().toISOString(),
        ...item
      };

      // Multicurrency calculations
      if (['services', 'incomes', 'expenses', 'quotations'].includes(this.table)) {
        if (newItem.exchange_rate === undefined) {
          newItem.exchange_rate = newItem.currency === 'USD' ? 940 : newItem.currency === 'EUR' ? 1010 : 1;
        }
        const amt = Number(newItem.value || newItem.amount || 0);
        newItem.value_converted = amt * newItem.exchange_rate;
        newItem.rate_date = newItem.start_date || newItem.date || new Date().toISOString().split('T')[0];
      }

      records.push(newItem);
      return newItem;
    });

    // Trigger automatic stages timeline insertion for new service
    if (this.table === 'services' && insertedItems.length > 0) {
      try {
        const activeStages = (db.editorial_stages || []).filter(st => st.active).sort((a, b) => a.order - b.order);
        db.service_stages = db.service_stages || [];
        insertedItems.forEach(serv => {
          activeStages.forEach((stage, idx) => {
            db.service_stages.push({
              id: genId('service_stages'),
              user_id: getMockUser().id,
              service_id: serv.id,
              stage_name: stage.name,
              status: idx === 0 ? 'en proceso' : 'pendiente',
              start_date: idx === 0 ? new Date().toISOString().split('T')[0] : null,
              end_date: null,
              responsible: '',
              notes: ''
            });
          });
        });
      } catch (e) {
        console.error("Mock: Error creating stages for new service:", e);
      }
    }

    // Auto-log activity
    if (this.table !== 'activity_log') {
      db.activity_log = db.activity_log || [];
      insertedItems.forEach(item => {
        let desc = `Se creó un registro en la tabla ${this.table}: ${item.name || item.book_title || item.title || item.id}`;
        let moduleName = this.table;
        let actionType = 'creación';

        if (this.table === 'clients') {
          moduleName = 'Clientes';
          desc = `Se registró el nuevo cliente: ${item.name}`;
        } else if (this.table === 'prospects') {
          moduleName = 'Prospectos';
          desc = `Se registró el prospecto: ${item.name}`;
        } else if (this.table === 'quotations') {
          moduleName = 'Cotizaciones';
          desc = `Se creó la cotización ${item.id}`;
        } else if (this.table === 'services') {
          moduleName = 'Servicios';
          desc = `Se contrató el servicio para la obra ${item.book_title}`;
        } else if (this.table === 'incomes') {
          moduleName = 'Ingresos';
          desc = `Ingreso registrado por ${formatCurrency(item.amount, item.currency)}`;
          actionType = 'ingreso registrado';
        } else if (this.table === 'expenses') {
          moduleName = 'Gastos';
          desc = `Gasto registrado por ${formatCurrency(item.amount, item.currency)}`;
          actionType = 'gasto registrado';
        } else if (this.table === 'documents') {
          moduleName = 'Documentos';
          desc = `Se subió el documento ${item.name}`;
          actionType = 'documento subido';
        }

        const log = {
          id: genId('activity_log'),
          user_id: getMockUser().id,
          user_email: getMockUser().email,
          date: new Date().toISOString(),
          module: moduleName,
          action: actionType,
          description: desc,
          entity_id: item.id
        };
        db.activity_log.push(log);
      });
    }

    db[this.table] = records;
    saveMockDb(db);

    const returnData = Array.isArray(newData) ? insertedItems : insertedItems[0];
    return { data: JSON.parse(JSON.stringify(returnData)), error: null };
  }

  async _executeUpdate(updateData) {
    const db = getMockDb();
    let records = db[this.table] || [];
    let updatedRecords = [];

    records = records.map(row => {
      const matches = this.filters.every(filter => row[filter.column] === filter.value);
      if (matches) {
        const updatedRow = { ...row, ...updateData };
        
        // Multicurrency calculations
        if (['services', 'incomes', 'expenses', 'quotations'].includes(this.table)) {
          if (updatedRow.exchange_rate === undefined) {
            updatedRow.exchange_rate = updatedRow.currency === 'USD' ? 940 : updatedRow.currency === 'EUR' ? 1010 : 1;
          }
          const amt = Number(updatedRow.value || updatedRow.amount || 0);
          updatedRow.value_converted = amt * updatedRow.exchange_rate;
          updatedRow.rate_date = updatedRow.start_date || updatedRow.date || new Date().toISOString().split('T')[0];
        }

        updatedRecords.push(updatedRow);
        return updatedRow;
      }
      return row;
    });

    // Auto-log activity
    if (this.table !== 'activity_log') {
      db.activity_log = db.activity_log || [];
      updatedRecords.forEach(item => {
        let actionType = 'edición';
        let desc = `Se editó un registro en la tabla ${this.table}: ${item.name || item.book_title || item.title || item.id}`;
        let moduleName = this.table;

        if (this.table === 'clients') {
          moduleName = 'Clientes';
          actionType = 'edición de cliente';
          desc = `Se editó el cliente ${item.name}`;
        } else if (this.table === 'prospects') {
          moduleName = 'Prospectos';
          desc = `Se editó el prospecto ${item.name}`;
        } else if (this.table === 'quotations' && updateData.status === 'aceptada') {
          moduleName = 'Cotizaciones';
          actionType = 'aprobación de cotización';
          desc = `Se aprobó la cotización ${item.id}`;
        } else if (this.table === 'quotations' && updateData.status) {
          moduleName = 'Cotizaciones';
          actionType = 'cambio de estado de cotización';
          desc = `Se cambió el estado de la cotización ${item.id} a ${updateData.status}`;
        } else if (this.table === 'services' && updateData.current_stage) {
          moduleName = 'Servicios';
          actionType = 'cambio de etapa';
          desc = `Se cambió la etapa de la obra ${item.book_title} a ${updateData.current_stage}`;
        } else if (this.table === 'incomes' && updateData.status === 'pagado') {
          moduleName = 'Ingresos';
          actionType = 'pago marcado como recibido';
          desc = `Se recibió el pago de la cuenta de cobro ${item.id}`;
        }

        const log = {
          id: genId('activity_log'),
          user_id: getMockUser().id,
          user_email: getMockUser().email,
          date: new Date().toISOString(),
          module: moduleName,
          action: actionType,
          description: desc,
          entity_id: item.id
        };
        db.activity_log.push(log);
      });
    }

    db[this.table] = records;
    saveMockDb(db);

    const returnData = this.singleRow ? (updatedRecords[0] || null) : updatedRecords;
    return { data: JSON.parse(JSON.stringify(returnData)), error: null };
  }

  async _executeDelete() {
    const db = getMockDb();
    let records = db[this.table] || [];
    
    let deletedRecords = [];
    const beforeCount = records.length;
    records = records.filter(row => {
      const matches = this.filters.every(filter => row[filter.column] === filter.value);
      if (matches) {
        deletedRecords.push(row);
        return false;
      }
      return true;
    });

    const deletedCount = beforeCount - records.length;

    // Auto-log activity on delete
    if (this.table !== 'activity_log' && deletedRecords.length > 0) {
      db.activity_log = db.activity_log || [];
      deletedRecords.forEach(item => {
        let desc = `Se eliminó un registro en la tabla ${this.table} (ID: ${item.id})`;
        let moduleName = this.table;

        if (this.table === 'clients') {
          moduleName = 'Clientes';
          desc = `Se eliminó el cliente: ${item.name}`;
        } else if (this.table === 'prospects') {
          moduleName = 'Prospectos';
          desc = `Se eliminó el prospecto: ${item.name}`;
        } else if (this.table === 'quotations') {
          moduleName = 'Cotizaciones';
          desc = `Se eliminó la cotización ${item.id}`;
        } else if (this.table === 'services') {
          moduleName = 'Servicios';
          desc = `Se eliminó el servicio para la obra ${item.book_title}`;
        }

        db.activity_log.push({
          id: genId('activity_log'),
          user_id: getMockUser().id,
          user_email: getMockUser().email,
          date: new Date().toISOString(),
          module: moduleName,
          action: 'eliminación',
          description: desc,
          entity_id: item.id
        });
      });
    }

    db[this.table] = records;
    saveMockDb(db);
    return { data: { count: deletedCount }, error: null };
  }
}

// Helpers for mock IDs
function genId(prefix) {
  return `${prefix.substring(0, 3)}-${Math.random().toString(36).substr(2, 9)}`;
}

// Mock User handling
const getMockUser = () => {
  const userJson = localStorage.getItem('somos_noveli_crm_user');
  if (!userJson) {
    const defaultUser = { id: 'mock-user-123', email: 'admin@somosnoveli.cl', role: 'administrador' };
    localStorage.setItem('somos_noveli_crm_user', JSON.stringify(defaultUser));
    return defaultUser;
  }
  return JSON.parse(userJson);
};

// Mock Mutation Builder to wrap MockQueryBuilder mutations and support standard postgrest chaining
class MockMutationBuilder {
  constructor(builder, method, data, options) {
    this.builder = builder;
    this.method = method;
    this.data = data;
    this.options = options;
    this.selectColumns = null;
    this.isSingle = false;

    const self = this;
    const proxy = new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) {
          if (typeof target[prop] === 'function') {
            return target[prop].bind(target);
          }
          return target[prop];
        }

        // Intercept filter and chaining calls and forward to builder
        return (...args) => {
          if (prop === 'select') {
            target.selectColumns = args[0] || '*';
          } else if (prop === 'single') {
            target.isSingle = true;
            target.builder.single();
          } else if (typeof target.builder[prop] === 'function') {
            target.builder = target.builder[prop](...args);
          }
          return proxy;
        };
      }
    });

    return proxy;
  }

  then(onfulfilled, onrejected) {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch(onrejected) {
    return this.execute().catch(onrejected);
  }

  finally(onfinally) {
    return this.execute().finally(onfinally);
  }

  async execute() {
    let result;
    if (this.method === 'insert') {
      result = await this.builder._executeInsert(this.data);
    } else if (this.method === 'update') {
      result = await this.builder._executeUpdate(this.data);
    } else if (this.method === 'delete') {
      result = await this.builder._executeDelete();
    } else if (this.method === 'upsert') {
      result = await this.builder._executeUpsert(this.data, this.options);
    }
    if (result && result.data && this.isSingle) {
      if (Array.isArray(result.data)) {
        result.data = result.data[0] || null;
      }
    }
    return result;
  }
}

// Real Supabase Mutation Builder to support query chaining on insert/update/delete operations
class MutationQueryBuilder {
  constructor(realClient, table, method, data) {
    this.realClient = realClient;
    this.table = table;
    this.method = method;
    this.data = data;
    this.filters = [];
    this.selectColumns = null;
    this.isSingle = false;

    const self = this;
    const proxy = new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) {
          if (typeof target[prop] === 'function') {
            return target[prop].bind(target);
          }
          return target[prop];
        }

        // Catch any filtering/chaining methods like eq, neq, select, single, etc.
        return (...args) => {
          if (prop === 'select') {
            target.selectColumns = args[0] || '*';
          } else if (prop === 'single') {
            target.isSingle = true;
          } else {
            target.filters.push({ method: prop, args });
          }
          return proxy;
        };
      }
    });

    return proxy;
  }

  then(onfulfilled, onrejected) {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch(onrejected) {
    return this.execute().catch(onrejected);
  }

  finally(onfinally) {
    return this.execute().finally(onfinally);
  }

  async execute() {
    let query;

    if (this.method === 'insert') {
      const items = Array.isArray(this.data) ? this.data : [this.data];
      const updatedItems = await Promise.all(items.map(async item => {
        const newItem = { ...item };
        if (['services', 'incomes', 'expenses', 'quotations'].includes(this.table)) {
          if (newItem.exchange_rate === undefined) {
            let rate = newItem.currency === 'USD' ? 940 : newItem.currency === 'EUR' ? 1010 : 1;
            try {
              const todayStr = new Date().toISOString().split('T')[0];
              const rateRes = await this.realClient.from('exchange_rates').select('rate').eq('currency_from', newItem.currency).eq('date', todayStr).single();
              if (rateRes.data) {
                rate = Number(rateRes.data.rate);
              }
            } catch (e) {}
            newItem.exchange_rate = rate;
          }
          const amt = Number(newItem.value || newItem.amount || 0);
          newItem.value_converted = amt * newItem.exchange_rate;
          newItem.rate_date = newItem.start_date || newItem.date || new Date().toISOString().split('T')[0];
        }
        return newItem;
      }));
      query = this.realClient.from(this.table).insert(updatedItems);

    } else if (this.method === 'update') {
      query = this.realClient.from(this.table).update(this.data);

    } else if (this.method === 'delete') {
      query = this.realClient.from(this.table).delete();

    } else if (this.method === 'upsert') {
      const items = Array.isArray(this.data) ? this.data : [this.data];
      const updatedItems = await Promise.all(items.map(async item => {
        const newItem = { ...item };
        if (['services', 'incomes', 'expenses', 'quotations'].includes(this.table)) {
          if (newItem.exchange_rate === undefined) {
            let rate = newItem.currency === 'USD' ? 940 : newItem.currency === 'EUR' ? 1010 : 1;
            try {
              const todayStr = new Date().toISOString().split('T')[0];
              const rateRes = await this.realClient.from('exchange_rates').select('rate').eq('currency_from', newItem.currency).eq('date', todayStr).single();
              if (rateRes.data) {
                rate = Number(rateRes.data.rate);
              }
            } catch (e) {}
            newItem.exchange_rate = rate;
          }
          const amt = Number(newItem.value || newItem.amount || 0);
          newItem.value_converted = amt * newItem.exchange_rate;
          newItem.rate_date = newItem.start_date || newItem.date || new Date().toISOString().split('T')[0];
        }
        return newItem;
      }));
      query = this.realClient.from(this.table).upsert(updatedItems);
    }

    // Apply all recorded filters (eq, neq, in, etc.)
    for (const filter of this.filters) {
      if (typeof query[filter.method] === 'function') {
        query = query[filter.method](...filter.args);
      }
    }

    // Apply select
    if (this.selectColumns !== null) {
      query = query.select(this.selectColumns);
    } else {
      query = query.select();
    }

    if (this.isSingle) {
      query = query.single();
    }

    const result = await query;
    if (result.error) return result;

    const returnedData = result.data || [];
    const records = Array.isArray(returnedData) ? returnedData : [returnedData];

    // Post-insertion side effects
    if (this.method === 'insert' && records.length > 0) {
      if (this.table === 'services') {
        try {
          const stagesRes = await this.realClient.from('editorial_stages').select('*').eq('active', true).order('order', { ascending: true });
          const activeStages = stagesRes.data || [];
          const serviceStagesToInsert = [];
          records.forEach(serv => {
            activeStages.forEach((stage, idx) => {
              serviceStagesToInsert.push({
                service_id: serv.id,
                stage_name: stage.name,
                status: idx === 0 ? 'en proceso' : 'pendiente',
                start_date: idx === 0 ? new Date().toISOString().split('T')[0] : null,
                end_date: null,
                responsible: '',
                notes: ''
              });
            });
          });
          if (serviceStagesToInsert.length > 0) {
            await this.realClient.from('service_stages').insert(serviceStagesToInsert);
          }
        } catch (e) {
          console.error("Error creating stages for new service:", e);
        }
      }

      try {
        const userRes = await this.realClient.auth.getUser();
        const currentUser = userRes.data?.user;
        if (currentUser && this.table !== 'activity_log') {
          const logsToInsert = records.map(item => {
            let desc = `Se creó un registro en la tabla ${this.table}: ${item.name || item.book_title || item.title || item.id}`;
            let moduleName = this.table;
            let actionType = 'creación';

            if (this.table === 'clients') {
              moduleName = 'Clientes';
              desc = `Se registró el nuevo cliente: ${item.name}`;
            } else if (this.table === 'prospects') {
              moduleName = 'Prospectos';
              desc = `Se registró el prospecto: ${item.name}`;
            } else if (this.table === 'quotations') {
              moduleName = 'Cotizaciones';
              desc = `Se creó la cotización ${item.id}`;
            } else if (this.table === 'services') {
              moduleName = 'Servicios';
              desc = `Se contrató el servicio para la obra ${item.book_title}`;
            } else if (this.table === 'incomes') {
              moduleName = 'Ingresos';
              desc = `Ingreso registrado por ${formatCurrency(item.amount, item.currency)}`;
              actionType = 'ingreso registrado';
            } else if (this.table === 'expenses') {
              moduleName = 'Gastos';
              desc = `Gasto registrado por ${formatCurrency(item.amount, item.currency)}`;
              actionType = 'gasto registrado';
            } else if (this.table === 'documents') {
              moduleName = 'Documentos';
              desc = `Se subió el documento ${item.name}`;
              actionType = 'documento subido';
            }

            return {
              user_id: currentUser.id,
              user_email: currentUser.email,
              date: new Date().toISOString(),
              module: moduleName,
              action: actionType,
              description: desc,
              entity_id: item.id
            };
          });
          if (logsToInsert.length > 0) {
            await this.realClient.from('activity_log').insert(logsToInsert);
          }
        }
      } catch (e) {
        console.error("Activity logging error:", e);
      }
    }

    // Post-update side effects
    if (this.method === 'update' && records.length > 0) {
      if (['services', 'incomes', 'expenses', 'quotations'].includes(this.table) && 
          (this.data.value !== undefined || this.data.amount !== undefined || this.data.currency !== undefined || this.data.exchange_rate !== undefined)) {
        await Promise.all(records.map(async row => {
          let rate = row.exchange_rate || (row.currency === 'USD' ? 940 : row.currency === 'EUR' ? 1010 : 1);
          const amt = Number(row.value || row.amount || 0);
          const value_converted = amt * rate;
          await this.realClient.from(this.table).update({ value_converted, exchange_rate: rate }).eq('id', row.id);
        }));
      }

      try {
        const userRes = await this.realClient.auth.getUser();
        const currentUser = userRes.data?.user;
        if (currentUser && this.table !== 'activity_log') {
          const logsToInsert = records.map(item => {
            let desc = `Se actualizó un registro en la tabla ${this.table}: ${item.name || item.book_title || item.title || item.id}`;
            let moduleName = this.table;
            let actionType = 'edición';

            if (this.table === 'clients') {
              moduleName = 'Clientes';
              desc = `Se editó la información del cliente: ${item.name}`;
            } else if (this.table === 'prospects') {
              moduleName = 'Prospectos';
              desc = `Se editó el prospecto: ${item.name}`;
            } else if (this.table === 'quotations' && this.data.status === 'aceptada') {
              moduleName = 'Cotizaciones';
              actionType = 'aprobación de cotización';
              desc = `Se aprobó la cotización ${item.id}`;
            } else if (this.table === 'quotations' && this.data.status) {
              moduleName = 'Cotizaciones';
              actionType = 'cambio de estado de cotización';
              desc = `Se cambió el estado de la cotización ${item.id} a ${this.data.status}`;
            } else if (this.table === 'services' && this.data.current_stage) {
              moduleName = 'Servicios';
              actionType = 'cambio de etapa';
              desc = `Se cambió la etapa de la obra ${item.book_title} a ${this.data.current_stage}`;
            } else if (this.table === 'incomes' && this.data.status === 'pagado') {
              moduleName = 'Ingresos';
              actionType = 'pago marcado como recibido';
              desc = `Se recibió el pago de la cuenta de cobro ${item.id}`;
            }

            return {
              user_id: currentUser.id,
              user_email: currentUser.email,
              date: new Date().toISOString(),
              module: moduleName,
              action: actionType,
              description: desc,
              entity_id: item.id
            };
          });
          if (logsToInsert.length > 0) {
            await this.realClient.from('activity_log').insert(logsToInsert);
          }
        }
      } catch (e) {
        console.error("Activity logging error:", e);
      }
    }

    // Post-deletion side effects
    if (this.method === 'delete' && records.length > 0) {
      try {
        const userRes = await this.realClient.auth.getUser();
        const currentUser = userRes.data?.user;
        if (currentUser && this.table !== 'activity_log') {
          const logsToInsert = records.map(item => {
            let desc = `Se eliminó un registro en la tabla ${this.table} (ID: ${item.id})`;
            let moduleName = this.table;
            let actionType = 'eliminación';

            if (this.table === 'clients') {
              moduleName = 'Clientes';
              desc = `Se eliminó el cliente: ${item.name}`;
            } else if (this.table === 'prospects') {
              moduleName = 'Prospectos';
              desc = `Se eliminó el prospecto: ${item.name}`;
            } else if (this.table === 'quotations') {
              moduleName = 'Cotizaciones';
              desc = `Se eliminó la cotización ${item.id}`;
            } else if (this.table === 'services') {
              moduleName = 'Servicios';
              desc = `Se eliminó el servicio para la obra ${item.book_title}`;
            }

            return {
              user_id: currentUser.id,
              user_email: currentUser.email,
              date: new Date().toISOString(),
              module: moduleName,
              action: actionType,
              description: desc,
              entity_id: item.id
            };
          });
          if (logsToInsert.length > 0) {
            await this.realClient.from('activity_log').insert(logsToInsert);
          }
        }
      } catch (e) {
        console.error("Activity logging error:", e);
      }
    }

    let finalData = result.data;
    if (this.isSingle && Array.isArray(finalData)) {
      finalData = finalData[0] || null;
    } else if (!this.isSingle && !Array.isArray(finalData) && finalData !== null && finalData !== undefined) {
      finalData = [finalData];
    }
    return { data: finalData, error: null };
  }
}

// Real Supabase Query Builder with relation joins, currency conversions and logging interceptors
class RealSupabaseQueryBuilder {
  constructor(table, realClient) {
    this.table = table;
    this.realClient = realClient;
    this.query = realClient.from(table);
    this.singleRow = false;
    
    const self = this;
    const proxy = new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) {
          if (typeof target[prop] === 'function') {
            return target[prop].bind(target);
          }
          return target[prop];
        }
        
        if (prop === 'single') {
          return () => {
            target.singleRow = true;
            target.query = target.query.single();
            return proxy;
          };
        }

        if (typeof target.query[prop] === 'function') {
          return (...args) => {
            target.query = target.query[prop](...args);
            return proxy;
          };
        }
        
        return target.query[prop];
      }
    });

    return proxy;
  }

  then(onfulfilled, onrejected) {
    return this.execute().then(onfulfilled, onrejected);
  }

  async execute() {
    const result = await this.query;
    if (result.error) return { data: null, error: result.error };
    
    let data = result.data;
    if (!data) return { data: null, error: null };

    const isArray = Array.isArray(data);
    let records = isArray ? data : [data];

    if (records.length > 0) {
      // 1. Populate for services
      if (this.table === 'services') {
        const serviceIds = records.map(r => r.id);
        const [stagesRes, checklistsRes, clientsRes] = await Promise.all([
          this.realClient.from('service_stages').select('*').in('service_id', serviceIds),
          this.realClient.from('service_checklists').select('*').in('service_id', serviceIds),
          this.realClient.from('clients').select('id, name')
        ]);
        const stages = stagesRes.data || [];
        const checklists = checklistsRes.data || [];
        const clients = clientsRes.data || [];
        records = records.map(row => {
          row.client = clients.find(c => c.id === row.client_id) || null;
          row.stages = stages.filter(st => st.service_id === row.id).sort((a, b) => a.id.localeCompare(b.id));
          row.checklists = checklists.filter(chk => chk.service_id === row.id);
          return row;
        });
      }
      
      // 2. Populate for incomes
      if (this.table === 'incomes') {
        const clientIds = records.map(r => r.client_id).filter(Boolean);
        const serviceIds = records.map(r => r.service_id).filter(Boolean);
        const [clientsRes, servicesRes] = await Promise.all([
          clientIds.length > 0 ? this.realClient.from('clients').select('id, name').in('id', clientIds) : { data: [] },
          serviceIds.length > 0 ? this.realClient.from('services').select('id, book_title').in('id', serviceIds) : { data: [] }
        ]);
        records = records.map(row => {
          row.client = (clientsRes.data || []).find(c => c.id === row.client_id) || null;
          row.service = (servicesRes.data || []).find(s => s.id === row.service_id) || null;
          return row;
        });
      }

      // 3. Populate for expenses
      if (this.table === 'expenses') {
        const providerIds = records.map(r => r.provider_id).filter(Boolean);
        const providersRes = providerIds.length > 0 ? await this.realClient.from('providers').select('*').in('id', providerIds) : { data: [] };
        records = records.map(row => {
          row.provider = (providersRes.data || []).find(p => p.id === row.provider_id) || null;
          return row;
        });
      }

      // 4. Populate for service_pack_items
      if (this.table === 'service_pack_items') {
        const serviceIds = records.map(r => r.service_id).filter(Boolean);
        const catalogRes = serviceIds.length > 0 ? await this.realClient.from('service_catalog').select('*').in('id', serviceIds) : { data: [] };
        records = records.map(row => {
          row.service = (catalogRes.data || []).find(s => s.id === row.service_id) || null;
          return row;
        });
      }

      // 5. Populate for quotations
      if (this.table === 'quotations') {
        const quotIds = records.map(r => r.id);
        const clientIds = records.map(r => r.client_id).filter(Boolean);
        const prospectIds = records.map(r => r.prospect_id).filter(Boolean);

        const [itemsRes, clientsRes, prospectsRes, catalogRes, packsRes] = await Promise.all([
          this.realClient.from('quotation_items').select('*').in('quotation_id', quotIds),
          clientIds.length > 0 ? this.realClient.from('clients').select('id, name').in('id', clientIds) : { data: [] },
          prospectIds.length > 0 ? this.realClient.from('prospects').select('id, name').in('id', prospectIds) : { data: [] },
          this.realClient.from('service_catalog').select('*'),
          this.realClient.from('service_packs').select('*')
        ]);

        const items = itemsRes.data || [];
        const clients = clientsRes.data || [];
        const prospects = prospectsRes.data || [];
        const catalog = catalogRes.data || [];
        const packs = packsRes.data || [];

        records = records.map(row => {
          row.client = clients.find(c => c.id === row.client_id) || null;
          row.prospect = prospects.find(p => p.id === row.prospect_id) || null;
          row.items = items.filter(item => item.quotation_id === row.id).map(item => {
            item.service = catalog.find(s => s.id === item.service_id) || null;
            item.pack = packs.find(p => p.id === item.pack_id) || null;
            return item;
          });
          return row;
        });
      }

      // 6. Populate for quotation_items
      if (this.table === 'quotation_items') {
        const serviceIds = records.map(r => r.service_id).filter(Boolean);
        const packIds = records.map(r => r.pack_id).filter(Boolean);
        const [catalogRes, packsRes] = await Promise.all([
          serviceIds.length > 0 ? this.realClient.from('service_catalog').select('*').in('id', serviceIds) : { data: [] },
          packIds.length > 0 ? this.realClient.from('service_packs').select('*').in('id', packIds) : { data: [] }
        ]);
        records = records.map(row => {
          row.service = (catalogRes.data || []).find(s => s.id === row.service_id) || null;
          row.pack = (packsRes.data || []).find(p => p.id === row.pack_id) || null;
          return row;
        });
      }

      // 7. Populate for documents
      if (this.table === 'documents') {
        const clientIds = records.map(r => r.client_id).filter(Boolean);
        const providerIds = records.map(r => r.provider_id).filter(Boolean);
        const serviceIds = records.map(r => r.service_id).filter(Boolean);
        const incomeIds = records.map(r => r.income_id).filter(Boolean);
        const expenseIds = records.map(r => r.expense_id).filter(Boolean);
        const quotationIds = records.map(r => r.quotation_id).filter(Boolean);

        const [clientsRes, providersRes, servicesRes, incomesRes, expensesRes, quotationsRes] = await Promise.all([
          clientIds.length > 0 ? this.realClient.from('clients').select('id, name').in('id', clientIds) : { data: [] },
          providerIds.length > 0 ? this.realClient.from('providers').select('id, name').in('id', providerIds) : { data: [] },
          serviceIds.length > 0 ? this.realClient.from('services').select('id, book_title').in('id', serviceIds) : { data: [] },
          incomeIds.length > 0 ? this.realClient.from('incomes').select('id, amount, currency').in('id', incomeIds) : { data: [] },
          expenseIds.length > 0 ? this.realClient.from('expenses').select('id, amount, currency').in('id', expenseIds) : { data: [] },
          quotationIds.length > 0 ? this.realClient.from('quotations').select('id').in('id', quotationIds) : { data: [] }
        ]);

        records = records.map(row => {
          row.client = (clientsRes.data || []).find(c => c.id === row.client_id) || null;
          row.provider = (providersRes.data || []).find(p => p.id === row.provider_id) || null;
          row.service = (servicesRes.data || []).find(s => s.id === row.service_id) || null;
          row.income = (incomesRes.data || []).find(i => i.id === row.income_id) || null;
          row.expense = (expensesRes.data || []).find(e => e.id === row.expense_id) || null;
          row.quotation = (quotationsRes.data || []).find(q => q.id === row.quotation_id) || null;
          return row;
        });
      }
    }
    
    return { data: isArray ? records : records[0], error: null };
  }

  insert(newData) {
    return new MutationQueryBuilder(this.realClient, this.table, 'insert', newData);
  }

  update(updateData) {
    return new MutationQueryBuilder(this.realClient, this.table, 'update', updateData);
  }

  delete() {
    return new MutationQueryBuilder(this.realClient, this.table, 'delete');
  }

  upsert(newData) {
    return new MutationQueryBuilder(this.realClient, this.table, 'upsert', newData);
  }
}

// Mock Supabase Client implementation
const mockSupabase = {
  auth: {
    getSession: async () => {
      const user = localStorage.getItem('somos_noveli_crm_user') ? getMockUser() : null;
      if (user) {
        return { data: { session: { user, access_token: 'mock-session-token' } }, error: null };
      }
      return { data: { session: null }, error: null };
    },
    
    signInWithPassword: async ({ email, password }) => {
      if (email && password) {
        const user = { id: 'mock-user-123', email, role: 'administrador' };
        localStorage.setItem('somos_noveli_crm_user', JSON.stringify(user));
        
        if (authListener) {
          authListener('SIGNED_IN', { user, access_token: 'mock-session-token' });
        }
        return { data: { user, session: { user, access_token: 'mock-session-token' } }, error: null };
      }
      return { data: null, error: { message: "Email y contraseña requeridos" } };
    },

    signUp: async ({ email, password }) => {
      const user = { id: 'mock-user-123', email, role: 'administrador' };
      localStorage.setItem('somos_noveli_crm_user', JSON.stringify(user));
      if (authListener) {
        authListener('SIGNED_IN', { user, access_token: 'mock-session-token' });
      }
      return { data: { user, session: { user, access_token: 'mock-session-token' } }, error: null };
    },

    signOut: async () => {
      localStorage.removeItem('somos_noveli_crm_user');
      if (authListener) {
        authListener('SIGNED_OUT', null);
      }
      return { error: null };
    },

    onAuthStateChange: (callback) => {
      authListener = callback;
      const user = localStorage.getItem('somos_noveli_crm_user') ? getMockUser() : null;
      if (user) {
        callback('SIGNED_IN', { user, access_token: 'mock-session-token' });
      } else {
        callback('SIGNED_OUT', null);
      }
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListener = null;
            }
          }
        }
      };
    }
  },

  storage: {
    from: (bucket) => ({
      upload: async (path, file) => {
        const fileUrl = `mock_storage/${bucket}/${path}`;
        return { data: { path: fileUrl }, error: null };
      },
      getPublicUrl: (path) => ({
        data: { publicUrl: `https://mockstorage.supabase.co/${bucket}/${path}` }
      }),
      remove: async (paths) => {
        return { data: paths, error: null };
      }
    })
  },

  from: (table) => {
    return new MockQueryBuilder(table);
  }
};

let authListener = null;

if (useRealSupabase) {
  const realClient = createClient(supabaseUrl, supabaseAnonKey);
  supabaseInstance = {
    auth: realClient.auth,
    storage: realClient.storage,
    from: (table) => {
      return new RealSupabaseQueryBuilder(table, realClient);
    }
  };
  console.log("🚀 Somos Noveli CRM: Conectado a la base de datos Supabase Real.");
} else {
  supabaseInstance = mockSupabase;
  console.warn("⚠️ Somos Noveli CRM: Ejecutándose con base de datos Mock local (localStorage). Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en un archivo .env para conectar a Supabase real.");
}

export const supabase = supabaseInstance;
export const isMock = !useRealSupabase;

export const getValidOrgId = async () => {
  const defaultOrgId = '11111111-1111-1111-1111-111111111111';
  try {
    const storedOrgId = localStorage.getItem('somos_noveli_crm_org_id');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (storedOrgId && uuidRegex.test(storedOrgId)) {
      return storedOrgId;
    }

    const { data: { user } } = await supabaseInstance.auth.getUser();
    if (user) {
      const { data, error } = await supabaseInstance
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id);

      if (!error && data && data.length > 0) {
        const orgId = data[0].organization_id;
        if (orgId && uuidRegex.test(orgId)) {
          localStorage.setItem('somos_noveli_crm_org_id', orgId);
          return orgId;
        }
      }
    }
  } catch (err) {
    console.error("Error retrieving valid org id:", err);
  }
  return defaultOrgId;
};

function formatCurrency(amount, currency = 'CLP') {
  if (currency === 'CLP') {
    return '$' + Math.round(amount).toLocaleString('es-CL');
  }
  return 'US$ ' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

