// Portrait (iPhone 14/15-class) screenshot tour.
const path = require('path');
module.exports = async (page, OUT) => {
  const shot = n => page.screenshot({ path: path.join(OUT, n + '.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { try { endIntro(); } catch (e) {} });
  await page.waitForTimeout(1200); await shot('p-home');
  await page.evaluate(() => { startNextDay(); stats.spawnTimer = 0; });
  await page.waitForTimeout(9000); await shot('p-day1');
  await page.evaluate(() => { showShop && (document.getElementById('home-screen').style.display='none'); });
};
