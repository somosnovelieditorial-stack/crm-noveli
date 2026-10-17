// These rows are scoped through parent relations/RLS, not an organization column.
const withoutDirectTenant = new Set([
  'organizations', 'user_profiles', 'organization_members', 'website_book_category_links',
]);
export const hasDirectTenant = table => !withoutDirectTenant.has(table);
const withoutActorColumn = new Set([
  'website_book_categories', 'website_book_category_links', 'website_exchange_rates',
  'website_footer_gallery', 'website_footer_settings', 'website_hero_quick_services',
  'website_hero_settings', 'website_leads',
]);
export const hasActorColumn = table => !withoutActorColumn.has(table);

export const fetchBookCategoryLinks = async client => {
  const { data, error } = await client.from('website_book_category_links').select('id,book_id,category_id');
  if (error) throw error;
  return data || [];
};

export const replaceBookCategoryLinks = async (client, bookId, categoryIds) => {
  const { error } = await client.from('website_book_category_links').delete().eq('book_id', bookId);
  if (error) throw error;
  if (categoryIds.length) {
    const { error: insertError } = await client.from('website_book_category_links')
      .insert([...new Set(categoryIds)].map(categoryId => ({ book_id: bookId, category_id: categoryId })));
    if (insertError) throw insertError;
  }
};

export const optionalExchangeRate = async (client, orgId, currency, fallback, date) => {
  if (currency === 'CLP') return 1;
  const { data, error } = await client.from('exchange_rates').select('rate')
    .eq('organization_id', orgId).eq('currency_from', currency).eq('date', date)
    .limit(1).maybeSingle();
  if (error) throw error;
  return data ? Number(data.rate) : fallback;
};
