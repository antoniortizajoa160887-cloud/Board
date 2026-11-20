import './styles.css';
import { unlockAudio } from './audio';
import { onBack } from './platform';
import { save } from './save';
import { hallScreen } from './ui/hall';
import { startReactions } from './ui/reactions';
import { back, closeTopDialog, home } from './ui/router';
import { watchForUpdates } from './update';

startReactions();
home(hallScreen);
onBack(() => closeTopDialog() || back());
watchForUpdates();
window.addEventListener('pointerdown', () => unlockAudio(), { once: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
