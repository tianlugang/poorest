const nextIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="22" height="22" style="fill: rgba(0,0,0,0.65);"><path d="M20.911 17.143q0 0.232-0.179 0.411l-8.321 8.321q-0.179 0.179-0.411 0.179t-0.411-0.179l-0.893-0.893q-0.179-0.179-0.179-0.411t0.179-0.411l7.018-7.018-7.018-7.018q-0.179-0.179-0.179-0.411t0.179-0.411l0.893-0.893q0.179-0.179 0.411-0.179t0.411 0.179l8.321 8.321q0.179 0.179 0.179 0.411z"></path></svg>`
const nextIconDisabled = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="22" height="22" style="fill: rgba(0,0,0,0.25);"><path d="M20.911 17.143q0 0.232-0.179 0.411l-8.321 8.321q-0.179 0.179-0.411 0.179t-0.411-0.179l-0.893-0.893q-0.179-0.179-0.179-0.411t0.179-0.411l7.018-7.018-7.018-7.018q-0.179-0.179-0.179-0.411t0.179-0.411l0.893-0.893q0.179-0.179 0.411-0.179t0.411 0.179l8.321 8.321q0.179 0.179 0.179 0.411z"></path></svg>`
const prevIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="24" height="24" style="fill: rgba(0,0,0,0.65);"><path d="M21.482 9.714q0 0.232-0.179 0.411l-7.018 7.018 7.018 7.018q0.179 0.179 0.179 0.411t-0.179 0.411l-0.893 0.893q-0.179 0.179-0.411 0.179t-0.411-0.179l-8.321-8.321q-0.179-0.179-0.179-0.411t0.179-0.411l8.321-8.321q0.179-0.179 0.411-0.179t0.411 0.179l0.893 0.893q0.179 0.179 0.179 0.411z"></path></svg>`
const prevIconDisabled = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="24" height="24" style="fill: rgba(0,0,0,0.25);"><path d="M21.482 9.714q0 0.232-0.179 0.411l-7.018 7.018 7.018 7.018q0.179 0.179 0.179 0.411t-0.179 0.411l-0.893 0.893q-0.179 0.179-0.411 0.179t-0.411-0.179l-8.321-8.321q-0.179-0.179-0.179-0.411t0.179-0.411l8.321-8.321q0.179-0.179 0.411-0.179t0.411 0.179l0.893 0.893q0.179 0.179 0.179 0.411z"></path></svg>`
const formatQS = (qs: string) => {
    qs = qs.startsWith('?') ? qs.slice(1) : qs
    qs = qs.startsWith('&') ? qs.slice(1) : qs

    return qs
}

export function paging(pageCurrent: number, pageTotal: number, pathname: string = '', qs: string = '', limitNum: number = 5) {
    qs = formatQS(qs)
    const getHref = (p: number) => {
        return pathname + '?p=' + p + '&' + qs;
    }
    const comparePage = (p: number) => {
        let str = '';

        if (pageCurrent === p) {
            str = `<span class="active">${p}</span>`;
        } else {
            if (p === 1 && pageCurrent <= 1) {
                str = `<span class="active">${p}</span>`;
            } else {
                str = `<a href="${getHref(p)}">${p}</a>`;
            }
        }

        return str;
    }

    let str = '';
    let p = 1;

    pageCurrent *= 1
    if (pageCurrent > 1) {
        str += `<a class="prev" href="${getHref(pageCurrent - 1)}">${prevIcon}</a>`;
    } else {
        str += `<span class="prev">${prevIconDisabled}</span>`;
    }
    if (pageTotal < limitNum + 2) {
        for (p = 1; p <= pageTotal; p++) {
            str += comparePage(p);
        }
    } else {
        str += comparePage(1);
        const half = Math.floor(limitNum / 2);
        const end = pageCurrent + half;
        let loopEnd = end >= pageTotal ? pageTotal : end;
        let loopStart = loopEnd - limitNum;

        if (loopStart <= 1) {
            loopStart = 2;
            loopEnd = loopStart + limitNum
        }
        if (loopStart > 2) {
            str += '…';
        }
        for (p = loopStart; p < loopEnd; p++) {
            str += comparePage(p);
        }
        if (pageTotal - loopEnd > 0) {
            str += '…';
        }
        str += comparePage(pageTotal);
    }

    if (pageCurrent < pageTotal) {
        str += `<a class="next" href="${getHref(pageCurrent + 1)}">${nextIcon}</a>`;
    } else {
        str += `<span class="next">${nextIconDisabled}</span>`;
    }

    return str;
}

export type IPageOptions = {
    current: number
    total: number
    pathname?: string
    qs?: string
    limitNum?: number
}

export function perPage({ current, total, pathname = '', qs = '', limitNum = 5 }: IPageOptions) {
    return paging(current, total, pathname, qs, limitNum)
}