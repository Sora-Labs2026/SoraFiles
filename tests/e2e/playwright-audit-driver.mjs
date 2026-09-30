import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { FirefoxWebDriver } from './firefox-webdriver.mjs';

// Reuse the established audit's assertions and workflows on Windows Chromium.
export class PlaywrightAuditDriver extends FirefoxWebDriver {
  async start() {
    await mkdir(this.downloadDir,{recursive:true});
    this.browser=await chromium.launch({channel:process.env.SORA_BROWSER_CHANNEL || 'msedge',headless:true});
    this.context=await this.browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000},isMobile:process.env.SORA_QA_MOBILE==='1',hasTouch:process.env.SORA_QA_MOBILE==='1'});
    if(process.env.SORA_QA_EDGE_HEADERS==='1')await this.context.route('**/*',async route=>{
      if(route.request().resourceType()!=='document')return route.continue();
      const response=await route.fetch();
      const headers=response.headers();
      if(headers['content-type']?.includes('text/html'))headers['content-security-policy']="base-uri 'self'; object-src 'none'; frame-ancestors 'none'";
      await route.fulfill({response,headers});
    });
    this.page=await this.context.newPage(); this.page.setDefaultTimeout(30000);
    this.page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
    this.network=[];
    this.context.on('request', request=>this.network.push({method:request.method(),url:request.url(),bodyBytes:request.postDataBuffer()?.length || 0}));
    this.page.on('websocket', socket=>this.network.push({method:'WEBSOCKET',url:socket.url()}));
    return {browserVersion:this.browser.version()};
  }
  async stop(){await this.browser?.close();}
  async navigate(url){await this.page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});}
  async setViewport(width,height){if(process.env.SORA_QA_MOBILE==='1'){width=390;height=844;} await this.page.setViewportSize({width,height});}
  async setPageZoom(){ /* Playwright sets exact CSS viewport dimensions. */ }
  async findAll(selector){return this.page.locator(selector).all();}
  async find(selector){return this.page.locator(selector).first();}
  async execute(script,args=[]){return this.page.evaluate(({script,args})=>new Function(script).apply(null,args),{script,args});}
  async executeAsync(script,args=[]){return this.page.evaluate(({script,args})=>new Promise((resolve,reject)=>{try{new Function(script).apply(null,[...args,resolve]);}catch(e){reject(e);}}),{script,args});}
  async revealPanel(selector){
    if(this.page.viewportSize().width<768){
      const panel=await this.page.locator(selector).first().evaluate(node=>node.closest('[data-workspace-inspector]')?'inspector':node.closest('[data-workspace-pages]')?'pages':node.closest('[data-workspace-canvas], [data-workspace-source]')?'canvas':null).catch(()=>null);
      if(panel){const button=this.page.locator(`[data-mobile-panel="${panel}"]`).first();if(await button.isVisible())await button.click();}
    }
    const closed=this.page.locator(selector).first().locator('xpath=ancestor::details[not(@open)]');
    for(const detail of await closed.all())await detail.locator('summary').first().click();
  }
  async click(selector){await this.revealPanel(selector);await this.page.locator(selector).first().click();}
  async setValue(selector,value,event='input'){await this.revealPanel(selector);return super.setValue(selector,value,event);}
  async check(selector){await this.revealPanel(selector);return super.check(selector);}
  async clickJs(selector){await this.revealPanel(selector);return super.clickJs(selector);}
  async waitFor(selector,options={}){if(!options.hidden)await this.revealPanel(selector);return super.waitFor(selector,options);}
  async sendKeys(selector,value,clear=false){if(clear)await this.page.locator(selector).fill(String(value));else await this.page.locator(selector).pressSequentially(String(value));}
  async setFiles(selector,files){await this.page.locator(selector).setInputFiles(files);}
  async request(path,init={}){
    if(path==='/actions'&&init.method==='DELETE')return;
    if(path==='/actions') {const names={'\uE008':'Shift','\uE014':'ArrowRight','\uE015':'ArrowDown'};for(const group of JSON.parse(init.body).actions)for(const action of group.actions){const key=names[action.value]||action.value;if(action.type==='keyDown')await this.page.keyboard.down(key);if(action.type==='keyUp')await this.page.keyboard.up(key);}return;}
    throw new Error(`Unsupported browser audit operation: ${path}`);
  }
  async dragBy(selector,dx,dy){await this.revealPanel(selector);const rect=await this.page.locator(selector).first().boundingBox();if(!rect)throw new Error(`Drag control is not visible: ${selector}`);const x=rect.x+rect.width/2,y=rect.y+rect.height/2;await this.page.mouse.move(x,y);await this.page.mouse.down();await this.page.mouse.move(x+dx,y+dy,{steps:12});await this.page.mouse.up();}
  async screenshot(path){await this.page.screenshot({path,fullPage:false});}
  async installPrivacyProbe(){this.network=[];}
  async privacyRequests(){return this.network;}
  async waitForDownload(action,options={}){const waiting=this.page.waitForEvent('download',{timeout:options.timeout||120000});await action();const download=await waiting;const path=join(this.downloadDir,`${Date.now()}-${download.suggestedFilename()}`);await download.saveAs(path);return path;}
}
