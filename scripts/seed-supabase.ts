/**
 * Seeds menu_items from src/data/seed.ts into Supabase.
 * Run: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-supabase.ts
 */
import { createClient } from '@supabase/supabase-js';
import { seedMenuItems } from '../src/data/seed';

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const rows = seedMenuItems.map((item) => ({
    id: item.id,
    category_id: item.categoryId,
    name: item.name,
    description: item.description,
    price_som: item.priceSom,
    image_url: item.imageUrl,
    allergens: item.allergens,
    modifiers: item.modifiers,
    upsell_tags: item.upsellTags,
    is_available: item.isAvailable,
    sort_order: item.sortOrder,
  }));

  const { error } = await supabase.from('menu_items').upsert(rows);
  if (error) throw error;
  console.log(`Seeded ${rows.length} menu items.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
