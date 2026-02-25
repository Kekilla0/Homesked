const express = require('express');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

const PRESETS = {
  'HVAC / Air Handler': {
    icon: '❄️', usage_unit: null,
    tasks: [
      { name: 'Replace air filter',          description: 'Replace with correct MERV rating filter. Check filter size printed on old filter frame.', trigger_type: 'time', frequency_value: 3, frequency_unit: 'month' },
      { name: 'Clean condensate drain line', description: 'Pour 1 cup of white vinegar into drain line access point. Flush with water after 30 min.',  trigger_type: 'time', frequency_value: 6, frequency_unit: 'month' },
      { name: 'Annual HVAC inspection',      description: 'Schedule professional tune-up. Check refrigerant, coils, electrical, belts.',               trigger_type: 'time', frequency_value: 1, frequency_unit: 'year'  },
      { name: 'Clean evaporator coils',      description: 'Use no-rinse coil cleaner spray. Inspect for ice buildup.',                                  trigger_type: 'time', frequency_value: 1, frequency_unit: 'year'  },
    ]
  },
  'Water Heater': {
    icon: '🔥', usage_unit: null,
    tasks: [
      { name: 'Flush sediment',             description: 'Attach hose to drain valve and flush 1-2 gallons until water runs clear.',                    trigger_type: 'time', frequency_value: 1, frequency_unit: 'year' },
      { name: 'Test pressure relief valve', description: 'Lift lever briefly to verify valve opens and water flows. Replace if valve drips after test.', trigger_type: 'time', frequency_value: 1, frequency_unit: 'year' },
      { name: 'Inspect anode rod',          description: 'Check sacrificial anode rod — replace if less than 1/2 inch thick or heavily corroded.',      trigger_type: 'time', frequency_value: 3, frequency_unit: 'year' },
    ]
  },
  'Refrigerator': {
    icon: '🧊', usage_unit: null,
    tasks: [
      { name: 'Clean condenser coils', description: 'Vacuum or brush coils at rear or beneath unit. Dusty coils increase energy use.',             trigger_type: 'time', frequency_value: 6, frequency_unit: 'month' },
      { name: 'Replace water filter', description: 'Replace in-door or in-line water filter. Check model for correct part number.',               trigger_type: 'time', frequency_value: 6, frequency_unit: 'month' },
      { name: 'Clean door gaskets',   description: 'Wipe with warm soapy water. Test seal by closing door on a dollar bill — should resist pull.', trigger_type: 'time', frequency_value: 1, frequency_unit: 'year'  },
    ]
  },
  'Oven': {
    icon: '🔆', usage_unit: null,
    tasks: [
      { name: 'Deep clean oven',       description: 'Remove racks and clean interior with oven cleaner or run self-clean cycle. Clean racks separately in sink.', trigger_type: 'time', frequency_value: 3, frequency_unit: 'month' },
      { name: 'Clean oven racks',      description: 'Soak racks in hot soapy water, scrub with non-scratch pad, rinse and dry before replacing.',             trigger_type: 'time', frequency_value: 3, frequency_unit: 'month' },
      { name: 'Clean burners / range', description: 'Remove and clean stovetop grates/burner caps. Wipe down range surface and control knobs.',               trigger_type: 'time', frequency_value: 1, frequency_unit: 'month' },
      { name: 'Clean range hood',      description: 'Remove grease filters and wash in hot soapy water or dishwasher. Wipe down hood exterior.',               trigger_type: 'time', frequency_value: 1, frequency_unit: 'month' },
      { name: 'Annual calibration check', description: 'Verify oven temperature with an oven thermometer. Adjust calibration offset if needed.',              trigger_type: 'time', frequency_value: 1, frequency_unit: 'year'  },
    ]
  },
  'Microwave': {
    icon: '📡', usage_unit: null,
    tasks: [
      { name: 'Clean microwave interior', description: 'Steam clean with bowl of water and lemon for 3 min. Wipe down interior, turntable, and door seal.', trigger_type: 'time', frequency_value: 2, frequency_unit: 'week'  },
      { name: 'Clean exterior and vents', description: 'Wipe down exterior surfaces and clean vent grilles of grease or dust buildup.',                     trigger_type: 'time', frequency_value: 1, frequency_unit: 'month' },
    ]
  },
  'Dishwasher': {
    icon: '🫧', usage_unit: null,
    tasks: [
      { name: 'Clean filter',        description: 'Remove and rinse mesh filter under warm water. Scrub with soft brush if clogged.', trigger_type: 'time', frequency_value: 1, frequency_unit: 'month' },
      { name: 'Run cleaning cycle',  description: 'Place dishwasher cleaning tablet or 1 cup white vinegar in bottom. Run hot cycle empty.', trigger_type: 'time', frequency_value: 1, frequency_unit: 'month' },
      { name: 'Inspect door gasket', description: 'Check for cracks or buildup. Wipe clean. Replace if cracked.', trigger_type: 'time', frequency_value: 1, frequency_unit: 'year'  },
    ]
  },
  'Washing Machine': {
    icon: '🫧', usage_unit: null,
    tasks: [
      { name: 'Clean drum',                  description: 'Run clean cycle with washer cleaner tablet. Wipe door seal after every use to prevent mold.', trigger_type: 'time', frequency_value: 1, frequency_unit: 'month' },
      { name: 'Inspect water supply hoses',  description: 'Check for bulges, cracks, or slow drips. Replace rubber hoses every 5 years regardless.',     trigger_type: 'time', frequency_value: 1, frequency_unit: 'year'  },
      { name: 'Clean lint filter / pump trap',description:'Check pump filter (front-load: behind access panel). Remove and rinse debris.',               trigger_type: 'time', frequency_value: 3, frequency_unit: 'month' },
    ]
  },
  'Dryer': {
    icon: '🌀', usage_unit: null,
    tasks: [
      { name: 'Clean lint trap',    description: 'Clean after every load. Wash screen monthly with dish soap to remove detergent film.', trigger_type: 'time', frequency_value: 1, frequency_unit: 'month' },
      { name: 'Clean exhaust duct', description: 'Disconnect and vacuum full duct length. Clogged ducts are a fire hazard.',            trigger_type: 'time', frequency_value: 1, frequency_unit: 'year'  },
    ]
  },
  'Garbage Disposal': {
    icon: '🗑️', usage_unit: null,
    tasks: [
      { name: 'Deep clean disposal', description: 'Grind ice cubes with rock salt. Follow with citrus peels. Flush with hot water.', trigger_type: 'time', frequency_value: 1, frequency_unit: 'month' },
    ]
  },
  'Smoke / CO Detector': {
    icon: '🔔', usage_unit: null,
    tasks: [
      { name: 'Test alarm',       description: 'Press test button, hold until alarm sounds. Verify audible in all rooms.',                                    trigger_type: 'time', frequency_value: 1, frequency_unit: 'month' },
      { name: 'Replace batteries',description: 'Replace even if no low-battery chirp. Use alkaline batteries only.',                                          trigger_type: 'time', frequency_value: 1, frequency_unit: 'year'  },
      { name: 'Replace unit',     description: 'Smoke detectors expire after 10 years, CO after 5-7 years. Check manufacture date on back.',                 trigger_type: 'time', frequency_value: 7, frequency_unit: 'year'  },
    ]
  },
  'Fire Extinguisher': {
    icon: '🧯', usage_unit: null,
    tasks: [
      { name: 'Visual inspection',     description: 'Check pressure gauge is in green zone. Check pin and tamper seal intact. No dents or corrosion.', trigger_type: 'time', frequency_value: 1, frequency_unit: 'month' },
      { name: 'Professional inspection',description: 'Have certified technician perform annual inspection and re-tag.',                                  trigger_type: 'time', frequency_value: 1, frequency_unit: 'year'  },
    ]
  },
  'Exhaust Fan': {
    icon: '💨', usage_unit: null,
    tasks: [
      { name: 'Clean exhaust fan',   description: 'Remove cover and vacuum dust from fan blades and grille. Wipe cover before replacing.',          trigger_type: 'time', frequency_value: 6, frequency_unit: 'month' },
      { name: 'Test fan operation',  description: 'Verify fan turns on and moves adequate air. Listen for unusual noise or vibration.',              trigger_type: 'time', frequency_value: 1, frequency_unit: 'year'  },
    ]
  },
  'Vehicle / Car': {
    icon: '🚗', usage_unit: 'miles',
    tasks: [
      { name: 'Oil change',              description: 'Conventional oil every 5,000 mi, synthetic every 7,500-10,000 mi. Check owner manual.',   trigger_type: 'usage', usage_interval: 5000,  usage_unit: 'miles' },
      { name: 'Tire rotation',           description: 'Rotate tires in recommended pattern. Inspect tread depth and pressure.',                   trigger_type: 'usage', usage_interval: 7500,  usage_unit: 'miles' },
      { name: 'Air filter replacement',  description: 'Inspect engine air filter. Replace if grey/black or clogged.',                             trigger_type: 'usage', usage_interval: 15000, usage_unit: 'miles' },
      { name: 'Cabin air filter',        description: 'Replace cabin air filter — usually behind glove box.',                                     trigger_type: 'usage', usage_interval: 15000, usage_unit: 'miles' },
      { name: 'Brake inspection',        description: 'Inspect brake pad thickness and rotor condition. Replace pads at 2-3mm.',                  trigger_type: 'usage', usage_interval: 25000, usage_unit: 'miles' },
      { name: 'Transmission fluid',      description: 'Check and top up. Full flush per manufacturer interval (often 30-60k miles).',             trigger_type: 'usage', usage_interval: 30000, usage_unit: 'miles' },
      { name: 'Annual inspection / tags',description: 'State safety and emissions inspection. Renew registration.',                               trigger_type: 'time',  frequency_value: 1,    frequency_unit: 'year'  },
    ]
  },
  'Lawnmower': {
    icon: '🌿', usage_unit: 'hours',
    tasks: [
      { name: 'Change oil',              description: 'Drain and replace with SAE 30. First change at 5 hrs, then every 50 hrs.',     trigger_type: 'usage', usage_interval: 50, usage_unit: 'hours' },
      { name: 'Replace air filter',      description: 'Remove, tap out debris, replace foam pre-filter. Replace paper element annually.', trigger_type: 'usage', usage_interval: 25, usage_unit: 'hours' },
      { name: 'Sharpen / replace blade', description: 'Disconnect spark plug wire before working under deck. Sharpen until no nicks.', trigger_type: 'time',  frequency_value: 1, frequency_unit: 'year' },
      { name: 'Replace spark plug',      description: 'Check gap with feeler gauge per manual. Replace if electrode worn.',            trigger_type: 'time',  frequency_value: 1, frequency_unit: 'year' },
      { name: 'Drain fuel for storage',  description: 'At end of season, run engine dry or add fuel stabilizer. Clean deck.',         trigger_type: 'time',  frequency_value: 1, frequency_unit: 'year' },
    ]
  },
  'Generator': {
    icon: '⚡', usage_unit: 'hours',
    tasks: [
      { name: 'Test run',          description: 'Run under load for 30 minutes monthly to condition engine and battery.', trigger_type: 'time',  frequency_value: 1,   frequency_unit: 'month' },
      { name: 'Oil change',        description: 'Change oil after first 8 hours on new unit, then every 100 hours or annually.', trigger_type: 'usage', usage_interval: 100, usage_unit: 'hours' },
      { name: 'Replace spark plug',description: 'Inspect and replace spark plug annually or per hours in manual.', trigger_type: 'time',  frequency_value: 1,   frequency_unit: 'year'  },
    ]
  },
  'Pool / Spa Pump': {
    icon: '🏊', usage_unit: null,
    tasks: [
      { name: 'Clean pump basket',           description: 'Turn off pump, remove basket, clear debris. Check O-ring and re-seal.', trigger_type: 'time', frequency_value: 2, frequency_unit: 'week'  },
      { name: 'Backwash / clean filter',     description: 'Sand filter: backwash when PSI rises 8-10 above baseline. Cartridge: rinse monthly.', trigger_type: 'time', frequency_value: 1, frequency_unit: 'month' },
      { name: 'Inspect pump seals / bearings',description:'Listen for grinding. Check for water leaks around seal plate.', trigger_type: 'time', frequency_value: 1, frequency_unit: 'year'  },
    ]
  },
  'Sump Pump': {
    icon: '💧', usage_unit: null,
    tasks: [
      { name: 'Test sump pump',       description: 'Pour water into pit to trigger float switch. Confirm pump activates and drains.', trigger_type: 'time', frequency_value: 3, frequency_unit: 'month' },
      { name: 'Clean pit and screen', description: 'Remove pump, clean pit of debris and sediment. Rinse inlet screen.',             trigger_type: 'time', frequency_value: 1, frequency_unit: 'year'  },
    ]
  },
  'Garage Door Opener': {
    icon: '🚪', usage_unit: null,
    tasks: [
      { name: 'Lubricate moving parts',   description: 'Apply garage door lubricant (not WD-40) to hinges, rollers, springs, and rail.', trigger_type: 'time', frequency_value: 6, frequency_unit: 'month' },
      { name: 'Test auto-reverse safety', description: 'Place a 2x4 flat on the floor under the door. Door must reverse on contact.',    trigger_type: 'time', frequency_value: 1, frequency_unit: 'month' },
      { name: 'Replace batteries',        description: 'Replace remote and wall keypad batteries.',                                       trigger_type: 'time', frequency_value: 2, frequency_unit: 'year'  },
    ]
  },
};

router.get('/', (req, res) => {
  const list = Object.entries(PRESETS).map(([name, data]) => ({
    name, icon: data.icon, usage_unit: data.usage_unit, task_count: data.tasks.length,
  }));
  res.json(list);
});

router.get('/:name', (req, res) => {
  const preset = PRESETS[req.params.name];
  if (!preset) return res.status(404).json({ error: 'Preset not found' });
  res.json({ name: req.params.name, ...preset });
});

module.exports = { router, PRESETS };
