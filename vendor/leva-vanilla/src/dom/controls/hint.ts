import type { HintController } from '../../core/types';

/** 渲染不会接收用户输入的动态提示。 / Render a dynamic hint without an editable input. */
export function createHintInput(key: string, controller: HintController) {
  const container = document.createElement('div');
  container.className = 'leva__row-container leva__hint';
  container.dataset.path = controller.key || key;

  const text = document.createElement('div');
  text.className = 'leva__hint-text';
  text.setAttribute('role', 'status');
  text.setAttribute('aria-live', 'polite');
  container.append(text);

  const updateText = () => {
    text.textContent = controller.value;
  };
  const updateVisibility = (visible: boolean) => {
    container.classList.toggle('visibility-hidden', !visible);
  };
  updateText();
  updateVisibility(controller.visible);

  const unsubscribeChange = controller.onChange(updateText);
  const unsubscribeVisibility = controller.onVisibleChange(updateVisibility);
  controller.onDispose(() => {
    unsubscribeChange();
    unsubscribeVisibility();
    container.remove();
  });
  return container;
}
