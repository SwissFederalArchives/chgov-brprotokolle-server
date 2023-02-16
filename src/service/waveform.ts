import {dirname} from 'path';
import {promisify} from 'util';
import {exec} from 'child_process';

import {WaveformParams} from '../lib/Service';
import {getChildItemsByType, getFullPath, getDerivativePath} from '../lib/Item';

import {ensureDir} from 'fs-extra';

const execAsync = promisify(exec);

export default async function processAudioItems({collectionId}: WaveformParams): Promise<void> {
    try {
        const items = await getChildItemsByType(collectionId, 'audio');
        await Promise.all(items.map(async item => {
            const input = getFullPath(item, 'access');
            const output = getDerivativePath(item, 'waveform', 'dat');

            await ensureDir(dirname(output));

            return execAsync(`audiowaveform -i ${input} -o ${output} -z 256 -b 8`);
        }));
    }
    catch (e) {
        const _e = e as any;
        const err = new Error(`Failed to process the audio items for ${collectionId}: ${_e.message}`);
        err.stack = _e.stack;
        throw err;
    }
}
