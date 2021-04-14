import semver from 'semver'
import { logger } from '@poorest/util'
import { Storage, PackageUtility } from '../storage'
import { IRouterMiddleware } from '../types'
import { getDateNow, pedding, getDateJSON, EMPTY_OBJECT } from '../services'

const MESSAGE = {
    queryTextMustSN: 'Query text must be a string or number',
    querySince: '[query_parse_error] Invalid value for `stale`.',
    queryStartKey: '[query_parse_error] Invalid value for `startkey`.'
}
const A_WEEK_MS = 3600000 * 24 * 7;
const TWA_DAYS_MS = 3600000 * 24 * 2;

export const listAllPublicPackage: IRouterMiddleware = async (ctx, _next) => {
    const [err, names] = await pedding(Storage.getPackageNames())
    if (err) {
        ctx.status = err.status
        ctx.body = {
            error: err.message,
            reason: err.message,
        }
        return
    }
    names._updated = getDateNow()
    ctx.body = names
    ctx.status = 200
}

/*
npm v1/search records:
{
    "package": {
        "name": "demofile",
        "scope": "unscoped",
        "version": "2.0.0-beta.4",
        "description": "![CI](https://github.com/saul/demofile/workflows/CI/badge.svg) [![Join the chat at https://gitter.im/saul/demofile](https://badges.gitter.im/saul/demofile.svg)](https://gitter.im/saul/demofile?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_co",
        "keywords": [
            "demo",
            "source",
            "csgo"
        ],
        "date": "2021-01-10T15:55:37.604Z",
        "links": {
            "npm": "https://www.npmjs.com/package/demofile"
        },
        "author": {
            "name": "Saul Rennison",
            "email": "saul.rennison@gmail.com",
            "username": "saulren"
        },
        "publisher": {
            "username": "saulren",
            "email": "saul.rennison@gmail.com"
        },
        "maintainers": [
            {
                "username": "saulren",
                "email": "saul.rennison@gmail.com"
            }
        ]
    },
    "score": {
        "final": 0.38514155279642165,
        "detail": {
            "quality": 0.850327181894442,
            "popularity": 0.03821923303263546,
            "maintenance": 0.3333333333333333
        }
    },
    "searchScore": 0.00007789484
}
*/
// /-/v1/search?text=my&size=20&from=0&quality=0.65&popularity=0.98&maintenance=0.5
export const listPartialSearch: IRouterMiddleware = async (ctx) => {
    const text = ctx.query.text as string
    const size = Number.parseInt(ctx.query.size as string)
    const pageSize = size <= 0 ? 20 : size
    const from = Number.parseInt(ctx.query.from as string)

    logger.trace(ctx.query, 'v1 search, text:@{text} page-size: @{size}')
    if (typeof text !== 'string' && typeof text !== 'number') {
        ctx.status = 415
        ctx.body = {
            error: MESSAGE.queryTextMustSN,
            reason: MESSAGE.queryTextMustSN,
        }
        return
    }

    let objectsTotal = 0
    let objects: any[] = []

    const queryPromises = Storage.searchLocal({
        from,
        size: pageSize,
        text,
        picker(metadata, total) {
            const versions = Object.keys(metadata.versions)
            const latestVersion = PackageUtility.semverSort(versions)[0]
            const latestPackage = metadata.versions[latestVersion]
            
            latestPackage.author = latestPackage.author || metadata.author || EMPTY_OBJECT
            if (metadata.time) {
                latestPackage.date = metadata.time.modified
            }
            objectsTotal = total
            objects.push({
                package: latestPackage,
                flags: {
                    unstable: versions.some((v) => semver.satisfies(v, '^1.0.0'))
                        ? undefined : true
                },
                score: {
                    final: 1,
                    detail: {
                        quality: 1,
                        popularity: 1,
                        maintenance: 0
                    }
                },
                searchScore: 100000
            })
        }
    })

    const [err] = await pedding(queryPromises)

    if (err) {
        ctx.status = err.status
        ctx.body = {
            error: err.message,
            reason: err.message,
        }
        return
    }
    const [, records] = await pedding(Storage.searchFromNPM(ctx.query))

    if (records) {
        objects = objects.concat(records.objects)
        objectsTotal += records.total
    }
    ctx.status = 200
    ctx.body = {
        objects: objects,
        total: objectsTotal,
        time: getDateJSON()
    }
}

export const listPublicPackageSince: IRouterMiddleware = async (ctx) => {
    const query = ctx.query;
    if (query.stale !== 'update_after') {
        ctx.status = 400;
        ctx.body = {
            error: MESSAGE.querySince,
            reason: MESSAGE.querySince,
        };
        return;
    }

    let startkey = Number(query.startkey);
    if (!startkey) {
        ctx.status = 400;
        ctx.body = {
            error: MESSAGE.queryStartKey,
            reason: MESSAGE.queryStartKey,
        };
        return;
    }

    const updated = getDateNow()
    if (updated - startkey > A_WEEK_MS) {
        startkey = updated - TWA_DAYS_MS;
        logger.warn({
            d: Date(),
            query: ctx.querystring,
            ip: ctx.ip,
            startkey
        }, '[@{d}] list modules since time out of range: query: @{query}, ip: @{ip}, limit to @{startkey}')
    }

    const [err, names] = await pedding(Storage.getPackageNames(startkey))
    if (err) {
        ctx.status = err.status
        ctx.body = {
            error: err.message,
            reason: err.message,
        }
        return
    }

    names._updated = updated
    ctx.body = names
}