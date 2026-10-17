export const DEFAULT_BRANDING = Object.freeze({
  editorial_name: 'Somos Noveli', logo_url: '', favicon_url: '/favicon.svg',
});

export const normalizeBranding = (item = {}) => ({
  editorial_name: item.editorial_name || DEFAULT_BRANDING.editorial_name,
  logo_url: item.logo_url || '',
  favicon_url: item.favicon_url || item.logo_url || DEFAULT_BRANDING.favicon_url,
});

// The caller must supply a membership resolved for this exact authenticated user.
// Never infer a private branding tenant from localStorage or a default UUID.
export const loadMemberBranding = async (userId, membership, fetchBranding) => {
  if (!userId || membership?.userId !== userId || !membership.organizationId)
    return DEFAULT_BRANDING;
  const { data, error } = await fetchBranding(membership.organizationId);
  if (error) throw error;
  return normalizeBranding(data?.[0]);
};
