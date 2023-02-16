import axios from "axios";
import AgentKeepAlive = require('agentkeepalive');

import logger from './Logger';

const keepAliveAgent = new AgentKeepAlive({
    maxSockets: 100, // Maximum number of sockets to allow per host. Defaults to Infinity.
    maxFreeSockets: 10,
    timeout: 60000, // active socket keepalive for 60 seconds
    freeSocketTimeout: 60000, // // Maximum number of sockets to leave open for 60 seconds in a free state. Only relevant if keepAlive is set to true. Defaults to 256.
    socketActiveTTL: 1000 * 60 * 10,
});

logger.debug('Axios KeepAliveAgent created');
export const axiosInstance = axios.create({ httpAgent: keepAliveAgent });