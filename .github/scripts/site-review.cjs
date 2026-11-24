const fs = require('node:fs');
const { chromium } = require('playwright-core');
const base = process.argv[2];
const output = process.argv[3];
fs.mkdirSync(output, { recursive: true });

async function visit(browser, width) {
  const context = await browser.newContext({
    viewport: { width, height: width === 375 ? 812 : width === 768 ? 1024 : 900 },
    hasTouch: width < 1000, reducedMotion: 'reduce'
  });
  const page = await context.newPage();
  page.setDefaultTimeout(3500);
  const checks = [];
  const errors = [];
  const consoleErrors = [];
  page.on('console', msg => { if(msg.type()==='error') consoleErrors.push(msg.text().slice(0,240)); });
  page.on('pageerror', error => errors.push(error.message));
  const check = async (label, fn) => {
    try { await fn(); checks.push({ label, pass: true }); }
    catch (error) { checks.push({ label, pass: false, error: String(error.message).split('\n').slice(0,18).join(' ') }); }
  };
  const click = selector => page.locator(selector).first().click();
  await page.goto(base, {waitUntil:'domcontentloaded'});
  await check('cookie preferences, reject analytics', async () => {
    await click('#myihManage');
    await page.keyboard.press('Tab');
    if (!await page.locator('#myihPrefs').evaluate(el=>el.contains(document.activeElement))) throw Error('Focus escaped preferences');
    await click('#myihClosePrefs'); await click('#myihRejectAll');
  });
  await check('menu and Escape', async () => { await click('#lpMenuBtn'); await page.keyboard.press('Escape'); });
  await check('FAQ topic and question', async () => {
    await click('.productQAGroup summary'); await click('.productQAItem summary');
  });
  await check('no page-wide overflow', async () => {
    const extra = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if(extra > 1) throw Error('Overflow '+extra+'px');
  });
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  const audit = async () => page.evaluate(async () => (await axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id, count:v.nodes.length, examples:v.nodes.slice(0,2).map(n=>n.target)})));
  const homepage = await audit();
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:output+'/hero-'+width+'.png',timeout:15000});
  await check('hero preview overlay', async () => {await click('.brandActions button'); await page.locator('#sandboxModal[open]').waitFor();});
  await check('start tour', async () => {await click('.tourStart button');});
  await check('back and next', async () => {await click('#backBtn');await click('.tourStart button');});
  for(let step=2;step<8;step++) {
    if(step===5) {
      await check('project questions', async () => {await click('.svTabs:visible button[data-view=questions]'); await click('#gContentContainer summary');
        const form=page.locator('#gContentContainer details[open] form').first();
        const field=form.locator('textarea').first();
        await field.fill('Example field observation'); await form.locator('button').click();
        if(!(await form.locator('[role=status]').innerText()).includes('saved')) throw Error('Answers did not save');});
      await check('project config example download', async () => {
        await click('.svTabs:visible button[data-view=proj_info]');
        const forms=page.locator('#gContentContainer form');
        if(await forms.count()!==3) throw Error('Expected three example downloads');
        for(const form of await forms.all()){
          await form.locator('input').first().fill('2026-03-01');
          await form.locator('input').last().fill('2026-07-31');
          const [download]=await Promise.all([page.waitForEvent('download',{timeout:3500}),form.locator('button').click()]);
          const csv=fs.readFileSync(await download.path(),'utf8');
          if(!csv.includes('Sample ID') || !csv.includes('#SG-062124-') || csv.includes('#XZY-')) throw Error('Unexpected project in export');
        }
      });
    }
    await check('next to step '+(step+1), async () => {
      await click('#nextBtn');
      if(await page.locator('.slide').nth(step).evaluate(el=>!el.matches('.active')))throw Error('Unexpected step');
    });
  }
  await check('explore workspace', async () => {await click('.slide.active button[onclick="enterExplore()"]');});
  await check('open sample band and dismiss', async () => {await click('#hdash .hseg');await click('.sampleDialogClose');});
  await page.screenshot({path:output+'/workspace-'+width+'.png',timeout:15000});
  const workspace = await audit();
  await check('workspace lists', async () => {
    for (const name of ['clients','projects','samples','media','instruments','calibration','questions']) {
      if(await page.locator('.workspacePicker').isVisible()) await page.locator('.workspacePicker').selectOption(name);
      else await click('#exNav [data-tab="'+name+'"]');
      await page.locator('#exMain tbody tr').first().waitFor();
    }
  });
  await check('close preview and reopen at sample sheet',async () => {
    await click('#closePreview');await click('.sampleExport button');await page.locator('.slide--report.active').waitFor();
    await page.screenshot({path:output+'/report-'+width+'.png',timeout:15000});
    await page.keyboard.press('Escape');
  });
  await check('second preview button',async () => {await click('.recordExportIntro button');await click('#closePreview');});
  await check('footer cookie settings',async () => {await click('#myihPrefsOpen');await page.keyboard.press('Escape');});
  const links = await page.locator('a[href]').evaluateAll(links=>[...new Set(links.map(a=>a.href))].filter(url=>/^https?:/.test(url)));
  const destinations=[];
  for(const url of links) {
    try{
      const response=await context.request.get(url.split('#')[0],{timeout:10000});
      destinations.push([url,response.status()]);await response.dispose();
    } catch(e){destinations.push([url,0]);}
  }
  for (const path of ['blog.html','deck.html','accessibility.html','privacy.html']) {
    await check(path, async () => {
      const r=await page.goto(new URL(path,base).href,{waitUntil:'domcontentloaded'});
      if(!r.ok())throw Error('HTTP '+r.status());
      await page.locator('h1').first().waitFor();
      if(path==='deck.html'){
        const pdf=await page.locator('a[href*=".pdf" i]').first().getAttribute('href');
        const response=await context.request.get(new URL(pdf,page.url()).href);
        if(!response.ok())throw Error('PDF '+response.status());
      }
      if(path==='blog.html'){
        const article=page.locator('main a[href$=".html"]').first();
        await article.click();await page.locator('h1').first().waitFor();
      }
    });
  }
  await context.close();
  return {width, checks, errors, consoleErrors, homepage, workspace, destinations};
}

(async () => {
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  try {
    const data=await Promise.all([1440,768,375].map(w=>visit(browser,w)));
    fs.writeFileSync(output+'/audit.json',JSON.stringify(data,null,2));
    for(const row of data) console.log(row.width,row.checks.filter(c=>c.pass).length+'/'+row.checks.length,JSON.stringify(row.checks.filter(c=>!c.pass)),JSON.stringify(row.homepage));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
