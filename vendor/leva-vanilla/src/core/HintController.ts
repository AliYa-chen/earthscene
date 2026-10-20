import type { HintController, ReactiveStore } from './types';
import type { HintNode } from '../schema/nodes';
import { createStringController } from './StringController';

/** 复用字符串状态和通知，以只读提示类型渲染。 / Reuse string state and notifications for a read-only hint. */
export function createHintController(
  path: string,
  key: string,
  state: Record<string, unknown>,
  node: HintNode,
  store: ReactiveStore
): HintController {
  const controller = createStringController(
    path, key, state, { ...node, type: 'string' }, store
  );
  // Descriptors retain the live value/visibility accessors and shared lifecycle.
  return Object.defineProperty(controller, 'type', {
    value: 'hint',
    enumerable: true,
    configurable: true,
  }) as unknown as HintController;
}
