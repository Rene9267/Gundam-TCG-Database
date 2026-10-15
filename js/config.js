const IS_LOCAL = typeof location !== 'undefined' &&
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
const SUPABASE_URL = IS_LOCAL
  ? 'http://127.0.0.1:54321'
  : 'https://zhrvhhzcsdadoolxqpro.supabase.co';
const SUPABASE_ANON_KEY = IS_LOCAL
  ? 'local-anon-key'
  : 'sb_publishable_yeP5henLm-YdNtkwCFuV0Q_tE1koERf';
const CARD_IMAGE_BASE = 'https://pub-f106953afafa4b379122130a0f038335.r2.dev';
