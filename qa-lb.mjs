export default async function run(page, ui) {
  // Darle foto al primer producto demo si no tiene
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('catalogo_pro_v2'));
    if (!db.products[0].image) {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect fill="#348bff" width="600" height="400"/><text x="300" y="220" font-size="60" text-anchor="middle" fill="white">FOTO TEST</text></svg>';
      db.products[0].image = 'data:image/svg+xml;base64,' + btoa(svg);
      localStorage.setItem('catalogo_pro_v2', JSON.stringify(db));
    }
  });
  await page.reload();
  await page.waitForSelector('.tilt3d');
  // Clic en la foto de la tarjeta
  await page.locator('.tilt3d .product-image').first().click();
  await page.waitForTimeout(300);
  const lb1 = await page.evaluate(() => !!document.getElementById('lightbox'));
  // Cerrar y probar desde el detalle
  if (lb1) await page.evaluate(() => document.getElementById('lightbox').remove());
  await page.locator('.tilt3d').first().click();
  await page.waitForTimeout(300);
  const detail = await page.evaluate(() => !!document.getElementById('zoomImg'));
  if (detail) {
    await page.locator('.zoom-wrap').click();
    await page.waitForTimeout(300);
  }
  const lb2 = await page.evaluate(() => !!document.getElementById('lightbox'));
  return { lightboxDesdeTarjeta: lb1, detalleAbre: detail, lightboxDesdeDetalle: lb2 };
}
