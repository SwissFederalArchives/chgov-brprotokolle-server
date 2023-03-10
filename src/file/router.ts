import {Context} from 'koa';
import * as Router from 'koa-router';

import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';
import {promisify} from 'util';

import logger from '../lib/Logger';
import HttpError from '../lib/HttpError';
import getPronomInfo from '../lib/Pronom';
import {AccessState, hasAccess, hasAdminAccess} from '../lib/Security';
import {determineItem, getFullPath, getPronom, getAvailableType, hasType, getDerivativePath} from '../lib/Item';

const statAsync = promisify(fs.stat);

const derivatives: { [name: string]: { contentType: string, extension: string } } = {
    waveform: {contentType: 'application/octet-stream', extension: 'dat'}
};

const router = new Router({prefix: '/file'});

router.use(async (ctx, next) => {
    ctx.set('Accept-Ranges', 'bytes');

    const rangeHeader = ctx.header.range;
    if (!rangeHeader)
        return await next();

    const [bytes, ranges] = rangeHeader.split('=');
    if (bytes !== 'bytes' || !ranges || ranges.includes(','))
        throw new HttpError(416, 'Range Not Satisfiable');

    let [start, end] = ranges.split('-');
    start = Number(start);
    end = (end !== '') ? Number(end) : Infinity;

    if (isNaN(start) || isNaN(end))
        throw new HttpError(416, 'Range Not Satisfiable');

    logger.debug(`Received a range request from ${start} to ${end}`);

    ctx.state.start = start;
    ctx.state.end = end;

    await next();

    const length = ctx.length;
    if (!isNaN(length) && (start < length) && ((end < length) || !isFinite(end))) {
        end = isFinite(end) ? end : length - 1;

        ctx.status = 206;
        ctx.set('Content-Range', `bytes ${start}-${end}/${length}`);
        ctx.set('Content-Length', String(end - start + 1));
    }
});

router.get('/:id/:type(original|access)?', async ctx => {
    logger.info(`Received a request for a file with id ${ctx.params.id}`);

    const item = await determineItem(ctx.params.id);
    if (!item)
        throw new HttpError(404, `No file found with the id ${ctx.params.id}`);

    const access = await hasAccess(ctx, item, false);
    if (access.state !== AccessState.OPEN)
        throw new HttpError(401, 'Access denied');

    if (ctx.params.type && !['original', 'access'].includes(ctx.params.type))
        throw new HttpError(400, 'You can only request an original or an access copy!');

    if (ctx.params.type && !hasType(item, ctx.params.type))
        throw new HttpError(400, `There is no ${ctx.params.type} copy for file with id ${ctx.params.id}`);

    const type = ctx.params.type || getAvailableType(item);
    const fullPath = getFullPath(item, type);

    if (!fullPath || (item.type === 'image' && !hasAdminAccess(ctx)))
        throw new HttpError(404, `No file found for id ${ctx.params.id} and type ${type}`);

    const pronom = getPronom(item, type);
    const name = path.basename(fullPath);
    const pronomInfo = getPronomInfo(pronom);
    const stat = await statAsync(fullPath);
    const contentType = (pronomInfo && pronomInfo.mime) ? pronomInfo.mime : mime.contentType(name);

    if (item.resolution)
        ctx.set('Content-Resolution', String(item.resolution));

    if (contentType)
        ctx.set('Content-Type', contentType);

    ctx.set('Content-Length', String(stat.size));
    ctx.set('Content-Disposition', `inline; filename="${name}"`);
    setBody(ctx, stat, fullPath);

    logger.info(`Sending a file with id ${ctx.params.id}`);
});

router.get('/:id/:derivative', async ctx => {
    logger.info(`Received a request for a file derivative with id ${ctx.params.id} of type ${ctx.params.derivative}`);

    if (!derivatives.hasOwnProperty(ctx.params.derivative))
        throw new HttpError(404, `No derivative of type ${ctx.params.derivative}`);

    const info = derivatives[ctx.params.derivative];
    const item = await determineItem(ctx.params.id);
    if (!item)
        throw new HttpError(404, `No file found with the id ${ctx.params.id}`);

    const access = await hasAccess(ctx, item, false);
    if (access.state !== AccessState.OPEN)
        throw new HttpError(401, 'Access denied');

    const fullPath = getDerivativePath(item, ctx.params.derivative, info.extension);
    if (!fs.existsSync(fullPath))
        throw new HttpError(404, `No derivative found for id ${ctx.params.id} of type ${ctx.params.derivative}`);

    const stat = await statAsync(fullPath);

    ctx.set('Content-Type', info.contentType);
    ctx.set('Content-Length', String(stat.size));
    ctx.set('Content-Disposition', `inline; filename="${ctx.params.derivative}-${ctx.params.id}.${info.extension}"`);
    setBody(ctx, stat, fullPath);

    logger.info(`Sending a derivative with id ${ctx.params.id} of type ${ctx.params.derivative}`);
});

function setBody(ctx: Context, stat: fs.Stats, fullPath: string) {
    const options: { start?: number, end?: number } = {};
    if (ctx.state.start && ctx.state.end &&
        (ctx.state.start < stat.size) && ((ctx.state.end < stat.size) || !isFinite(ctx.state.end))) {
        options.start = ctx.state.start;
        options.end = ctx.state.end;
    }
    ctx.body = fs.createReadStream(fullPath, options);
}

export default router;
