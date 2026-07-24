const GENERAL_SERVICE_VALUES = new Set(['', 'general', 'consulta general']);

const normalizeLabel = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const FIELD_MAP = {
  'servicio interes': 'parsedServiceInterest',
  'servicio de interes': 'parsedServiceInterest',
  'servicio solicitado': 'parsedServiceInterest',
  'servicio': 'parsedServiceInterest',
  'servicio id': 'serviceId',
  'paginas aprox': 'pagesApprox',
  'paginas aproximadas': 'pagesApprox',
  'palabras aprox': 'wordsApprox',
  'palabras aproximadas': 'wordsApprox',
  'estado manuscrito': 'manuscriptStatus',
  'estado del manuscrito': 'manuscriptStatus',
  'acepta terminos y privacidad': 'acceptedTermsText',
  'acepta terminos': 'acceptedTermsText',
  'fecha aceptacion terminos': 'acceptedTermsAtText',
  'fecha de aceptacion terminos': 'acceptedTermsAtText',
  'mensaje descripcion del autor': 'authorDescription',
  'descripcion del autor': 'authorDescription',
  'mensaje del autor': 'authorDescription'
};

const createEmptyParsedLead = () => ({
  parsedServiceInterest: '',
  serviceId: '',
  pagesApprox: '',
  wordsApprox: '',
  manuscriptStatus: '',
  acceptedTermsText: '',
  acceptedTermsAtText: '',
  authorDescription: ''
});

export const parseLeadManuscriptInfo = (lead) => {
  const parsed = createEmptyParsedLead();
  const rawInfo = lead?.manuscript_info;

  if (!rawInfo) return parsed;

  const text = typeof rawInfo === 'string'
    ? rawInfo
    : JSON.stringify(rawInfo, null, 2);

  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let currentField = null;

  lines.forEach((line) => {
    const match = line.match(/^\s*[-*]?\s*([^:]+):\s*(.*)$/);

    if (match) {
      const field = FIELD_MAP[normalizeLabel(match[1])];
      if (field) {
        currentField = field;
        parsed[field] = match[2].trim();
        return;
      }
    }

    if (currentField === 'authorDescription') {
      parsed.authorDescription = [parsed.authorDescription, line.trim()]
        .filter(Boolean)
        .join('\n');
    }
  });

  return parsed;
};

const isGeneralServiceValue = (value) => GENERAL_SERVICE_VALUES.has(normalizeLabel(value));

export const getLeadDisplayService = (lead, parsed = parseLeadManuscriptInfo(lead)) => {
  const directService = [lead?.service_interest, lead?.service_of_interest]
    .map((value) => String(value || '').trim())
    .find(Boolean) || '';

  if (!isGeneralServiceValue(directService)) {
    return directService;
  }

  return parsed.parsedServiceInterest || 'Consulta General';
};

export const getLeadDisplayMessage = (lead, parsed = parseLeadManuscriptInfo(lead)) => {
  return String(lead?.message || '').trim() || parsed.authorDescription || 'Sin mensaje adicional';
};

export const formatLeadConversionNotes = (lead, parsed = parseLeadManuscriptInfo(lead)) => {
  const displayService = getLeadDisplayService(lead, parsed);
  const displayMessage = getLeadDisplayMessage(lead, parsed);
  const notes = [
    '[Solicitud Web]',
    `Servicio solicitado: ${displayService}`,
    parsed.serviceId ? `Servicio ID: ${parsed.serviceId}` : '',
    parsed.pagesApprox ? `Paginas aproximadas: ${parsed.pagesApprox}` : '',
    parsed.wordsApprox ? `Palabras aproximadas: ${parsed.wordsApprox}` : '',
    parsed.manuscriptStatus ? `Estado del manuscrito: ${parsed.manuscriptStatus}` : '',
    `Mensaje/Descripcion del autor: ${displayMessage}`,
    lead?.manuscript_info ? `\nInformacion original del manuscrito:\n${lead.manuscript_info}` : ''
  ];

  return notes.filter(Boolean).join('\n');
};
