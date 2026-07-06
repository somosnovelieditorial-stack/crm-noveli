import { useEffect, useState } from 'react';
import { supabase, getValidOrgId } from '../supabaseClient';
import { formatCurrency, formatDate } from '../utils';
import { jsPDF } from 'jspdf';
import { 
  X, Plus, FileText, Download, Edit2, Trash2, CheckCircle2, AlertTriangle, FileSpreadsheet
} from 'lucide-react';
import QuickQuoteModal from './QuickQuoteModal';

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
  }, [isOpen]);

  const fetchQuotes = async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase.from('quotations').select('*');
      if (clientId) {
        query = query.eq('client_id', clientId);
      } else if (prospectId) {
        query = query.eq('prospect_id', prospectId);
      } else {
        setQuotes([]);
        setLoading(false);
        return;
      }

      const { data, error: fetchErr } = await query.order('created_at', { ascending: false });
      if (fetchErr) throw fetchErr;

      setQuotes(data || []);
    } catch (err) {
      console.error("Error loading client quotations:", err);
      setError('Error al cargar el historial de cotizaciones.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuote = async (quoteId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta cotización?')) return;
    try {
      const { error: delErr } = await supabase.from('quotations').delete().eq('id', quoteId);
      if (delErr) throw delErr;
      setQuotes(quotes.filter(q => q.id !== quoteId));
    } catch (err) {
      console.error("Error deleting quotation:", err);
      alert('No se pudo eliminar la cotización.');
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'borrador': return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/60 dark:text-slate-400 dark:border-slate-800';
      case 'enviada': return 'bg-blue-50 text-blue-750 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/40';
      case 'aprobada': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900/40';
      case 'rechazada': return 'bg-rose-50 text-rose-700 border-rose-250 dark:bg-rose-950/20 dark:text-rose-455 dark:border-rose-900/40';
      case 'vencida': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40';
      case 'convertida': return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/40';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  // Helper for generating PDF from quote list
  const handleDownloadPDF = async (quote) => {
    try {
      const { data: items, error: itemsErr } = await supabase
        .from('quotation_items')
        .select('*')
        .eq('quotation_id', quote.id)
        .order('display_order', { ascending: true });

      if (itemsErr) throw itemsErr;

      // Palette
      const primaryColor = [79, 70, 229]; // Indigo-600
      const secondaryColor = [30, 41, 59]; // Slate-800
      const lightBg = [248, 250, 252]; // Slate-50

      const doc = new jsPDF();
      
      // Header Stripe
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

      // Metadata Block
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...secondaryColor);
      doc.text('COTIZACIÓN COMERCIAL', 130, 25);
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Número: ${quote.quote_number || 'S/N'}`, 130, 32);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Emisión: ${quote.issue_date || ''}`, 130, 38);
      doc.text(`Validez: ${quote.valid_until || ''} (${quote.validity_days || 15} días)`, 130, 43);

      // Client Box
      doc.setFillColor(...lightBg);
      doc.rect(20, 52, 170, 26, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(20, 52, 170, 26, 'D');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...secondaryColor);
      doc.text('DATOS DEL DESTINATARIO', 25, 58);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Nombre / Razón Social: ${entityName}`, 25, 64);
      doc.text(`Moneda de cotización: ${quote.currency || 'CLP'}`, 25, 70);

      if (quote.manuscript_pages > 0) {
        doc.text(`Extensión manuscrito: ${quote.manuscript_pages} páginas`, 110, 70);
      }

      // Table Header
      let y = 88;
      doc.setFillColor(...secondaryColor);
      doc.rect(20, y, 170, 8, 'F');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('CONCEPTO / SERVICIO', 23, y + 5.5);
      doc.text('CANT.', 125, y + 5.5);
      doc.text('VALOR UNIT.', 143, y + 5.5);
      doc.text('TOTAL', 173, y + 5.5);

      // Table Body
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.setDrawColor(241, 245, 249);
      
      y += 8;
      (items || []).forEach((item) => {
        doc.line(20, y + 9, 190, y + 9);
        
        doc.setFont('Helvetica', 'bold');
        doc.text(item.concept || '', 23, y + 6);
        doc.setFont('Helvetica', 'normal');
        
        doc.text(String(item.quantity || 1), 128, y + 6);
        doc.text(formatCurrency(item.unit_price || 0, quote.currency), 143, y + 6);
        doc.text(formatCurrency((item.unit_price || 0) * (item.quantity || 1), quote.currency), 173, y + 6);
        
        y += 9;
      });

      // Totals
      y += 4;
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      
      doc.text('Subtotal Base:', 125, y + 4);
      doc.text(formatCurrency(quote.subtotal || 0, quote.currency), 173, y + 4);

      y += 5;
      const adjustmentAmount = quote.extension_adjustment_type === 'percentage'
        ? Math.round(Number(quote.subtotal || 0) * (Number(quote.extension_adjustment_value || 0) / 100))
        : Number(quote.extension_adjustment_value || 0);

      if (adjustmentAmount > 0) {
        doc.text('Ajuste Extensión:', 125, y + 4);
        doc.text(`+${formatCurrency(adjustmentAmount, quote.currency)}`, 173, y + 4);
        y += 5;
      }

      if (Number(quote.discount) > 0) {
        doc.text('Descuento Especial:', 125, y + 4);
        doc.text(`-${formatCurrency(quote.discount, quote.currency)}`, 173, y + 4);
        y += 5;
      }

      if (quote.includes_iva) {
        const net = Math.round(Number(quote.total) / 1.19);
        const vat = Number(quote.total) - net;
        
        doc.text('Neto (Ajustado):', 125, y + 4);
        doc.text(formatCurrency(net, quote.currency), 173, y + 4);
        y += 5;
        doc.text('IVA (19%):', 125, y + 4);
        doc.text(formatCurrency(vat, quote.currency), 173, y + 4);
        y += 5;
      }

      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.setFontSize(10.5);
      doc.text('TOTAL FINAL:', 125, y + 5);
      doc.text(formatCurrency(quote.total || 0, quote.currency), 173, y + 5);

      // Terms
      y += 18;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...secondaryColor);
      doc.text('CONDICIONES COMERCIALES Y ALCANCE', 20, y);
      
      doc.setDrawColor(...primaryColor);
      doc.line(20, y + 2, 70, y + 2);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);

      y += 7;
      doc.setFont('Helvetica', 'bold');
      doc.text('1. Alcance y Plazos:', 20, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(quote.scope_notes || 'Servicios contratados conforme a requerimientos.', 53, y);

      y += 5.5;
      doc.setFont('Helvetica', 'bold');
      doc.text('2. Qué Incluye:', 20, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(quote.includes_notes || 'Revisión y entregables detallados.', 45, y);

      y += 5.5;
      doc.setFont('Helvetica', 'bold');
      doc.text('3. Exclusiones:', 20, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(quote.excludes_notes || 'Servicios no listados en la presente cotización.', 45, y);

      y += 5.5;
      doc.setFont('Helvetica', 'bold');
      doc.text('4. Forma de Pago:', 20, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(quote.payment_terms || 'Transferencia directa.', 48, y);

      y += 5.5;
      doc.setFont('Helvetica', 'bold');
      doc.text('5. Inicio de Trabajo:', 20, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(quote.start_conditions || 'Aprobación de cotización y pago inicial.', 52, y);

      // Notes
      y += 10;
      doc.setFillColor(...lightBg);
      doc.rect(20, y, 170, 16, 'F');
      doc.setFont('Helvetica', 'oblique');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      
      const splitLegal = doc.splitTextToSize(quote.legal_notes || '', 160);
      doc.text(splitLegal, 25, y + 5);

      // Signatures
      y += 24;
      doc.setDrawColor(203, 213, 225);
      doc.line(20, y, 80, y);
      doc.line(130, y, 190, y);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Firma Autorizada Noveli', 35, y + 4);
      doc.text('Aceptación de Conformidad Cliente', 135, y + 4);

      // Footer
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Somos Noveli Editorial - Los derechos de la obra pertenecen siempre al autor.', 45, 287);

      doc.save(`${quote.quote_number || 'COT'}_Cotizacion_${entityName.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("Error generating PDF:", err);
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
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              Historial de Cotizaciones
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Contacto: <span className="text-slate-600 dark:text-slate-300 font-bold">{entityName}</span>
            </p>
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
              <span>Nueva Cotización</span>
            </button>
          </div>

          <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/60">
                  <th className="p-3">Cotización</th>
                  <th className="p-3">Emisión</th>
                  <th className="p-3 text-right">Monto</th>
                  <th className="p-3 text-center">Estado</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-[11px]">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
                    </td>
                  </tr>
                ) : quotes.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-400 font-medium italic">
                      No se registran cotizaciones comerciales para este contacto.
                    </td>
                  </tr>
                ) : (
                  quotes.map((quote) => (
                    <tr key={quote.id} className="hover:bg-slate-55 dark:hover:bg-slate-950/15">
                      <td className="p-3 font-bold text-slate-700 dark:text-slate-200">
                        {quote.quote_number || 'S/N'}
                        {quote.manuscript_pages > 0 && (
                          <span className="block text-[9px] text-slate-400 mt-0.5 font-normal">
                            {quote.manuscript_pages} págs
                          </span>
                        )}
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
                          className="inline-flex p-1 rounded border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 cursor-pointer align-middle"
                          title="Descargar PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditQuote(quote)}
                          className="inline-flex p-1 rounded border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-indigo-650 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 cursor-pointer align-middle"
                          title="Editar Cotización"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuote(quote.id)}
                          className="inline-flex p-1 rounded border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer align-middle"
                          title="Eliminar Cotización"
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
