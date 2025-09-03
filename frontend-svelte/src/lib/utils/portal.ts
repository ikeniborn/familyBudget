import { onMount } from 'svelte';

/**
 * Svelte action для создания портала
 * Перемещает элемент в конец document.body для решения проблем с z-index
 */
export function portal(node: HTMLElement) {
  let target = document.body;
  
  // Сохраняем оригинальный родитель для возврата
  const originalParent = node.parentNode;
  const originalNextSibling = node.nextSibling;
  
  // Перемещаем элемент в target (document.body)
  target.appendChild(node);
  
  return {
    destroy() {
      // Возвращаем элемент обратно при уничтожении
      if (originalParent && node.parentNode === target) {
        if (originalNextSibling) {
          originalParent.insertBefore(node, originalNextSibling);
        } else {
          originalParent.appendChild(node);
        }
      }
    }
  };
}

/**
 * Хук для создания портала с правильным lifecycle
 */
export function createPortal() {
  let mounted = false;
  
  onMount(() => {
    mounted = true;
    return () => {
      mounted = false;
    };
  });
  
  return {
    get mounted() { return mounted; }
  };
}