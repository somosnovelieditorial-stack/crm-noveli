import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isMock } from '../supabaseClient';

export const NEW_WEBSITE_LEAD_STATUSES = ['nuevo', 'nueva'];

export const normalizeWebsiteLeadStatus = (status) => String(status || 'nuevo').toLowerCase().trim();

export const isNewWebsiteLead = (lead) => {
  if (!lead) return false;
  const status = normalizeWebsiteLeadStatus(lead.status);
  const isTest = lead.is_test === true || lead.is_test === 'true' || lead.is_test === 1 || lead.is_test === '1';
  return NEW_WEBSITE_LEAD_STATUSES.includes(status) && lead.active !== false && !isTest;
};

const logWebsiteLeadNotificationError = async (error) => {
  try {
    await supabase.from('crm_error_logs').insert({
      error_message: error.message,
      error_stack: error.stack || '',
      module: 'website-lead-notifications',
      created_at: new Date().toISOString()
    });
  } catch (logErr) {
    console.error('Failed to log website lead notification error:', logErr);
  }
};

export default function useWebsiteLeadNotifications(organizationId, options = {}) {
  const { realtime = true, onNewLead } = options;
  const [recentNewWebsiteLeads, setRecentNewWebsiteLeads] = useState([]);
  const [loadingWebsiteLeadNotifications, setLoadingWebsiteLeadNotifications] = useState(false);

  const refreshWebsiteLeadNotifications = useCallback(async () => {
    if (!organizationId) return [];
    setLoadingWebsiteLeadNotifications(true);
    try {
      if (isMock) {
        const db = JSON.parse(localStorage.getItem('somos_noveli_crm_db') || '{}');
        const leads = (db.website_leads || [])
          .filter((lead) => lead.organization_id === organizationId || !lead.organization_id)
          .filter(isNewWebsiteLead)
          .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        setRecentNewWebsiteLeads(leads);
        return leads;
      }

      const { data, error } = await supabase
        .from('website_leads')
        .select('*')
        .eq('organization_id', organizationId)
        .in('status', NEW_WEBSITE_LEAD_STATUSES)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const leads = (data || []).filter(isNewWebsiteLead);
      setRecentNewWebsiteLeads(leads);
      return leads;
    } catch (error) {
      console.error('Error loading website lead notifications:', error);
      await logWebsiteLeadNotificationError(error);
      setRecentNewWebsiteLeads([]);
      return [];
    } finally {
      setLoadingWebsiteLeadNotifications(false);
    }
  }, [organizationId]);

  useEffect(() => {
    refreshWebsiteLeadNotifications();
  }, [refreshWebsiteLeadNotifications]);

  useEffect(() => {
    if (!realtime || !organizationId || isMock || !supabase?.channel) return undefined;

    const channel = supabase
      .channel(`website-lead-notifications-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'website_leads',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          refreshWebsiteLeadNotifications();
          if (payload.eventType === 'INSERT' && isNewWebsiteLead(payload.new) && onNewLead) {
            onNewLead(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, onNewLead, realtime, refreshWebsiteLeadNotifications]);

  const newWebsiteLeadsCount = useMemo(() => recentNewWebsiteLeads.length, [recentNewWebsiteLeads]);

  return {
    newWebsiteLeadsCount,
    recentNewWebsiteLeads,
    refreshWebsiteLeadNotifications,
    loadingWebsiteLeadNotifications
  };
}
