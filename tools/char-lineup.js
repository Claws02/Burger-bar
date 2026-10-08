// Renders every character (and a few skins) in a lineup for visual review.
// STEPS=tools/char-lineup.js node tools/smoke.js .smoke/chars
const path = require('path');
module.exports = async (page, OUT) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.evaluate(() => { try { endIntro(); } catch (e) {} });
  const render = async (name, skinId, carry) => {
    await page.evaluate(([skinId, carry]) => {
      document.querySelectorAll('body *').forEach(e => { e.style.visibility = 'hidden'; });
      const cv = document.getElementById('gameCanvas'); cv.style.visibility = 'visible';
      gamePaused = true;   // stop the main loop drawing over the lineup
      const sc = new THREE.Scene(); sc.background = new THREE.Color('#dfe9f2');
      sc.add(new THREE.HemisphereLight(lin('#ffffff'), lin('#8a7a6a'), .8));
      const key = new THREE.DirectionalLight(lin('#fff1dc'), 1.8); key.position.set(4, 8, 7); key.castShadow = true;
      key.shadow.camera.left = -14; key.shadow.camera.right = 14; key.shadow.camera.top = 6; key.shadow.camera.bottom = -6; sc.add(key);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 12), M('#f4efe6')); floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; sc.add(floor);
      const sk = SKIN_DEFS.find(s => s.id === skinId) || SKIN_DEFS[0];
      CHARACTERS.forEach((c, i) => {
        const p = buildCharacter(c.id, sk, { crown: skinId === 'gold' });
        p.group.position.set((i % 6 - 2.5) * 2.5 + (i < 6 ? 0 : 1.2), 0, i < 6 ? -2.4 : 1.4);
        p.group.rotation.y = -0.25;
        if (carry && p.armL) { p.armL.rotation.x = p.armR.rotation.x = -1.25; }
        sc.add(p.group);
      });
      const cam = new THREE.PerspectiveCamera(30, 1400/900, .1, 100);
      cam.position.set(0, 6, 21); cam.lookAt(0, 1.3, 0);
      renderer.setScissorTest(false); renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
      window.__lineup = () => renderer.render(sc, cam);
      window.__lineup();
    }, [skinId, carry]);
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__lineup());
    await page.screenshot({ path: path.join(OUT, name + '.png') });
  };
  await render('classic', 'classic');
  await render('space', 'space', true);
  await render('gold-crown', 'gold');
};
