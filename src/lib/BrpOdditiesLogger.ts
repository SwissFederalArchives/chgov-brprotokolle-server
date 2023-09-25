import {resolve} from "path";
import fsExtra from "fs-extra";
import {writeFileSync} from "fs";
import logger from "./Logger.js";
import config from "./Config.js";

export class BrpOdditiesLogger {

    private readonly PREFIX = '[BrpOdditiesLogger]';

    private static instance: BrpOdditiesLogger;

    private timeSuffix: string;

    private logs: string[];

    public static getInstance(){
        if(!BrpOdditiesLogger.instance){
            BrpOdditiesLogger.instance = new BrpOdditiesLogger();
        }
        return BrpOdditiesLogger.instance;
    }

    public log(message: string){
        this.logs.push(message);
        this.write();
    }

    private constructor() {
        this.timeSuffix = `${new Date().getTime()/1000|0}`;
        this.logs = [];
    }

    private filename(){
        return `oddities-${this.timeSuffix}.log`;
    }

    private write(){
        const filename = resolve(config.dataRootPath!, this.filename());
        fsExtra.removeSync(filename);
        writeFileSync(filename, this.logs.join(`\n`))
    }


}
