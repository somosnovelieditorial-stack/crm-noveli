import { canRolePerformAction, canDeleteEntity } from './roles.js';

export const mutationPermissions = (role, module, table, isReadOnly = false) => {
  const write = !isReadOnly && canRolePerformAction(role, module, 'write');
  return { write, delete: write && canDeleteEntity(role, table) };
};

export const insertClientRecord = async (client, payload) => {
  const { data, error } = await client.from('clients').insert(payload).select('*').single();
  if (error) throw error;
  const record = Array.isArray(data) ? data[0] : data;
  if (!record?.id) throw new Error('No se pudo crear el cliente ni obtener su ID');
  return record;
};

// 200 with zero affected rows is not confirmation of deletion under RLS.
// UI state is changed by the caller only after this promise resolves.
export const deleteDocumentConfirmed = async (client, doc, mock = false) => {
  if (!mock) {
    const { data, error } = await client.storage.from('documents').remove([doc.file_path]);
    if (error) throw error;
    if (!Array.isArray(data) || !data.some(object => object.name === doc.file_path))
      throw new Error('No se pudo eliminar el archivo. Comprueba tus permisos y vuelve a cargar la lista.');
  }
  const { data, error } = await client.from('documents').delete().eq('id', doc.id).select('id');
  if (error) throw error;
  if (!Array.isArray(data) || !data.some(row => row.id === doc.id))
    throw new Error('No se pudo eliminar el registro del documento. Comprueba tus permisos y vuelve a cargar la lista.');
  return doc.id;
};
