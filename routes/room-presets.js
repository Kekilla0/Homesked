const express = require('express');
const { authenticate } = require('../middleware/auth');
const { PRESETS: EQUIP_PRESETS } = require('./presets');

const router = express.Router();
router.use(authenticate);

const ROOM_PRESETS = {
  'Kitchen': {
    icon: '🍳',
    description: 'Cooking and food prep area',
    roomTasks: [
      { name: 'Clean kitchen',           description: 'General clean: wipe counters, stovetop, sink, and appliance exteriors. Sweep and mop floor.', frequency_value: 1, frequency_unit: 'week'  },
      { name: 'Clean range hood filter', description: 'Remove grease filters and wash in hot soapy water or dishwasher.',                             frequency_value: 1, frequency_unit: 'month' },
      { name: 'Sanitize sink and drain', description: 'Scrub sink basin, clean drain strainer, pour baking soda + vinegar down drain.',               frequency_value: 1, frequency_unit: 'week'  },
      { name: 'Wipe down cabinet fronts',description: 'Wipe grease buildup from cabinet doors, especially near range.',                               frequency_value: 1, frequency_unit: 'month' },
      { name: 'Clean inside refrigerator',description: 'Remove shelves and bins, wash with warm soapy water, wipe interior. Discard expired items.',  frequency_value: 3, frequency_unit: 'month' },
    ],
    defaultEquipment: [
      { name: 'Refrigerator',     preset_type: 'Refrigerator',     description: 'Main kitchen refrigerator' },
      { name: 'Oven',             preset_type: 'Oven',             description: 'Kitchen oven and range' },
      { name: 'Microwave',        preset_type: 'Microwave',        description: '' },
      { name: 'Dishwasher',       preset_type: 'Dishwasher',       description: '' },
      { name: 'Garbage Disposal', preset_type: 'Garbage Disposal', description: '' },
    ],
  },

  'Bathroom': {
    icon: '🚿',
    description: 'Full or half bathroom',
    roomTasks: [
      { name: 'Clean bathroom',      description: 'Full clean: toilet, sink, mirror, shower/tub, and floor. Restock supplies.',              frequency_value: 1, frequency_unit: 'week'  },
      { name: 'Scrub shower / tub',  description: 'Scrub tiles, grout, and fixtures with bathroom cleaner. Clean drain strainer.',          frequency_value: 2, frequency_unit: 'week'  },
      { name: 'Mop floor',           description: 'Sweep then mop bathroom floor including behind toilet and under vanity.',                 frequency_value: 1, frequency_unit: 'week'  },
      { name: 'Re-caulk shower',     description: 'Inspect grout and caulk for cracks or mold. Re-caulk as needed.',                        frequency_value: 1, frequency_unit: 'year'  },
    ],
    defaultEquipment: [
      { name: 'Exhaust Fan', preset_type: 'Exhaust Fan', description: 'Bathroom ventilation fan' },
    ],
  },

  'Laundry Room': {
    icon: '🫧',
    description: 'Washer, dryer, utility area',
    roomTasks: [
      { name: 'Clean laundry room',        description: 'Wipe down surfaces, sweep floor, clear lint and detergent spills.',                    frequency_value: 1, frequency_unit: 'week'  },
      { name: 'Wipe down appliance tops',  description: 'Wipe top, sides, and controls of washer and dryer. Clean detergent drawer.',          frequency_value: 1, frequency_unit: 'month' },
      { name: 'Check behind units',        description: 'Pull out washer/dryer to check for moisture, lint buildup, or hose issues.',           frequency_value: 1, frequency_unit: 'year'  },
    ],
    defaultEquipment: [
      { name: 'Washing Machine', preset_type: 'Washing Machine', description: '' },
      { name: 'Dryer',           preset_type: 'Dryer',           description: '' },
    ],
  },

  'Garage / Car Port': {
    icon: '🏗️',
    description: 'Vehicle storage and workshop area',
    roomTasks: [
      { name: 'Sweep garage floor',  description: 'Sweep out dust, debris, and leaves. Check for oil stains and treat with degreaser.', frequency_value: 1, frequency_unit: 'month' },
      { name: 'Organise shelving',   description: 'Check storage organisation, dispose of hazmat items properly.',                      frequency_value: 6, frequency_unit: 'month' },
      { name: 'Inspect for pests',   description: 'Check corners, boxes, and wall edges for rodent or insect evidence.',                frequency_value: 3, frequency_unit: 'month' },
      { name: 'Check oil spots',     description: 'Inspect floor for new oil leaks from vehicles. Note location to diagnose source.',   frequency_value: 1, frequency_unit: 'month' },
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
      { name: 'Inspect for moisture', description: 'Check walls, floor, and around windows for dampness or efflorescence.', frequency_value: 1, frequency_unit: 'month' },
      { name: 'Test GFCI outlets',    description: 'Press test and reset buttons on all GFCI outlets. Replace if faulty.',  frequency_value: 1, frequency_unit: 'year'  },
      { name: 'Check sump pit level', description: 'Visually inspect sump pit for debris and unusual water level.',         frequency_value: 1, frequency_unit: 'month' },
    ],
    defaultEquipment: [
      { name: 'HVAC / Furnace', preset_type: 'HVAC / Air Handler', description: 'Main heating and cooling system' },
      { name: 'Water Heater',   preset_type: 'Water Heater',       description: '' },
      { name: 'Sump Pump',      preset_type: 'Sump Pump',          description: '' },
    ],
  },

  'Living Room': {
    icon: '🛋️',
    description: 'Main living and entertainment area',
    roomTasks: [
      { name: 'Clean living room',       description: 'Vacuum, dust surfaces, wipe electronics, clean windows and sills.',                          frequency_value: 1, frequency_unit: 'week'  },
      { name: 'Vacuum carpets / rugs',   description: 'Vacuum all floor coverings including edges and under furniture.',                            frequency_value: 1, frequency_unit: 'week'  },
      { name: 'Deep clean upholstery',   description: 'Vacuum and spot-treat sofa and chairs. Use upholstery cleaner seasonally.',                  frequency_value: 6, frequency_unit: 'month' },
    ],
    defaultEquipment: [
      { name: 'Smoke / CO Detector', preset_type: 'Smoke / CO Detector', description: 'Living room smoke / CO detector' },
    ],
  },

  'Bedroom': {
    icon: '🛏️',
    description: 'Master or guest bedroom',
    roomTasks: [
      { name: 'Clean bedroom',           description: 'Vacuum or mop floor, dust surfaces, wipe mirrors.',                                         frequency_value: 1, frequency_unit: 'week'  },
      { name: 'Change bed linens',       description: 'Strip and wash all bed linens including pillowcases.',                                       frequency_value: 1, frequency_unit: 'week'  },
      { name: 'Rotate mattress',         description: 'Rotate mattress 180°. Flip if double-sided.',                                               frequency_value: 6, frequency_unit: 'month' },
      { name: 'Wash pillows and duvet',  description: 'Machine wash pillows and duvet insert according to care label.',                            frequency_value: 6, frequency_unit: 'month' },
    ],
    defaultEquipment: [],
  },

  'Home Office': {
    icon: '💻',
    description: 'Workspace and study area',
    roomTasks: [
      { name: 'Clean office',           description: 'Vacuum floor, dust desk and shelves, wipe monitor, clean keyboard with compressed air.',      frequency_value: 1, frequency_unit: 'week'  },
      { name: 'Dust electronics',       description: 'Detailed dusting of monitor, tower, peripherals and cable runs.',                            frequency_value: 1, frequency_unit: 'month' },
      { name: 'Cable management check', description: 'Inspect cables for fraying. Tidy cable runs.',                                               frequency_value: 6, frequency_unit: 'month' },
    ],
    defaultEquipment: [],
  },

  'Outdoor / Yard': {
    icon: '🌿',
    description: 'Yard, garden, and outdoor equipment',
    roomTasks: [
      { name: 'Inspect gutters',    description: 'Check gutters and downspouts for debris, sagging, or leaks.',                                    frequency_value: 6, frequency_unit: 'month' },
      { name: 'Clean gutters',      description: 'Remove debris from gutters. Flush with hose and check downspout flow.',                          frequency_value: 1, frequency_unit: 'year'  },
      { name: 'Check exterior caulk',description:'Inspect caulk around windows, doors, and trim. Re-caulk where cracked or missing.',             frequency_value: 1, frequency_unit: 'year'  },
      { name: 'Inspect roof',       description: 'Visual check from ground for missing/damaged shingles, flashing, or ridge.',                     frequency_value: 1, frequency_unit: 'year'  },
      { name: 'Fertilize lawn',     description: 'Apply seasonal fertilizer per product instructions and grass type.',                             frequency_value: 3, frequency_unit: 'month' },
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
      { name: 'Test water chemistry',    description: 'Test pH (7.2-7.6), chlorine (1-3ppm), alkalinity. Adjust as needed.',               frequency_value: 2, frequency_unit: 'week'  },
      { name: 'Skim surface',            description: 'Remove leaves and debris from water surface with skimmer net.',                     frequency_value: 2, frequency_unit: 'week'  },
      { name: 'Vacuum pool floor',       description: 'Vacuum floor and walls. Brush tile line before vacuuming.',                         frequency_value: 1, frequency_unit: 'week'  },
      { name: 'Shock treatment',         description: 'Add pool shock per label. Run pump 8+ hrs. Do not swim for 24 hrs.',                frequency_value: 2, frequency_unit: 'week'  },
      { name: 'Inspect safety equipment',description: 'Check life rings, rope, drain covers, and gate latches.',                          frequency_value: 1, frequency_unit: 'month' },
    ],
    defaultEquipment: [
      { name: 'Pool Pump', preset_type: 'Pool / Spa Pump', description: '' },
    ],
  },

  'Attic': {
    icon: '🔺',
    description: 'Attic storage and insulation space',
    roomTasks: [
      { name: 'Inspect insulation', description: 'Check insulation depth and coverage. Look for gaps, settling, or moisture damage.', frequency_value: 1, frequency_unit: 'year'  },
      { name: 'Check ventilation',  description: 'Verify soffit and ridge vents are unobstructed.',                                    frequency_value: 1, frequency_unit: 'year'  },
      { name: 'Inspect for pests',  description: 'Check for rodent droppings, chewed insulation, or nesting material.',               frequency_value: 6, frequency_unit: 'month' },
      { name: 'Check roof deck',    description: 'Look for water staining, daylight through roof, or soft spots on deck boards.',      frequency_value: 1, frequency_unit: 'year'  },
    ],
    defaultEquipment: [],
  },
};

router.get('/', (req, res) => {
  const list = Object.entries(ROOM_PRESETS).map(([name, data]) => ({
    name, icon: data.icon, description: data.description,
    room_task_count: data.roomTasks.length,
    equipment_count: data.defaultEquipment.length,
  }));
  res.json(list);
});

router.get('/:name', (req, res) => {
  const preset = ROOM_PRESETS[decodeURIComponent(req.params.name)];
  if (!preset) return res.status(404).json({ error: 'Preset not found' });

  const enriched = preset.defaultEquipment.map(eq => {
    const ep = eq.preset_type ? EQUIP_PRESETS[eq.preset_type] : null;
    return { ...eq, usage_unit: ep?.usage_unit || null, tasks: ep?.tasks || [] };
  });

  res.json({ name: req.params.name, ...preset, defaultEquipment: enriched });
});

module.exports = { router, ROOM_PRESETS };
