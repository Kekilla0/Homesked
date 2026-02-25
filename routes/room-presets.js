const express = require('express');
const { authenticate } = require('../middleware/auth');
const { PRESETS: EQUIP_PRESETS } = require('./presets');

const router = express.Router();
router.use(authenticate);

// Each room preset defines:
//   - icon, description
//   - defaultEquipment: array of { name, preset_type (matches equipment preset key or null), description }
//   - roomTasks: array of room-level tasks (cleaning etc.) to auto-create

const ROOM_PRESETS = {
  'Kitchen': {
    icon: '🍳',
    description: 'Cooking and food prep area',
    roomTasks: [
      { name: 'Deep clean oven',         description: 'Remove racks and clean interior with oven cleaner. Clean racks separately in sink.', frequency_value: 3,  frequency_unit: 'month' },
      { name: 'Clean range hood filter', description: 'Remove grease filters and wash in hot soapy water or dishwasher.', frequency_value: 1,  frequency_unit: 'month' },
      { name: 'Clean microwave',         description: 'Steam clean with bowl of water and lemon. Wipe turntable and interior.', frequency_value: 2,  frequency_unit: 'week'  },
      { name: 'Sanitize sink and drain', description: 'Scrub sink basin, clean drain strainer, pour baking soda + vinegar down drain.', frequency_value: 1,  frequency_unit: 'week'  },
      { name: 'Wipe down cabinet fronts',description: 'Wipe grease buildup from cabinet doors, especially near range.', frequency_value: 1,  frequency_unit: 'month' },
    ],
    defaultEquipment: [
      { name: 'Refrigerator',    preset_type: 'Refrigerator',    description: 'Main kitchen refrigerator' },
      { name: 'Dishwasher',      preset_type: 'Dishwasher',      description: '' },
      { name: 'Garbage Disposal',preset_type: 'Garbage Disposal',description: '' },
    ],
  },

  'Bathroom': {
    icon: '🚿',
    description: 'Full or half bathroom',
    roomTasks: [
      { name: 'Clean toilet',           description: 'Scrub bowl with toilet brush and cleaner. Wipe exterior, base, and behind.', frequency_value: 1, frequency_unit: 'week'  },
      { name: 'Scrub shower / tub',     description: 'Scrub tiles, grout, and fixtures. Clean drain strainer. Rinse thoroughly.', frequency_value: 2, frequency_unit: 'week'  },
      { name: 'Clean sink and mirror',  description: 'Wipe sink basin and faucet. Clean mirror with glass cleaner.', frequency_value: 1, frequency_unit: 'week'  },
      { name: 'Mop floor',              description: 'Sweep then mop bathroom floor including behind toilet.', frequency_value: 1, frequency_unit: 'week'  },
      { name: 'Re-caulk shower',        description: 'Inspect grout and caulk for cracks or mold. Re-caulk as needed.', frequency_value: 1, frequency_unit: 'year'  },
      { name: 'Clean exhaust fan',      description: 'Remove cover and vacuum dust from fan blades and grille.', frequency_value: 6, frequency_unit: 'month' },
    ],
    defaultEquipment: [
      { name: 'Exhaust Fan', preset_type: null, description: 'Bathroom ventilation fan' },
    ],
  },

  'Laundry Room': {
    icon: '🫧',
    description: 'Washer, dryer, utility area',
    roomTasks: [
      { name: 'Wipe down washer exterior', description: 'Wipe top, sides, and controls. Clean detergent drawer.', frequency_value: 1, frequency_unit: 'month' },
      { name: 'Clean dryer exterior',      description: 'Wipe exterior surfaces and clean around and behind unit.', frequency_value: 1, frequency_unit: 'month' },
      { name: 'Check behind units',        description: 'Pull out washer/dryer to check for moisture, lint buildup, or hose issues.', frequency_value: 1, frequency_unit: 'year'  },
    ],
    defaultEquipment: [
      { name: 'Washing Machine', preset_type: 'Washing Machine', description: '' },
      { name: 'Dryer',           preset_type: 'Dryer',           description: '' },
    ],
  },

  'Garage': {
    icon: '🏗️',
    description: 'Vehicle storage and workshop area',
    roomTasks: [
      { name: 'Sweep garage floor',     description: 'Sweep out dust, debris, and leaves. Check for oil stains.', frequency_value: 1, frequency_unit: 'month' },
      { name: 'Organise shelving',      description: 'Check storage organisation, dispose of hazmat items properly.', frequency_value: 6, frequency_unit: 'month' },
      { name: 'Inspect for pests',      description: 'Check corners, boxes, and wall edges for rodent or insect evidence.', frequency_value: 3, frequency_unit: 'month' },
    ],
    defaultEquipment: [
      { name: 'Garage Door Opener', preset_type: 'Garage Door Opener', description: '' },
      { name: 'Vehicle',            preset_type: 'Vehicle / Car',       description: 'Primary vehicle — update make/model/mileage after creation' },
    ],
  },

  'Basement': {
    icon: '🏚️',
    description: 'Mechanical room, storage, utility',
    roomTasks: [
      { name: 'Inspect for moisture',   description: 'Check walls, floor, and around windows for dampness or efflorescence.', frequency_value: 1, frequency_unit: 'month' },
      { name: 'Test GFCI outlets',      description: 'Press test and reset buttons on all GFCI outlets. Replace if faulty.', frequency_value: 1, frequency_unit: 'year'  },
      { name: 'Check sump pit level',   description: 'Visually inspect sump pit for debris and unusual water level.', frequency_value: 1, frequency_unit: 'month' },
    ],
    defaultEquipment: [
      { name: 'HVAC / Furnace',  preset_type: 'HVAC / Air Handler', description: 'Main heating and cooling system' },
      { name: 'Water Heater',    preset_type: 'Water Heater',        description: '' },
      { name: 'Sump Pump',       preset_type: 'Sump Pump',           description: '' },
    ],
  },

  'Living Room': {
    icon: '🛋️',
    description: 'Main living and entertainment area',
    roomTasks: [
      { name: 'Vacuum carpets / rugs',   description: 'Vacuum all floor coverings including under furniture.', frequency_value: 1, frequency_unit: 'week'  },
      { name: 'Dust surfaces',           description: 'Dust shelves, electronics, baseboards, and ceiling fans.', frequency_value: 2, frequency_unit: 'week'  },
      { name: 'Clean windows',           description: 'Clean interior window glass and wipe sills.', frequency_value: 3, frequency_unit: 'month' },
      { name: 'Deep clean upholstery',   description: 'Vacuum and spot-treat sofa and chairs. Use upholstery cleaner seasonally.', frequency_value: 6, frequency_unit: 'month' },
    ],
    defaultEquipment: [
      { name: 'Smoke Detector',    preset_type: 'Smoke / CO Detector', description: 'Living room smoke / CO detector' },
    ],
  },

  'Bedroom': {
    icon: '🛏️',
    description: 'Master or guest bedroom',
    roomTasks: [
      { name: 'Change bed linens',       description: 'Strip and wash all bed linens including pillowcases.', frequency_value: 1, frequency_unit: 'week'  },
      { name: 'Vacuum / mop floor',      description: 'Vacuum carpet or mop hard floors including under bed.', frequency_value: 1, frequency_unit: 'week'  },
      { name: 'Dust surfaces',           description: 'Dust nightstands, dressers, ceiling fan blades, and window sills.', frequency_value: 2, frequency_unit: 'week'  },
      { name: 'Rotate mattress',         description: 'Rotate mattress 180°. Flip if double-sided.', frequency_value: 6, frequency_unit: 'month' },
      { name: 'Wash pillows and duvet',  description: 'Machine wash pillows and duvet insert according to care label.', frequency_value: 6, frequency_unit: 'month' },
    ],
    defaultEquipment: [],
  },

  'Home Office': {
    icon: '💻',
    description: 'Workspace and study area',
    roomTasks: [
      { name: 'Dust electronics',        description: 'Dust monitor, keyboard, tower, and peripherals. Clean keyboard with compressed air.', frequency_value: 1, frequency_unit: 'month' },
      { name: 'Cable management check',  description: 'Inspect cables for fraying. Tidy cable runs.', frequency_value: 6, frequency_unit: 'month' },
      { name: 'Vacuum / clean floor',    description: 'Vacuum carpet or mop floor including under desk chair.', frequency_value: 1, frequency_unit: 'week'  },
    ],
    defaultEquipment: [],
  },

  'Outdoor / Yard': {
    icon: '🌿',
    description: 'Yard, garden, and outdoor equipment',
    roomTasks: [
      { name: 'Inspect gutters',         description: 'Check gutters and downspouts for debris, sagging, or leaks.', frequency_value: 6, frequency_unit: 'month' },
      { name: 'Clean gutters',           description: 'Remove debris from gutters. Flush with hose and check downspout flow.', frequency_value: 1, frequency_unit: 'year'  },
      { name: 'Check exterior caulk',    description: 'Inspect caulk around windows, doors, and trim. Re-caulk where cracked or missing.', frequency_value: 1, frequency_unit: 'year'  },
      { name: 'Inspect roof',            description: 'Visual check from ground for missing/damaged shingles, flashing, or ridge.', frequency_value: 1, frequency_unit: 'year'  },
      { name: 'Fertilize lawn',          description: 'Apply seasonal fertilizer per product instructions and grass type.', frequency_value: 3, frequency_unit: 'month' },
    ],
    defaultEquipment: [
      { name: 'Lawnmower', preset_type: 'Lawnmower', description: '' },
      { name: 'Generator', preset_type: 'Generator', description: 'Backup generator' },
    ],
  },

  'Pool / Hot Tub': {
    icon: '🏊',
    description: 'Swimming pool or spa area',
    roomTasks: [
      { name: 'Test water chemistry',    description: 'Test pH (7.2-7.6), chlorine (1-3ppm), alkalinity. Adjust as needed.', frequency_value: 2, frequency_unit: 'week'  },
      { name: 'Skim surface',            description: 'Remove leaves and debris from water surface with skimmer net.', frequency_value: 2, frequency_unit: 'week'  },
      { name: 'Vacuum pool floor',       description: 'Vacuum floor and walls. Brush tile line before vacuuming.', frequency_value: 1, frequency_unit: 'week'  },
      { name: 'Shock treatment',         description: 'Add pool shock per label. Run pump 8+ hrs. Do not swim for 24 hrs.', frequency_value: 2, frequency_unit: 'week'  },
      { name: 'Inspect safety equipment',description: 'Check life rings, rope and float line, drain covers, and gate latches.', frequency_value: 1, frequency_unit: 'month' },
    ],
    defaultEquipment: [
      { name: 'Pool Pump',          preset_type: 'Pool / Spa Pump', description: '' },
      { name: 'Smoke / CO Detector',preset_type: 'Smoke / CO Detector', description: 'Outdoor area detector if applicable' },
    ],
  },

  'Attic': {
    icon: '🏠',
    description: 'Attic storage and insulation space',
    roomTasks: [
      { name: 'Inspect insulation',      description: 'Check insulation depth and coverage. Look for gaps, settling, or moisture damage.', frequency_value: 1, frequency_unit: 'year'  },
      { name: 'Check ventilation',       description: 'Verify soffit and ridge vents are unobstructed.', frequency_value: 1, frequency_unit: 'year'  },
      { name: 'Inspect for pests',       description: 'Check for rodent droppings, chewed insulation, or nesting material.', frequency_value: 6, frequency_unit: 'month' },
      { name: 'Check roof deck',         description: 'Look for water staining, daylight through roof, or soft spots on deck boards.', frequency_value: 1, frequency_unit: 'year'  },
    ],
    defaultEquipment: [],
  },
};

// GET /api/room-presets
router.get('/', (req, res) => {
  const list = Object.entries(ROOM_PRESETS).map(([name, data]) => ({
    name,
    icon: data.icon,
    description: data.description,
    room_task_count: data.roomTasks.length,
    equipment_count: data.defaultEquipment.length,
  }));
  res.json(list);
});

// GET /api/room-presets/:name
router.get('/:name', (req, res) => {
  const preset = ROOM_PRESETS[req.params.name];
  if (!preset) return res.status(404).json({ error: 'Preset not found' });

  // Attach equipment tasks from the equipment presets
  const enriched = preset.defaultEquipment.map(eq => {
    const equipPreset = eq.preset_type ? EQUIP_PRESETS[eq.preset_type] : null;
    return {
      ...eq,
      usage_unit: equipPreset?.usage_unit || null,
      tasks: equipPreset?.tasks || [],
    };
  });

  res.json({ name: req.params.name, ...preset, defaultEquipment: enriched });
});

module.exports = { router, ROOM_PRESETS };
