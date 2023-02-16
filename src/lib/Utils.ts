/**
 * A collection of utilities
 */

/**
 * Asynchronous for each loop
 * @param array The array to loop over
 * @param callback The callback to execute on each array element. Params passed: element
 */
export async function asyncForEach(array: any[], callback: any){
    for(let index=0; index < array.length; index++){
        await callback(array[index]);
    }
}

export async function asyncForEachIndexed(array: any[], callback: any){
    for(let index=0; index < array.length; index++){
        await callback(array[index], index);
    }
}

export async function asyncForEachM(map: Map<any, any>, callback: any){
    for(let entry of map.entries()){
        await callback(entry[1], entry[0]);
    }
}
