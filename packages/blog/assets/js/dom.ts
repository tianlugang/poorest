export function addClass(el: Element, className: string) {
    if (className == null) return;
    const original = el.className;

    if (original.length === 0) {
        el.className = className;
        return;
    }

    if (original.match(new RegExp('(^|\\s)' + className + '(\\s|$)'))) {
        return;
    }

    el.className = original + ' ' + className;
}

export function removeClass(el: Element, className: string) {
    const original = el.className;

    if (original.length === 0) {
        return;
    }

    if (original == className) {
        el.className = '';
        return;
    }

    if (original.match(new RegExp('(^|\\s)' + className + '(\\s|$)'))) {
        el.className = original.replace((new RegExp('(^|\\s)' + className + '(\\s|$)')), '');
    }
}

export function $(selector: string, ctx: HTMLElement | Document = document) {
    return ctx.querySelectorAll<HTMLElement>(selector);
}

export function $q(selector: string, ctx: HTMLElement | Document = document) {
    return ctx.querySelector<HTMLElement>(selector);
}