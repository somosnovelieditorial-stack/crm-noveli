// Signed URLs are bearer credentials: generate on demand, never persist them.
export const DOCUMENT_URL_TTL = 300;

export const getDocumentPath = (value) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Falta la ruta del documento.');
  let path = value.trim();
  if (/^https?:\/\//i.test(path)) {
    const url = new URL(path);
    const marker = /^\/storage\/v1\/object\/(?:public|sign|authenticated)\/documents\/(.+)$/;
    const match = url.pathname.match(marker);
    if (!match) throw new Error('La URL no pertenece al bucket documents.');
    path = decodeURIComponent(match[1]);
  } else if (path.startsWith('mock://documents/')) {
    path = path.slice('mock://documents/'.length);
  }
  if (path.startsWith('/') || path.includes('://') || path.includes('//') ||
      path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Ruta de documento inválida.');
  }
  return path;
};

export const createDocumentUrl = async (storage, doc) => {
  const path = getDocumentPath(doc.file_path || doc.file_url);
  const { data, error } = await storage.from('documents').createSignedUrl(path, DOCUMENT_URL_TTL);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('No se pudo autorizar el acceso al documento.');
  return data.signedUrl;
};

export const openPrivateDocument = async (storage, doc) => {
  // Open synchronously to preserve the browser's user-gesture/popup permission.
  const popup = window.open('about:blank', '_blank');
  if (popup) popup.opener = null;
  try {
    const url = await createDocumentUrl(storage, doc);
    if (popup) popup.location.replace(url);
    else window.location.assign(url);
  } catch {
    popup?.close();
    window.alert('No se pudo acceder al documento. Comprueba tu sesión y permisos.');
  }
};
