import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HierarchyView } from '@web/lists/listsManager/rendering/HierarchyView';
import type { HierarchyItem, ListsManagerProxy, ShoppingItem } from '@web/lists/listsManager/types/hierarchy';

function makeItem(overrides: Partial<HierarchyItem> = {}): HierarchyItem {
  return {
    type: 'item',
    id: 1,
    product_name: 'Молоко',
    quantity: 1,
    unit: 'шт',
    is_completed: false,
    store_id: 1,
    product_group_id: 1,
    notes: null,
    list_id: 1,
    ...overrides,
  };
}

describe('HierarchyView notes tooltip', () => {
  let view: HierarchyView;
  let proxy: ListsManagerProxy;

  let isDesktop = false;

  beforeEach(() => {
    isDesktop = false;
    // matchMedia is read once in the constructor; `matches` is read on every toggle
    window.matchMedia = vi.fn(() => ({ get matches() { return isDesktop; } }) as unknown as ReturnType<typeof window.matchMedia>);
    document.body.innerHTML = '<div id="hierarchy-tree"></div>';
    proxy = { currentItems: [] } as unknown as ListsManagerProxy;
    view = new HierarchyView(proxy);
  });

  it('renders the info icon only for items with notes', () => {
    const html = view.renderItems([makeItem({ id: 1, notes: 'Без лактозы' }), makeItem({ id: 2, notes: null })], 'n', 2);
    const container = document.createElement('div');
    container.innerHTML = html;

    const icons = container.querySelectorAll('.hierarchy-item-note-icon');
    expect(icons).toHaveLength(1);
    expect(icons[0].closest('.hierarchy-item')?.getAttribute('data-item-id')).toBe('1');
    expect(icons[0].getAttribute('onclick')).toContain('event.stopPropagation()');
    expect(icons[0].getAttribute('onclick')).toContain('toggleNoteTip(1, this)');
  });

  it('toggleNoteTip shows the notes as text and a second tap hides them', () => {
    proxy.currentItems = [makeItem({ id: 7, notes: '<b>2 пачки</b> если акция' }) as unknown as ShoppingItem];
    const tree = document.getElementById('hierarchy-tree')!;
    tree.innerHTML = view.renderItems(proxy.currentItems as unknown as HierarchyItem[], 'n', 2);
    const icon = tree.querySelector('.hierarchy-item-note-icon') as HTMLElement;

    view.toggleNoteTip(7, icon);
    const tip = document.querySelector('.hierarchy-note-tip') as HTMLElement;
    expect(tip.classList.contains('visible')).toBe(true);
    expect(tip.textContent).toBe('<b>2 пачки</b> если акция');
    expect(tip.querySelector('b')).toBeNull();

    view.toggleNoteTip(7, icon);
    expect(tip.classList.contains('visible')).toBe(false);
  });

  it('on desktop a click on the icon keeps the hover-opened tooltip open', () => {
    isDesktop = true;
    proxy.currentItems = [makeItem({ id: 7, notes: 'заметка' }) as unknown as ShoppingItem];
    const tree = document.getElementById('hierarchy-tree')!;
    tree.innerHTML = view.renderItems(proxy.currentItems as unknown as HierarchyItem[], 'n', 2);
    const icon = tree.querySelector('.hierarchy-item-note-icon') as HTMLElement;

    view.toggleNoteTip(7, icon);
    view.toggleNoteTip(7, icon);
    expect(document.querySelector('.hierarchy-note-tip.visible')).not.toBeNull();
  });

  it('render() hides an open tooltip before replacing the tree', () => {
    proxy.currentItems = [makeItem({ id: 3, notes: 'заметка' }) as unknown as ShoppingItem];
    const tree = document.getElementById('hierarchy-tree')!;
    tree.innerHTML = view.renderItems(proxy.currentItems as unknown as HierarchyItem[], 'n', 2);
    view.showNoteTip(3, tree.querySelector('.hierarchy-item') as HTMLElement);
    expect(document.querySelector('.hierarchy-note-tip.visible')).not.toBeNull();

    view.hideNoteTip();
    expect(document.querySelector('.hierarchy-note-tip.visible')).toBeNull();
  });
});
