import {AdsMetadata} from "./brp.types";

export const MANUAL_FIX_ADS_ID : Map<string, string> = new Map([
    ["70016583","nodot"], // Date broken: no dot for month
    ["70013718","nodate"], // No date info in titles
    ["70013719","nodate"], // No date info in titles
    ["70013720","nodate"], // No date info in titles
    ["70013721","nodate"], // No date info in titles
    ["70013722","nodate"], // No date info in titles
    ["70013723","nodate"], // No date info in titles
    ["70013724","nodate"], // No date info in titles
    ["70013725","nodate"], // No date info in titles
]);


export const FIXES: Map<string, AdsMetadata> = new Map([
    ["70013718", {
        titleDE: "Beschlussprotokoll(-e) 01.01.-03.01.1938",
        titleFR: "Procès-verbal(-aux) des décisions 01.01.-03.01.1938",
        titleIT: "Verbale(-i) delle decisioni 01.01.-03.01.1938",
    } as any as AdsMetadata],
    ["70013719", {
        titleDE: "Beschlussprotokoll(-e) 04.01.-06.01.1938",
        titleFR: "Procès-verbal(-aux) des décisions 04.01.-06.01.1938",
        titleIT: "Verbale(-i) delle decisioni 04.01.-06.01.1938",
    } as any as AdsMetadata],
    ["70013720", {
        titleDE: "Beschlussprotokoll(-e) 07.01.-10.01.1938",
        titleFR: "Procès-verbal(-aux) des décisions 07.01.-10.01.1938",
        titleIT: "Verbale(-i) delle decisioni 07.01.-10.01.1938",
    } as any as AdsMetadata],
    ["70013721", {
        titleDE: "Beschlussprotokoll(-e) 11.01.-13.01.1938",
        titleFR: "Procès-verbal(-aux) des décisions 11.01.-13.01.1938",
        titleIT: "Verbale(-i) delle decisioni 11.01.-13.01.1938",
    } as any as AdsMetadata],
    ["70013722", {
        titleDE: "Beschlussprotokoll(-e) 14.01.-17.01.1938",
        titleFR: "Procès-verbal(-aux) des décisions 14.01.-17.01.1938",
        titleIT: "Verbale(-i) delle decisioni 14.01.-17.01.1938",
    } as any as AdsMetadata],
    ["70013723", {
        titleDE: "Beschlussprotokoll(-e) 18.01.-20.01.1938",
        titleFR: "Procès-verbal(-aux) des décisions 18.01.-20.01.1938",
        titleIT: "Verbale(-i) delle decisioni 18.01.-20.01.1938",
    } as any as AdsMetadata],
    ["70013724", {
        titleDE: "Beschlussprotokoll(-e) 21.01.-24.01.1938",
        titleFR: "Procès-verbal(-aux) des décisions 21.01.-24.01.1938",
        titleIT: "Verbale(-i) delle decisioni 21.01.-24.01.1938",
    } as any as AdsMetadata],
    ["70013725", {
        titleDE: "Beschlussprotokoll(-e) 25.01.-27.01.1938",
        titleFR: "Procès-verbal(-aux) des décisions 25.01.-27.01.1938",
        titleIT: "Verbale(-i) delle decisioni 25.01.-27.01.1938",
    } as any as AdsMetadata],
    ["70016583", {
        titleDE: "Beschlussprotokoll(-e) 22.02.-25.02.1958",
        titleFR: "Procès-verbal(-aux) des décisions 22.02.-25.02.1958",
        titleIT: "Verbale(-i) delle decisioni 22.02.-25.02.1958",
    } as any as AdsMetadata],
]);


export function applyFix(meta:AdsMetadata){
    if(FIXES.has(meta.ADS)){
        const fixes = FIXES.get(meta.ADS) as AdsMetadata;
        Object.keys(meta).forEach(key => {
            if((fixes as any)[key]){
                (meta as any)[key]=(fixes as any)[key]
            }
        })
    }
}
