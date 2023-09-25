import Router from '@koa/router';
import send from 'koa-send';
import {DefaultState} from 'koa';

import HttpError from '../lib/HttpError.js';
import {ExtendedContext} from '../lib/Koa.js';
import {fileIconsPath} from '../lib/FileIcon.js';

import logger from '../lib/Logger.js';

export const router = new Router<DefaultState, ExtendedContext>();

router.use(async (ctx, next) => {
    try {
        await next();
    }
    catch (e) {
        throw new HttpError(404, 'Not found');
    }
});

router.get('/', async ctx => {
    await send(ctx, '/src/static/iiif-explorer.html');
});

router.get('/iiif-explorer:path(.*)?', async ctx => {
    await send(ctx, ctx.params.path, {root: './node_modules/iiif-explorer/dist/iiif-explorer/'});
});

router.get('/file-icon:path(.*)', async ctx => {
    await send(ctx, ctx.params.path, {root: fileIconsPath});
});

router.get('/d1476b3e122b2821ec33a00195456c74.txt', async ctx => {
    logger.info(`Received a owasp request`);

    ctx.body = "detectify";
    ctx.set('Content-Type', 'text/plain');

    logger.info(`Sending owasp enabling text`);
});