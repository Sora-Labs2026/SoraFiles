export const ocrLanguages=Object.freeze({eng:'English',deu:'German',fra:'French',spa:'Spanish',por:'Portuguese',ita:'Italian',nld:'Dutch',pol:'Polish',rus:'Russian',tur:'Turkish',ara:'Arabic',hin:'Hindi',ind:'Indonesian',jpn:'Japanese',kor:'Korean',chi_sim:'Chinese (Simplified)',chi_tra:'Chinese (Traditional)',tha:'Thai',vie:'Vietnamese'});
export function ocrOptions({language='eng',format='txt'}={}){
 if(!Object.hasOwn(ocrLanguages,language)||!['txt','pdf'].includes(format))throw Error('Choose a supported language and output format');
 return {language,format};
}
