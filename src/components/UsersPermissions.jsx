import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Users, UserPlus, Shield, Edit2, Trash2, Check, X, 
  AlertTriangle, ShieldCheck, Mail, Briefcase, Key, RefreshCw, CheckSquare, Square
} from 'lucide-react';

const AVAILABLE_ROLES = [
  { id: 'admin', label: 'Administrador' },
  { id: 'direccion', label: 'Dirección' },
  { id: 'editor', label: 'Editor' },
  { id: 'corrector', label: 'Corrector' },
  { id: 'maquetador', label: 'Maquetador' },
  { id: 'diseñador', label: 'Diseñador' },
  { id: 'finanzas', label: 'Finanzas' },
  { id: 'asistente', label: 'Asistente' },
  { id: 'visualizador', label: 'Visualizador' }
];

const AVAILABLE_AREAS = [
  'Dirección', 'Editorial', 'Diseño', 'Maquetación', 
  'Finanzas', 'Comercial', 'Administración', 'Sitio Web', 'Reportes'
];

const CRM_MODULES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'quotations', label: 'Propuestas Comerciales' },
  { id: 'prospects', label: 'Prospectos' },
  { id: 'clients', label: 'Clientes' },
  { id: 'services', label: 'Servicios Contratados' },
  { id: 'documents', label: 'Documentos' },
  { id: 'catalog', label: 'Catálogo y Packs' },
  { id: 'incomes', label: 'Ingresos' },
  { id: 'expenses', label: 'Gastos' },
  { id: 'taxes', label: 'Impuestos' },
  { id: 'staff', label: 'Personal' },
  { id: 'reserve', label: 'Reserva Operacional' },
  { id: 'website', label: 'Sitio Web' },
  { id: 'reports', label: 'Reportes' },
  { id: 'configuration', label: 'Configuración' },
  { id: 'audit', label: 'Auditoría del CRM' },
  { id: 'users', label: 'Usuarios y Permisos' }
];

const ACTIONS = [
  { id: 'ver', label: 'Ver' },
  { id: 'crear', label: 'Crear' },
  { id: 'editar', label: 'Editar' },
  { id: 'eliminar', label: 'Eliminar' },
  { id: 'exportar', label: 'Exportar' },
  { id: 'aprobar', label: 'Aprobar' },
  { id: 'administrar', label: 'Administrar' }
];

const createDefaultPermissions = () => {
  const perms = {};
  CRM_MODULES.forEach(mod => {
    perms[mod.id] = {};
    ACTIONS.forEach(act => {
      perms[mod.id][act.id] = mod.id === 'dashboard' && act.id === 'ver';
    });
  });
  return perms;
};

export default function UsersPermissions({ organizationId, userRole }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  // Form states for creating a new member
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState('editor');
  const [newArea, setNewArea] = useState('Editorial');
  const [newPermissions, setNewPermissions] = useState(createDefaultPermissions());
  const [formWarning, setFormWarning] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form states for editing a member
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editPermissions, setEditPermissions] = useState({});
  const [editActive, setEditActive] = useState(true);

  const fetchMembers = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.error('Error fetching organization members:', err);
      setErrorMsg('No se pudieron cargar los usuarios. Verifique su conexión.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchMembers();
    }
  }, [organizationId]);

  // Handle Add Member Submit
  const handleAddMember = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setFormWarning('');
    setSubmitting(true);

    if (!newEmail.trim() || !newFullName.trim()) {
      setErrorMsg('Complete todos los campos obligatorios.');
      setSubmitting(false);
      return;
    }

    try {
      // 1. Try to find the user in auth.users by calling our RPC function
      const { data: userId, error: rpcErr } = await supabase.rpc('get_user_id_by_email', {
        email_addr: newEmail.trim().toLowerCase()
      });

      if (rpcErr) {
        throw new Error(rpcErr.message);
      }

      if (!userId) {
        setFormWarning(
          'Para crear cuentas nuevas se requiere función segura de Supabase (Edge Function). Puedes agregar usuarios existentes por email. No se encontró ninguna cuenta registrada en Supabase Auth con este correo.'
        );
        setSubmitting(false);
        return;
      }

      // 2. Insert into organization_members
      const { error: insertErr } = await supabase
        .from('organization_members')
        .insert([{
          organization_id: organizationId,
          user_id: userId,
          email: newEmail.trim().toLowerCase(),
          full_name: newFullName.trim(),
          role: newRole,
          area: newArea,
          active: true,
          permissions: newPermissions
        }]);

      if (insertErr) {
        if (insertErr.code === '23505') {
          throw new Error('Este usuario ya pertenece a la organización.');
        }
        throw insertErr;
      }

      setSuccessMsg('Usuario agregado correctamente a la organización.');
      setShowAddModal(false);
      // Reset form
      setNewEmail('');
      setNewFullName('');
      setNewRole('editor');
      setNewArea('Editorial');
      setNewPermissions(createDefaultPermissions());
      fetchMembers();
    } catch (err) {
      console.error('Error adding organization member:', err);
      setErrorMsg(err.message || 'Error al intentar guardar el usuario.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (member) => {
    setSelectedMember(member);
    setEditFullName(member.full_name || '');
    setEditRole(member.role || 'editor');
    setEditArea(member.area || 'Editorial');
    setEditActive(member.active !== false);
    // Parse permissions json or set defaults
    const currentPerms = member.permissions || createDefaultPermissions();
    setEditPermissions(JSON.parse(JSON.stringify(currentPerms)));
    setShowEditModal(true);
  };

  // Handle Edit Member Submit
  const handleEditMember = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const { error: updateErr } = await supabase
        .from('organization_members')
        .update({
          full_name: editFullName.trim(),
          role: editRole,
          area: editArea,
          active: editActive,
          permissions: editPermissions
        })
        .eq('id', selectedMember.id);

      if (updateErr) throw updateErr;

      setSuccessMsg('Miembro actualizado correctamente.');
      setShowEditModal(false);
      fetchMembers();
    } catch (err) {
      console.error('Error updating organization member:', err);
      setErrorMsg(err.message || 'Error al intentar guardar los cambios.');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Member Active state directly
  const toggleMemberActive = async (member) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ active: !member.active })
        .eq('id', member.id);

      if (error) throw error;
      setSuccessMsg(`Estado de usuario actualizado correctamente.`);
      fetchMembers();
    } catch (err) {
      console.error('Error toggling member state:', err);
      setErrorMsg('No se pudo actualizar el estado.');
    }
  };

  // Remove Member access
  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('¿Está seguro de que desea remover el acceso de este usuario a la organización?')) {
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
      setSuccessMsg('Acceso del usuario removido correctamente.');
      fetchMembers();
    } catch (err) {
      console.error('Error removing organization member:', err);
      setErrorMsg('No se pudo eliminar el acceso del usuario.');
    }
  };

  // Helper toggle permission checkboxes
  const handlePermChange = (isEdit, moduleId, actionId) => {
    if (isEdit) {
      setEditPermissions(prev => {
        const copy = JSON.parse(JSON.stringify(prev));
        if (!copy[moduleId]) copy[moduleId] = {};
        copy[moduleId][actionId] = !copy[moduleId][actionId];
        return copy;
      });
    } else {
      setNewPermissions(prev => {
        const copy = JSON.parse(JSON.stringify(prev));
        if (!copy[moduleId]) copy[moduleId] = {};
        copy[moduleId][actionId] = !copy[moduleId][actionId];
        return copy;
      });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            Usuarios y Permisos
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Administre los usuarios pertenecientes a la organización y configure sus privilegios de acceso.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchMembers}
            className="p-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setFormWarning('');
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-650/15 cursor-pointer transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Agregar Usuario
          </button>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-955/20 border border-rose-150 dark:border-rose-900/40 text-rose-800 dark:text-rose-450 rounded-2xl text-xs font-bold flex items-start gap-2.5">
          <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-955/20 border border-emerald-150 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-450 rounded-2xl text-xs font-bold flex items-start gap-2.5">
          <ShieldCheck className="w-4.5 h-4.5 shrink-0 mt-0.5 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Users List Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-semibold flex flex-col items-center gap-2">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
            <span>Cargando miembros de la organización...</span>
          </div>
        ) : members.length === 0 ? (
          <div className="p-16 text-center text-slate-450 flex flex-col items-center gap-2">
            <Users className="w-12 h-12 text-slate-300" />
            <span className="font-bold">No se registran miembros en esta organización.</span>
            <p className="text-xs text-slate-400">Haga clic en "Agregar Usuario" para invitar a un colaborador.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800">
                  <th className="p-4">Usuario / Email</th>
                  <th className="p-4">Rol</th>
                  <th className="p-4">Área</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Fecha de Ingreso</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/30 transition-all">
                    <td className="p-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {member.full_name || 'Sin Nombre'}
                      </div>
                      <div className="text-slate-400 text-[10px] mt-0.5 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-300" />
                        {member.email || 'Sin Email'}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-955/35 text-indigo-700 dark:text-indigo-400 rounded-lg font-bold text-[10px] uppercase">
                        {member.role || 'editor'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-655 dark:text-slate-300 rounded font-medium text-[10px]">
                        {member.area || 'Sin Área'}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => toggleMemberActive(member)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-all border ${
                          member.active !== false
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/70'
                        }`}
                      >
                        {member.active !== false ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="p-4 text-slate-450 text-[11px]">
                      {member.created_at ? new Date(member.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(member)}
                        className="p-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 hover:text-indigo-650 text-slate-400 rounded-lg cursor-pointer transition-all"
                        title="Editar permisos y perfil"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-1.5 border border-slate-200 dark:border-slate-800 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-lg cursor-pointer transition-all"
                        title="Quitar acceso"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-500" />
                Agregar Nuevo Usuario
              </h3>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="p-5 space-y-5">
              
              {/* Form Warnings */}
              {formWarning && (
                <div className="p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-400 text-xs rounded-xl flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <span className="font-bold block">Aviso de Seguridad</span>
                    <p className="mt-0.5">{formWarning}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Correo Electrónico *</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="email@somosnoveli.com"
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rol de Sistema</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    {AVAILABLE_ROLES.map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Área Organizacional</label>
                  <select
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    {AVAILABLE_AREAS.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Permissions Checkbox Grid */}
              <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-indigo-500" />
                  Privilegios de Acceso por Módulo
                </h4>
                <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800">
                        <th className="p-2 w-1/3">Módulo</th>
                        {ACTIONS.map(act => (
                          <th key={act.id} className="p-2 text-center">{act.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                      {CRM_MODULES.map(mod => (
                        <tr key={mod.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20">
                          <td className="p-2 font-bold text-slate-655 dark:text-slate-300">{mod.label}</td>
                          {ACTIONS.map(act => (
                            <td key={act.id} className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handlePermChange(false, mod.id, act.id)}
                                className="inline-block p-1 text-slate-400 hover:text-indigo-650 cursor-pointer"
                              >
                                {newPermissions[mod.id]?.[act.id] ? (
                                  <CheckSquare className="w-4.5 h-4.5 text-indigo-600" />
                                ) : (
                                  <Square className="w-4.5 h-4.5" />
                                )}
                              </button>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  {submitting ? 'Guardando...' : 'Agregar Miembro'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-500" />
                Editar Perfil y Permisos
              </h3>
              <button 
                onClick={() => setShowEditModal(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditMember} className="p-5 space-y-5">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Correo Electrónico (No editable)</label>
                  <input
                    type="email"
                    disabled
                    value={selectedMember?.email || ''}
                    className="w-full p-2.5 border border-slate-250 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 rounded-xl text-xs text-slate-450 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rol de Sistema</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    {AVAILABLE_ROLES.map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Área Organizacional</label>
                  <select
                    value={editArea}
                    onChange={(e) => setEditArea(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    {AVAILABLE_AREAS.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Estado de Acceso</label>
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditActive(!editActive)}
                      className={`px-4 py-1.5 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        editActive 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-250 hover:bg-emerald-100/80' 
                          : 'bg-rose-50 text-rose-700 border-rose-250 hover:bg-rose-100/80'
                      }`}
                    >
                      {editActive ? 'Activo / Permitido' : 'Bloqueado / Inactivo'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Permissions Checkbox Grid */}
              <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-indigo-500" />
                  Privilegios de Acceso por Módulo
                </h4>
                <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800">
                        <th className="p-2 w-1/3">Módulo</th>
                        {ACTIONS.map(act => (
                          <th key={act.id} className="p-2 text-center">{act.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                      {CRM_MODULES.map(mod => (
                        <tr key={mod.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20">
                          <td className="p-2 font-bold text-slate-655 dark:text-slate-300">{mod.label}</td>
                          {ACTIONS.map(act => (
                            <td key={act.id} className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handlePermChange(true, mod.id, act.id)}
                                className="inline-block p-1 text-slate-400 hover:text-indigo-650 cursor-pointer"
                              >
                                {editPermissions[mod.id]?.[act.id] ? (
                                  <CheckSquare className="w-4.5 h-4.5 text-indigo-600" />
                                ) : (
                                  <Square className="w-4.5 h-4.5" />
                                )}
                              </button>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  {submitting ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
