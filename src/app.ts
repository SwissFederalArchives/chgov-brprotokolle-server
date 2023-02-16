import * as Koa from 'koa';
import config from './lib/Config';
import logger from './lib/Logger';
import {servicesRunning, ArgService, StandaloneService, CronService} from './lib/Service';

servicesRunning.forEach(function initService(service) {
    switch (service.runAs) {
        case 'web':
            startWeb();
            break;
        case 'image':
            startImage();
            break;
        case 'worker':
            startWorker(service as ArgService);
            break;
        case 'standalone':
            if (config.appInstance === undefined || parseInt(config.appInstance) === 0)
                startStandalone(service as StandaloneService);
            break;
        case 'cron':
            if (config.appInstance === undefined || parseInt(config.appInstance) === 0)
                startCron(service as CronService);
            break;
    }
});

async function startWeb() {
    await setUpWebEnvironment(async app => {
        const json = await import('koa-json');
        const bodyParser = await import('koa-bodyparser');
        const compress = await import('koa-compress');

        // be aware before enabling, check cpu
        //const iiifImageRouter = await import('./image/router');
        /*
        const iiifPresentationRouter = await import('./presentation/router');
        const iiifAuthRouter = await import('./authentication/router');
        const fileRouter = await import('./file/router');
        */
        const adminRouter = await import('./admin/router');
        //const staticRouter = await import('./static/router');
        const searchRouter  = await import('./search/router');

        app.use(compress());
        app.use(json({pretty: false, param: 'pretty'}));
        app.use(bodyParser());

        /*
        app.use(iiifImageRouter.default.routes());
        app.use(iiifPresentationRouter.default.routes());
        app.use(iiifAuthRouter.default.routes());

        app.use(fileRouter.default.routes());
        */
        app.use(adminRouter.default.routes());
        //app.use(staticRouter.default.routes());
        app.use(searchRouter.default.routes());
    });

    logger.info('Started the web service');
}

async function startImage() {
    await setUpWebEnvironment(async app => {
        const internalImageRouter = await import('./image/internalImageRouter');
        app.use(internalImageRouter.default.routes());
    });

    logger.info('Started the image service');
}

async function setUpWebEnvironment(setUp: (app: Koa) => Promise<void>) {
    const Koa = await import('koa');
    const app = new Koa();

    app.use(async (ctx, next) => {
        ctx.set('Access-Control-Allow-Origin', '*');
        ctx.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

        if (ctx.method === 'OPTIONS')
            ctx.status = 204;
        else
            await next();
    });

    app.use(async (ctx, next) => {
        try {
            await next();
        }
        catch (err) {
            const _err = err as any;
                ctx.status = _err.status || 500;
                ctx.body = (_err.status && _err.status < 500) ? _err.message : 'Internal Server Error';

                if (!_err.status || _err.status >= 500)
                    ctx.app.emit('error', _err, ctx);

        }
    });

    app.on('error', (err, ctx) => {
        if (err.code === 'EPIPE' || err.code === 'ECONNRESET') return;
        logger.error(`${err.status || 500} - ${ctx.method} - ${ctx.originalUrl} - ${err.message}`, {err});
    });

    if (config.env !== 'production') {
        const morgan = await import('koa-morgan');
        // @ts-ignore
        app.use(morgan('short', {'stream': logger.stream}));
    }

    await setUp(app);

    app.proxy = true;
    app.keys = [config.secret];

    app.listen(config.port);
}

function startStandalone(service: StandaloneService) {
    service.getService()();
    logger.info(`Standalone initialized for ${service.name}`);
}

async function startWorker(service: ArgService) {
    const onTask = await import('./lib/Worker');
    onTask.default(service.type, service.getService());
    logger.info(`Worker initialized for ${service.name}`);
}

async function startCron(service: CronService) {
    const cron = await import('node-cron');
    cron.schedule(service.cron, service.getService());
    logger.info(`Cron ${service.cron} scheduled for ${service.name}`);
}
