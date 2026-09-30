import test from 'node:test';import assert from 'node:assert/strict';
import {officeImportProperties} from '../office-host/import-policy.mjs';
test('unattended Office import uses typed never-execute/no-update policies and aborts interactions',()=>{
 let handler;
 const zeta={type:{short:'short',interface:t=>t},Any:class{constructor(type,value){this.type=type;this.value=value;}},unoObject(interfaces,object){handler=object;return object;}};
 const css={beans:{PropertyValue:class{constructor(value){Object.assign(this,value);}}},task:{XInteractionHandler:'handler',XInteractionAbort:'abort'}};
 const properties=Object.fromEntries(officeImportProperties(zeta,css).map(p=>[p.Name,p.Value]));
 assert.equal(properties.Hidden,true);assert.equal(properties.ReadOnly,true);
 for(const key of ['MacroExecutionMode','UpdateDocMode'])assert.deepEqual({...properties[key]},{type:'short',value:0});
 let selected=false;
 handler.handle({getContinuations:()=>[{queryInterface:type=>{assert.equal(type,'abort');return{select(){selected=true;}};}}]});
 assert.equal(selected,true);
 assert.throws(()=>handler.handle({getContinuations:()=>[{queryInterface:()=>null}]}),/unsupported interaction/);
});
