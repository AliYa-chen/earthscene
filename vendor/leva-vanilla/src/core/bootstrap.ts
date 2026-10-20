import { register } from './registry';
import { createNumberController } from './NumberController';
import { createBooleanController } from './BooleanController';
import { createSelectController } from './SelectController';
import { createButtonController } from './ButtonController';
import { createStringController } from './StringController';
import { createHintController } from './HintController';
import { createColorController } from './ColorController';

let initialized = false;

export function registerDefaults() {
  if (initialized) return;

  register('string', createStringController);
  register('hint', createHintController);
  register('color', createColorController);
  register('number', createNumberController);
  register('boolean', createBooleanController);
  register('select', createSelectController);
  register('button', createButtonController);

  initialized = true;
}
