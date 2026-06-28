import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Plus, Search, Edit2, Trash2, X, MessageSquare, Copy, Check,
  Mail, MessageCircle, FileText, ToggleLeft, ToggleRight
} from 'lucide-react';

const InstagramIcon = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

export default function QuickReplies() {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState('todos');
  
  // Clipboard copied feedback states
  const [copiedId, setCopiedId] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReply, setSelectedReply] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    channel: 'general',
    message_text: '',
    active: true
  });

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchReplies();
  }, []);

  const fetchReplies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quick_replies')
        .select('*')
        .order('title', { ascending: true });

      if (error) throw error;
      setReplies(data || []);
    } catch (err) {
      console.error("Error loading quick replies:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setSelectedReply(null);
    setFormData({
      title: '',
      category: '',
      channel: 'general',
      message_text: '',
      active: true
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (reply) => {
    setSelectedReply(reply);
    setFormData({
      title: reply.title || '',
      category: reply.category || '',
      channel: reply.channel || 'general',
      message_text: reply.message_text || '',
      active: reply.active !== undefined ? reply.active : true
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleDeleteReply = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta plantilla de respuesta rápida?')) {
      try {
        const { error } = await supabase
          .from('quick_replies')
          .delete()
          .eq('id', id);

        if (error) throw error;
        setReplies(replies.filter(r => r.id !== id));
      } catch (err) {
        console.error('Error deleting reply:', err);
        alert('Error al eliminar la plantilla');
      }
    }
  };

  const handleToggleActive = async (reply) => {
    try {
      const newActiveState = !reply.active;
      const { error } = await supabase
        .from('quick_replies')
        .update({ active: newActiveState })
        .eq('id', reply.id);

      if (error) throw error;
      
      setReplies(replies.map(r => r.id === reply.id ? { ...r, active: newActiveState } : r));
    } catch (err) {
      console.error('Error toggling reply active state:', err);
      alert('Error al cambiar el estado del mensaje');
    }
  };

  const handleCopyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError('El título es requerido.');
      return;
    }
    if (!formData.message_text.trim()) {
      setFormError('El texto del mensaje es requerido.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      if (selectedReply) {
        // Edit Mode
        const { error } = await supabase
          .from('quick_replies')
          .update(formData)
          .eq('id', selectedReply.id);

        if (error) throw error;
      } else {
        // Add Mode
        const { error } = await supabase
          .from('quick_replies')
          .insert([formData]);

        if (error) throw error;
      }

      await fetchReplies();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving reply:', err);
      setFormError(err.message || 'Error al guardar la plantilla.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filters logic
  const filteredReplies = replies.filter(r => {
    if (!r) return false;
    const title = String(r.title || '').toLowerCase();
    const category = String(r.category || '').toLowerCase();
    const msg = String(r.message_text || '').toLowerCase();
    const query = String(searchQuery || '').toLowerCase();
    
    const matchesSearch = 
      title.includes(query) ||
      category.includes(query) ||
      msg.includes(query);

    const matchesChannel = channelFilter === 'todos' || r.channel === channelFilter;

    return matchesSearch && matchesChannel;
  });

  const getChannelIcon = (chan) => {
    switch (chan) {
      case 'Instagram': return <InstagramIcon className="w-4 h-4 text-pink-500" />;
      case 'correo': return <Mail className="w-4 h-4 text-blue-500" />;
      case 'WhatsApp': return <MessageCircle className="w-4 h-4 text-emerald-500" />;
      default: return <FileText className="w-4 h-4 text-slate-500" />;
    }
  };

  const getChannelBadge = (chan) => {
    switch (chan) {
      case 'Instagram': return 'bg-pink-50 text-pink-700 border-pink-100 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-900';
      case 'correo': return 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900';
      case 'WhatsApp': return 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900';
      default: return 'bg-slate-50 text-slate-700 border-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
            Respuestas Rápidas (Mensajes)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Escribe plantillas de comunicación para responder rápidamente a cotizaciones e interesados en redes y correos.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-brand-600/20 cursor-pointer w-fit"
        >
          <Plus className="w-4 h-4" />
          Añadir Plantilla
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Buscar por título, contenido o categoría..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Canal:</span>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="block w-full md:w-44 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 text-sm focus:outline-none capitalize"
          >
            <option value="todos">Todos</option>
            <option value="Instagram">Instagram</option>
            <option value="correo">Correo</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="general">General</option>
          </select>
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
        </div>
      ) : filteredReplies.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-12 text-center text-slate-400">
          No se encontraron plantillas de respuestas rápidas.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredReplies.map((reply) => (
            <div 
              key={reply.id} 
              className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 flex flex-col justify-between hover:shadow-md transition-all ${reply.active ? 'border-slate-100 dark:border-slate-800' : 'border-slate-200/50 opacity-60 dark:border-slate-900/60'}`}
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold border rounded-lg uppercase tracking-wider ${getChannelBadge(reply.channel)}`}>
                      {getChannelIcon(reply.channel)}
                      <span>{reply.channel}</span>
                    </span>
                    {reply.category && (
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-850 dark:text-slate-400 px-2 py-1 rounded-lg">
                        {reply.category}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleToggleActive(reply)}
                    className="text-slate-400 hover:text-slate-655"
                    title={reply.active ? "Desactivar plantilla" : "Activar plantilla"}
                  >
                    {reply.active ? (
                      <ToggleRight className="w-7 h-7 text-brand-600 dark:text-brand-400" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-slate-405" />
                    )}
                  </button>
                </div>

                <div>
                  <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">{reply.title}</h3>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-xl mt-2 text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-sans max-h-36 overflow-y-auto whitespace-pre-wrap">
                    {reply.message_text}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-5 pt-3 border-t border-slate-50 dark:border-slate-850 flex justify-between items-center">
                <button
                  onClick={() => handleCopyToClipboard(reply.message_text, reply.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${copiedId === reply.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-brand-50 hover:bg-brand-100 text-brand-600 dark:bg-brand-950/30 dark:text-brand-400 dark:hover:bg-brand-950/50'}`}
                >
                  {copiedId === reply.id ? (
                    <>
                      <Check className="w-4.5 h-4.5" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4.5 h-4.5" />
                      <span>Copiar Plantilla</span>
                    </>
                  )}
                </button>

                <div className="flex gap-1">
                  <button
                    onClick={() => handleOpenEditModal(reply)}
                    className="p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteReply(reply.id)}
                    className="p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-brand-500" />
                {selectedReply ? 'Editar Plantilla' : 'Añadir Plantilla'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400">
                  {formError}
                </div>
              )}

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Título Plantilla *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                    placeholder="e.g. Saludo Inicial Instagram"
                  />
                </div>

                {/* Category & Channel */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Categoría (Clasificación)</label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none"
                      placeholder="e.g. Ventas, Soporte, Cobro"
                    />
                  </div>

                  {/* Channel */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Canal de Destino</label>
                    <select
                      value={formData.channel}
                      onChange={(e) => setFormData({...formData, channel: e.target.value})}
                      className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-sm focus:outline-none capitalize"
                    >
                      <option value="general">general</option>
                      <option value="Instagram">Instagram</option>
                      <option value="correo">correo</option>
                      <option value="WhatsApp">WhatsApp</option>
                    </select>
                  </div>
                </div>

                {/* Message text */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Texto del Mensaje *</label>
                  <textarea
                    rows="6"
                    required
                    value={formData.message_text}
                    onChange={(e) => setFormData({...formData, message_text: e.target.value})}
                    className="block w-full p-3 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 font-sans"
                    placeholder="Escribe el mensaje aquí..."
                  ></textarea>
                </div>

                {/* Active switch */}
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-850">
                  <div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-350 block">Mensaje Activo</span>
                    <span className="text-[10px] text-slate-400 leading-normal">Los mensajes activos se muestran listados para su copia rápida.</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, active: !formData.active})}
                    className="text-slate-400 hover:text-slate-655 cursor-pointer"
                  >
                    {formData.active ? (
                      <ToggleRight className="w-8 h-8 text-brand-600 dark:text-brand-400" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
