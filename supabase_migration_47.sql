-- Migration 47: Allow public read access to website_settings
DROP POLICY IF EXISTS "Allow public read website_settings" ON website_settings;
CREATE POLICY "Allow public read website_settings" ON website_settings FOR SELECT USING (true);
