import { h } from '../ui/dom';
import { dialog } from '../ui/shell';

/** Beginner instructions: numbered steps, each a short heading and one or two plain sentences. */
export function howToPlay(title: string, steps: [string, string][]) {
  const body = h('ol.howto', {}, ...steps.map(([head, text]) => h('li', {}, h('b', {}, head), h('span', {}, text))));
  return dialog(title, body);
}
