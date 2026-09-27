/* EchoOrbit mouth diagram renderer.

   Draws "how do I make this sound?" as a simple front-view mouth:
   jaw opening, lip rounding, tongue position, teeth contact, nasal
   airflow, and whether the vocal cords buzz. Every field comes from the
   `mouth` / `voiced` / `air` data in progression.js, so adding a new
   phoneme needs no new drawing code.

   This is the part that actually teaches articulation -- matching a
   symbol only works if the kid can also shape the sound. */

function mouthCaption(p){
  const parts = [];
  if (p.mouth) {
    const open = p.mouth.open;
    if (p.mouth.round > 0.5){
      // Rounding is the defining feature here, so lead with it rather
      // than also reporting a near-closed jaw.
      parts.push(open < 0.25 ? 'lips pushed into a small circle'
                             : 'lips rounded and open');
    } else {
      parts.push(open < 0.05 ? 'lips closed'
        : open < 0.25 ? 'lips almost closed'
        : open < 0.5 ? 'mouth half open'
        : open < 0.75 ? 'mouth open'
        : 'mouth wide open');
    }
  }
  if (p.mouth && p.mouth.tongueOut) parts.push('tongue tip between the teeth');
  else if (p.mouth) {
    const x = p.mouth.tongue.x;
    parts.push(x < 0.35 ? 'tongue forward' : x < 0.65 ? 'tongue in the middle' : 'tongue back');
  }
  if (p.air === 'nose') parts.push('air out through the nose');
  parts.push(p.voiced ? 'voice buzzes' : 'no buzz, just air');
  return parts.join(', ');
}

function mouthSvg(p, size){
  const s = size || 120;
  const uid = 'mth' + Math.random().toString(36).slice(2, 8);
  const m = p.mouth || { open: 0.5, round: 0.1, tongue: { x: 0.5, y: 0.5 } };

  const cx = 50, cy = 56;
  const rx = 27 * (1 - 0.34 * (m.round || 0));
  const ry = 2.5 + 23 * (m.open || 0);

  const tongueX = cx + (m.tongue.x - 0.5) * rx * 1.5;
  const tongueY = cy + (m.tongue.y - 0.5) * ry * 1.3;
  const tongueRx = Math.max(rx * 0.62, 7);
  const tongueRy = Math.max(ry * 0.55, 6.5);

  const teeth = m.teeth ? `
    <rect x="${cx - rx * 0.82}" y="${cy - ry}" width="${rx * 1.64}" height="${Math.min(5.5, Math.max(ry * 0.42, 2.5))}" rx="1.5" fill="#F5EFE0" opacity="0.92"/>
    <rect x="${cx - rx * 0.82}" y="${cy + ry - Math.min(5.5, Math.max(ry * 0.42, 2.5))}" width="${rx * 1.64}" height="${Math.min(5.5, Math.max(ry * 0.42, 2.5))}" rx="1.5" fill="#F5EFE0" opacity="0.92"/>` : '';

  // The tongue stays clipped inside the mouth, except for /th/, where
  // the tip visibly sticks out between the teeth.
  const tongueIn = `<ellipse cx="${tongueX.toFixed(1)}" cy="${tongueY.toFixed(1)}" rx="${tongueRx.toFixed(1)}" ry="${tongueRy.toFixed(1)}" fill="#E0708A"/>`;
  const tongueOut = m.tongueOut
    ? `<ellipse cx="${cx.toFixed(1)}" cy="${(cy + ry + 2).toFixed(1)}" rx="${(tongueRx * 0.75).toFixed(1)}" ry="${Math.min(tongueRy, 5).toFixed(1)}" fill="#E0708A"/>`
    : '';

  // Nasal airflow arrow, drawn only for /m/ and /ng/.
  const nose = p.air === 'nose' ? `
    <path d="M50 30 L50 16" stroke="#FAC775" stroke-width="2" stroke-dasharray="3 3" stroke-linecap="round"/>
    <path d="M46 20 L50 14 L54 20" stroke="#FAC775" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="60" y="18" fill="#FAC775" font-size="9" font-family="Atkinson Hyperlegible, sans-serif">nose</text>` : '';

  // Vocal cord buzz indicator.
  const buzz = `<g opacity="0.9">
    <path d="M14 62 a10 10 0 0 1 0 -14" stroke="${p.voiced ? '#5DCAA5' : '#6E6886'}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M8 66 a16 16 0 0 1 0 -22" stroke="${p.voiced ? '#5DCAA5' : '#6E6886'}" stroke-width="2" fill="none" stroke-linecap="round" opacity="${p.voiced ? 0.7 : 0.35}"/>
    <text x="6" y="84" fill="${p.voiced ? '#5DCAA5' : '#AEA7BF'}" font-size="9" font-family="Atkinson Hyperlegible, sans-serif">${p.voiced ? 'buzz' : 'air'}</text>
  </g>`;

  return `<svg class="mouth-diagram" width="${s}" height="${s}" viewBox="0 0 100 100"
      role="img" aria-label="Mouth position for ${p.ipa}: ${mouthCaption(p)}">
    <defs><clipPath id="${uid}"><ellipse cx="${cx}" cy="${cy}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}"/></clipPath></defs>
    <circle cx="50" cy="52" r="42" fill="none" stroke="rgba(245,239,224,0.14)" stroke-width="1.5"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="#2B1526"/>
    <g clip-path="url(#${uid})">${tongueIn}</g>
    ${teeth}
    ${tongueOut}
    <ellipse cx="${cx}" cy="${cy}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="none" stroke="#F0997B" stroke-width="4"/>
    ${nose}
    ${buzz}
  </svg>`;
}
