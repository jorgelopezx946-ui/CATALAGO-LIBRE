export default async function run(page, ui) {
  await page.locator('.tilt3d').first().click();
  await page.waitForTimeout(300);
  return await page.evaluate(() => {
    // inspeccionar el objeto onclick y las asignaciones
    const wrap = document.querySelector('.zoom-wrap');
    return {
      onclick: typeof wrap.onclick,
      onwheel: typeof wrap.onwheel,
      onmousemove: typeof wrap.onmousemove,
      js: String(wrap.onclick).includes('lightbox')
    };
  });
}
