import { useEffect, useState } from 'react';
import { supabase, getValidOrgId } from '../supabaseClient';
import { formatCurrency, formatDate } from '../utils';
import { jsPDF } from 'jspdf';
import { 
  X, Plus, FileText, Download, Edit2, Trash2, AlertTriangle
} from 'lucide-react';
import QuickQuoteModal from './QuickQuoteModal';
import { calculateProposalTotals } from '../utils/proposalCalculations';

export default function ClientQuotesModal({ 
  isOpen, 
  onClose, 
  clientId = null, 
  prospectId = null, 
  entityName = '', 
  preferredCurrency = 'CLP'
}) {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // State to trigger QuickQuoteModal
  const [isQuoteFormOpen, setIsQuoteFormOpen] = useState(false);
  const [selectedQuoteToEdit, setSelectedQuoteToEdit] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchQuotes();
    }
  }, [isOpen, clientId, prospectId]);

  const fetchQuotes = async () => {
    setLoading(true);
    setError('');
    try {
      const orgId = await getValidOrgId();
      let query = supabase.from('quotations').select('*').eq('organization_id', orgId);
      
      if (clientId) {
        query = query.eq('client_id', clientId);
      } else if (prospectId) {
        query = query.eq('prospect_id', prospectId);
      }

      const { data, error: fetchErr } = await query.order('created_at', { ascending: false });
      if (fetchErr) throw fetchErr;

      setQuotes(data || []);
    } catch (err) {
      console.error("Error loading quotations history:", err);
      setError('Error al cargar el historial de propuestas comerciales.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuote = async (quoteId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta propuesta comercial?')) return;
    try {
      const { error: delErr } = await supabase.from('quotations').delete().eq('id', quoteId);
      if (delErr) throw delErr;
      setQuotes(quotes.filter(q => q.id !== quoteId));
    } catch (err) {
      console.error("Error deleting quotation:", err);
      alert('No se pudo eliminar la propuesta.');
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'borrador': return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/60 dark:text-slate-400 dark:border-slate-800';
      case 'enviada': return 'bg-blue-50 text-blue-750 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/40';
      case 'aprobada': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-455 dark:border-emerald-900/40';
      case 'rechazada': return 'bg-rose-50 text-rose-700 border-rose-250 dark:bg-rose-950/20 dark:text-rose-455 dark:border-rose-900/40';
      case 'vencida': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40';
      case 'convertida': return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/40';
      default: return 'bg-slate-50 text-slate-655 border-slate-200';
    }
  };

  // Generate PDF from proposal detail
  const handleDownloadPDF = async (quote) => {
    try {
      const { data: items, error: itemsErr } = await supabase
        .from('quotation_items')
        .select('*')
        .eq('quotation_id', quote.id)
        .order('display_order', { ascending: true });

      if (itemsErr) throw itemsErr;

      // Palette Colors (Editorial Noveli)
      const primaryColor = [79, 70, 229]; // Indigo-600
      const secondaryColor = [30, 41, 59]; // Slate-800
      const lightBg = [248, 250, 252]; // Slate-50

      const doc = new jsPDF();
      
      // Top Stripe
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, 210, 8, 'F');

      // Brand Title
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(...primaryColor);
      doc.text('SOMOS NOVELI EDITORIAL', 20, 25);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Correo: contacto@somosnoveli.cl', 20, 31);
      doc.text('Web: www.somosnoveli.cl', 20, 36);

      // Document Header details
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...secondaryColor);
      doc.text('PROPUESTA EDITORIAL Y COMERCIAL', 115, 25);
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Número: ${quote.quote_number || 'S/N'}`, 115, 32);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Emisión: ${quote.issue_date || ''}`, 115, 38);
      doc.text(`Validez: ${quote.valid_until || ''} (${quote.validity_days || 15} días)`, 115, 43);

      // Recipient Box
      doc.setFillColor(...lightBg);
      doc.rect(20, 52, 170, 32, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(20, 52, 170, 32, 'D');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...secondaryColor);
      doc.text('INFORMACIÓN DE LA PROPUESTA', 25, 58);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Dirigido a: ${quote.author_name || entityName}`, 25, 64);
      doc.text(`Email: ${quote.author_email || 'Sin registrar'}`, 25, 70);
      doc.text(`Ubicación: ${quote.city || ''}${quote.city && quote.country ? ', ' : ''}${quote.country || ''}`, 25, 76);

      doc.text(`Objeto: ${quote.object || 'Propuesta de servicios editoriales.'}`, 110, 64, { maxWidth: 75 });
      if (quote.manuscript_pages > 0) {
        doc.text(`Manuscrito: ${quote.manuscript_pages} páginas`, 110, 76);
      }

      // Table Header
      let y = 92;
      doc.setFillColor(...secondaryColor);
      doc.rect(20, y, 170, 8, 'F');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('SERVICIOS INCLUIDOS', 23, y + 5.5);
      doc.text('CANT.', 125, y + 5.5);
      doc.text('PRECIO UNIT.', 143, y + 5.5);
      doc.text('TOTAL', 173, y + 5.5);

      // Table Items
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.setDrawColor(241, 245, 249);
      
      y += 8;
      (items || []).forEach((item, index) => {
        doc.line(20, y + 13, 190, y + 13);
        
        doc.setFont('Helvetica', 'bold');
        doc.text(`${index + 1}. ${item.concept}`, 23, y + 5.5);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(item.description || 'Sin descripción adicional.', 23, y + 10, { maxWidth: 90 });
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);

        doc.text(String(item.quantity || 1), 128, y + 7);
        doc.text(formatCurrency(item.unit_price || 0, quote.currency), 143, y + 7);
        doc.text(formatCurrency((item.unit_price || 0) * (item.quantity || 1), quote.currency), 173, y + 7);
        
        y += 13;
      });

      // Totals
      const totals = calculateProposalTotals(quote, items);
      console.log("proposal totals usados en PDF", totals);

      y += 4;
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      
      doc.text('Subtotal Base:', 125, y + 4);
      doc.text(formatCurrency(totals.subtotal, quote.currency), 173, y + 4);

      y += 5;
      if (totals.adjustmentAmount > 0) {
        doc.text('Ajuste Extensión:', 125, y + 4);
        doc.text(`+${formatCurrency(totals.adjustmentAmount, quote.currency)}`, 173, y + 4);
        y += 5;
      }

      if (totals.discount > 0) {
        doc.text('Descuento Especial:', 125, y + 4);
        doc.text(`-${formatCurrency(totals.discount, quote.currency)}`, 173, y + 4);
        y += 5;
      }

      const ivaMode = quote.iva_mode || (quote.includes_iva ? 'IVA incluido' : 'Exento / sin IVA');
      if (ivaMode !== 'Exento / sin IVA') {
        doc.text('Neto:', 125, y + 4);
        doc.text(formatCurrency(totals.net, quote.currency), 173, y + 4);
        y += 5;
        doc.text('IVA (19%):', 125, y + 4);
        doc.text(formatCurrency(totals.vat, quote.currency), 173, y + 4);
        y += 5;
      }

      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.setFontSize(10.5);
      doc.text('TOTAL DE LA PROPUESTA:', 110, y + 5);
      doc.text(formatCurrency(totals.total, quote.currency), 173, y + 5);

      // Terms
      y += 18;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...secondaryColor);
      doc.text('TÉRMINOS Y CONDICIONES', 20, y);
      
      doc.setDrawColor(...primaryColor);
      doc.line(20, y + 2, 70, y + 2);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);

      y += 7;
      doc.setFont('Helvetica', 'bold');
      doc.text('Plazo Estimado:', 20, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(quote.work_timeline || 'A convenir.', 48, y);

      y += 5.5;
      doc.setFont('Helvetica', 'bold');
      doc.text('Forma de Pago:', 20, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(quote.payment_terms || 'Estándar.', 53, y);

      y += 5.5;
      doc.setFont('Helvetica', 'bold');
      doc.text('Requisitos de Inicio:', 20, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(quote.start_conditions || 'Aceptación formal.', 53, y);

      // Notes
      y += 10;
      doc.setFillColor(...lightBg);
      doc.rect(20, y, 170, 32, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(20, y, 170, 32, 'D');

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);

      const splitLegal = doc.splitTextToSize(quote.legal_notes || '', 162);
      doc.text(splitLegal, 24, y + 5);

      // Signatures
      y += 42;
      doc.setDrawColor(203, 213, 225);
      doc.line(20, y, 80, y);
      doc.line(130, y, 190, y);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('Javier Román González', 32, y + 4);
      doc.text('Representante Noveli Editorial', 27, y + 8);
      
      doc.text('Aceptación de Propuesta', 142, y + 4);
      doc.text(quote.author_name || entityName || 'Firma Autor / Cliente', 142, y + 8);

      // Footer
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Somos Noveli Editorial - Los derechos de la obra pertenecen siempre al autor.', 45, 287);

      doc.save(`Propuesta_${quote.quote_number || 'S_N'}_${(quote.author_name || entityName).replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("Error generating proposal PDF:", err);
      alert('No se pudo generar el documento PDF.');
    }
  };

  const handleOpenNewQuote = () => {
    setSelectedQuoteToEdit(null);
    setIsQuoteFormOpen(true);
  };

  const handleOpenEditQuote = (quote) => {
    setSelectedQuoteToEdit(quote);
    setIsQuoteFormOpen(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              Propuestas Comerciales
            </h3>
            {entityName && (
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Destinatario: <span className="text-slate-600 dark:text-slate-300 font-bold">{entityName}</span>
              </p>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-655 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-xl text-rose-600 dark:text-rose-455 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Historial ({quotes.length})</span>
            <button
              onClick={handleOpenNewQuote}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-indigo-650/10 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Propuesta Comercial</span>
            </button>
          </div>

          <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/60">
                  <th className="p-3">Propuesta N°</th>
                  <th className="p-3">Destinatario / Objeto</th>
                  <th className="p-3">Emisión</th>
                  <th className="p-3 text-right">Monto</th>
                  <th className="p-3 text-center">Estado</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-[11px]">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
                    </td>
                  </tr>
                ) : quotes.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-slate-400 font-medium italic">
                      No hay propuestas registradas.
                    </td>
                  </tr>
                ) : (
                  quotes.map((quote) => (
                    <tr key={quote.id} className="hover:bg-slate-55 dark:hover:bg-slate-950/15">
                      <td className="p-3 font-bold text-slate-700 dark:text-slate-200">
                        {quote.quote_number || 'S/N'}
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-slate-800 dark:text-slate-150 block">{quote.author_name || 'Desconocido'}</span>
                        <span className="text-[10px] text-slate-400">{quote.object || 'Servicios editoriales'}</span>
                      </td>
                      <td className="p-3 text-slate-500">
                        {formatDate(quote.issue_date)}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-700 dark:text-slate-350">
                        {formatCurrency(quote.total, quote.currency)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded border uppercase text-[9px] font-bold tracking-wide ${getStatusBadgeColor(quote.status)}`}>
                          {quote.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleDownloadPDF(quote)}
                          className="inline-flex p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 cursor-pointer align-middle"
                          title="Descargar PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditQuote(quote)}
                          className="inline-flex p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-indigo-650 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 cursor-pointer align-middle"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuote(quote.id)}
                          className="inline-flex p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer align-middle"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl text-xs font-bold cursor-pointer"
          >
            Cerrar
          </button>
        </div>

        {/* Nested Quote form */}
        <QuickQuoteModal
          isOpen={isQuoteFormOpen}
          onClose={() => setIsQuoteFormOpen(false)}
          clientId={clientId}
          prospectId={prospectId}
          entityName={entityName}
          preferredCurrency={preferredCurrency}
          quotationToEdit={selectedQuoteToEdit}
          onSuccess={() => {
            fetchQuotes();
            alert('¡Operación realizada con éxito!');
          }}
        />
      </div>
    </div>
  );
}
