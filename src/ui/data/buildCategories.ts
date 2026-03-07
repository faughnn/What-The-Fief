import type { BuildingType } from '../../world.js';

export type Category = 'housing' | 'production' | 'food' | 'military' | 'infrastructure' | 'decoration';

export const BUILD_CATEGORIES: { id: Category; label: string; types: BuildingType[] }[] = [
  {
    id: 'housing', label: 'Housing',
    types: ['tent', 'cottage', 'house', 'manor', 'barracks', 'inn'],
  },
  {
    id: 'food', label: 'Food',
    types: ['farm', 'large_farm', 'fishing_hut', 'foraging_hut', 'foraging_lodge', 'chicken_coop', 'livestock_barn', 'apiary', 'hunting_lodge', 'trappers_camp',
            'mill', 'windmill', 'bakery', 'kitchen', 'butchery', 'drying_rack', 'smoking_rack', 'compost_pile', 'food_cellar'],
  },
  {
    id: 'production', label: 'Production',
    types: ['woodcutter', 'forester', 'quarry', 'deep_quarry', 'stonemason', 'sawmill', 'lumber_mill',
            'herb_garden', 'flax_field', 'hemp_field', 'iron_mine',
            'smelter', 'advanced_smelter', 'coal_burner',
            'tanner', 'weaver', 'ropemaker', 'blacksmith', 'toolmaker', 'carpenter',
            'well', 'water_collector', 'mint'],
  },
  {
    id: 'military', label: 'Military',
    types: ['wall', 'fence', 'gate', 'reinforced_wall', 'watchtower',
            'weaponsmith', 'fletcher', 'armorer', 'leather_workshop',
            'training_ground', 'spike_trap', 'weapon_rack'],
  },
  {
    id: 'infrastructure', label: 'Infrastructure',
    types: ['storehouse', 'large_storehouse', 'outpost', 'road', 'town_hall',
            'marketplace', 'research_desk', 'library', 'apothecary',
            'tavern', 'church', 'graveyard'],
  },
  {
    id: 'decoration', label: 'Decoration',
    types: ['garden', 'fountain', 'statue'],
  },
];
