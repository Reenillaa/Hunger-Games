/**
 * Spanish strings. Every player-visible text goes through a key (decision D-01:
 * universe names can change here without touching code).
 */
export const es = {
  'game.title': 'DIEZMO',
  'game.tagline': 'Lo que la Concordia exige, el distrito lo entrega.',
  'game.placeholderNotice': 'Versión en construcción · Fase 1 (esqueleto técnico)',

  'district.d12.name': 'Distrito XII · Veta Negra',
  'capital.name': 'Áurea',
  'regime.name': 'La Concordia',
  'selection.name': 'La Criba',
  'games.name': 'Los Juegos del Diezmo',

  'menu.continue': 'Continuar',
  'menu.newGame': 'Nueva partida',
  'menu.load': 'Cargar partida',
  'menu.import': 'Importar copia de seguridad',
  'menu.back': 'Volver',
  'menu.storageWarning':
    'El navegador no garantiza conservar tus partidas. Exporta copias de seguridad de vez en cuando.',

  'season.spring': 'Primavera',
  'season.summer': 'Verano',
  'season.autumn': 'Otoño',
  'season.winter': 'Invierno',
  'calendar.date': 'Año {year} · {season} · Día {day}',
  'calendar.time': '{hour}:00',
  'calendar.countdown': '{selection} en {days} d {hours} h',
  'calendar.edition': '{games}, edición {edition}',

  'speed.pause': 'Pausa',
  'speed.x1': 'Velocidad normal',
  'speed.x2': 'Velocidad doble',
  'speed.x4': 'Velocidad cuádruple',

  'hud.menu': 'Menú',
  'hud.save': 'Guardar',

  'phase.district': 'Distrito',
  'phase.selection': 'La Criba',
  'phase.capital': 'Áurea',
  'phase.arena': 'Arena',
  'phase.aftermath': 'Regreso',

  'phase.selection.body':
    'Hoy es el día de la Criba. La ceremonia con tus habitantes reales llegará en la Fase 5.',
  'phase.selection.action': 'Partir hacia Áurea',
  'phase.capital.body': 'Día {day} de {total} en Áurea. La preparación llegará en la Fase 6.',
  'phase.capital.action': 'Siguiente día',
  'phase.capital.launch': 'Ceremonia de lanzamiento',
  'phase.arena.body': 'La arena forestal llegará en la Fase 7.',
  'phase.arena.action': 'Cerrar los juegos (provisional)',
  'phase.aftermath.body':
    'Tu delegación regresa tras {days} días fuera. Las consecuencias llegarán en la Fase 8.',
  'phase.aftermath.action': 'Volver al distrito',
  'phase.placeholder': 'PROVISIONAL',

  'save.title': 'Guardar partida',
  'save.slot': 'Ranura {n}',
  'save.empty': 'Vacía',
  'save.saveHere': 'Guardar aquí',
  'save.export': 'Exportar copia de seguridad',
  'save.saved': 'Partida guardada',
  'save.autosave': 'Autoguardado',
  'save.failed': 'No se pudo guardar',
  'save.close': 'Cerrar',
  'load.title': 'Cargar partida',
  'load.empty': 'No hay partidas guardadas.',
  'load.importFailed': 'El archivo no es una copia de seguridad válida.',

  'error.title': 'Algo ha fallado',
  'error.body': 'El juego ha encontrado un error. Puedes exportar tu partida antes de recargar.',
  'error.export': 'Exportar partida',
  'error.reload': 'Recargar',

  'debug.title': 'Depuración',
  'debug.day': '+1 día',
  'debug.toSelection': 'Ir a la Criba',
} as const;

export type LocaleKey = keyof typeof es;
