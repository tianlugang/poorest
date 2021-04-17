// 向上查找属性
export function getAttribute(el: HTMLElement | null, attr: string, root?: HTMLElement) {
  let value;

  while (el) {
    value = el.getAttribute(attr);
    el = value ? null : el.parentElement;
    if (el === root) return value;
  }

  return value;
}

