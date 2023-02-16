import {existsSync} from 'fs';
import * as Router from 'koa-router';

import HttpError from '../lib/HttpError';
import {runTask} from '../lib/Task';
import {workerStatus} from '../lib/Worker';

import {IndexParams} from '../lib/Service';
import config from "../lib/Config";
import {spawn} from "child_process";

const router = new Router({prefix: '/admin'});

router.use(async (ctx, next) => {
    /*if (!hasAdminAccess(ctx))
        throw new HttpError(403, 'Access denied');*/
    if(!(ctx.request.body.access_token && (ctx.request.body.access_token.toLowerCase() === config.accessToken)) &&
    !(ctx.query.access_token && (ctx.query.access_token.toLowerCase() === config.accessToken)) &&
    !(ctx.headers.hasOwnProperty('authorization') &&
        (ctx.headers.authorization.replace('Bearer', '').trim().toLowerCase() === config.accessToken))) {
        throw new HttpError(403, 'Access denied');
    }
    await next();
});

router.get('/worker_status', async ctx => {
    ctx.body = await workerStatus();
});

/*
router.post('/index_api', async ctx => {
    await indexCollection(ctx.request.body);
    ctx.body = 'Successfully indexed the collection!';
});
*/

router.post('/index', async ctx => {
    if (!ctx.request.body.path)
        throw new HttpError(400, 'Please provide a path');

    const path = ctx.request.body.path;
    if (!existsSync(path))
        throw new HttpError(400, `The provided path "${path}" does not seem to exist`);

    runTask<IndexParams>('metadata', {collectionPath: path});
    ctx.body = 'Collection is sent to the queue for indexing';
});
/*
router.post('/register_token', async ctx => {
    ctx.body = await registerToken(
        ctx.request.body.token, ctx.request.body.collection, ctx.request.body.from, ctx.request.body.to);
});
*/
export default router;
