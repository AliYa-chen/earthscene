import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { leva } from '../vendor/leva-vanilla/src';
import normalize from '../vendor/leva-vanilla/src/schema/normalize';
import { createHintInput } from '../vendor/leva-vanilla/src/dom/controls/hint';
import type { HintController } from '../vendor/leva-vanilla/src/core/types';

class TestElement {
  readonly children: TestElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes: Record<string, string> = {};
  className = '';
  textContent = '';
  removed = false;
  constructor(readonly tagName: string) {}
  readonly classList = {
    toggle: (name: string, force: boolean) => {
      const names = new Set(this.className.split(' ').filter(Boolean));
      if (force) names.add(name);
      else names.delete(name);
      this.className = [...names].join(' ');
    },
    contains: (name: string) => this.className.split(' ').includes(name),
  };
  append(child: TestElement) { this.children.push(child); }
  setAttribute(name: string, value: string) { this.attributes[name] = value; }
  remove() { this.removed = true; }
}

afterEach(() => vi.unstubAllGlobals());

describe('vendored Leva hint controls', () => {
  it('normalizes hints without treating color-like text as a color input', () => {
    const nodes = normalize({ status: { type: 'hint', value: '#ffffff' } });
    expect(nodes.status).toMatchObject({ type: 'hint', value: '#ffffff' });
    expect(() => normalize({ status: { type: 'hint', value: 4 } } as never))
      .toThrow('Expected string');
    expect(() => normalize({ status: { type: 'hint', value: 'Ready', min: 0 } } as never))
      .toThrow('Invalid property "min"');
    expect(() => normalize({ status: { type: 'unknown', value: 'Ready' } } as never))
      .toThrow('Invalid property "type"');
  });

  it('renders read-only text and follows nested state, visibility and disposal', () => {
    vi.stubGlobal('document', {
      createElement: (tagName: string) => new TestElement(tagName),
      querySelector: () => null,
    });
    const controls = leva({
      status: {
        $: { label: 'Status' },
        message: { type: 'hint' as const, value: 'Loading', visible: false },
      },
    }, { gui: false });
    expectTypeOf(controls.status.message).toEqualTypeOf<string>();
    const controller = (controls as unknown as {
      _controllers: Record<string, HintController>;
    })._controllers['status.message'];
    const element = createHintInput('message', controller) as unknown as TestElement;
    const text = element.children[0];
    expect(element.tagName).toBe('div');
    expect(text.tagName).toBe('div');
    expect(element.dataset.path).toBe('status.message');
    expect(element.classList.contains('visibility-hidden')).toBe(true);
    expect(text.textContent).toBe('Loading');
    expect(text.attributes.role).toBe('status');

    controls.status.message = '<img src=x onerror=alert(1)>\nReady';
    expect(text.textContent).toBe('<img src=x onerror=alert(1)>\nReady');
    controls.visibility('status.message', true);
    expect(element.classList.contains('visibility-hidden')).toBe(false);

    controls.dispose();
    expect(element.removed).toBe(true);
    controller.set('Disposed');
    expect(text.textContent).toBe('<img src=x onerror=alert(1)>\nReady');
  });
});
