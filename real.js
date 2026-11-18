/*
 * Night Out: real night mode.
 * A no-account safety toolkit. Everything is stored in this browser (localStorage) on this phone.
 * Heavy lifting (calls, live tracking, maps) is handed to the phone's own apps via tel:, sms:,
 * the share sheet and map links.
 */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const view = $('#view');

  /* ---------- storage (local only, never throws) ---------- */
  const store = {
    get(k, fallback) {
      try {
        const v = localStorage.getItem('nightout.' + k);
        return v ? JSON.parse(v) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set(k, v) {
      try {
        if (v == null) localStorage.removeItem('nightout.' + k);
        else localStorage.setItem('nightout.' + k, JSON.stringify(v));
      } catch (e) {
        /* storage blocked: still works for this session */
      }
    },
  };

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const telHref = (n) => 'tel:' + String(n).replace(/[^\d+]/g, '');
  const smsHref = (n, body) => 'sms:' + String(n || '').replace(/[^\d+]/g, '') + '?&body=' + encodeURIComponent(body);
  const mapsSearch = (q) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

  /* ---------- navigation ---------- */
  const TITLES = { home: 'REAL NIGHT', share: 'SHARE WHERE I AM', taxi: 'MY TAXI', check: 'CHECK THE CAR', dial: 'QUICK DIAL', safe: 'SAFE PLACES', plan: "TONIGHT'S PLAN" };

  function go(screen) {
    $('#title').textContent = TITLES[screen] || 'REAL NIGHT';
    $('#back').style.visibility = screen === 'home' ? 'hidden' : 'visible'; // keeps the header grid steady
    $('#back').onclick = () => go(screen === 'check' ? 'taxi' : 'home');
    view.innerHTML = '';
    const meta = SCREEN_META[screen];
    if (meta) html(`<div class="scr-head" style="--c:${meta[1]}"><span class="ic">${pixelIcon(meta[2])}</span><span class="stage-chip">${meta[0]}</span></div>`);
    SCREENS[screen]();
    const first = view.querySelector('button, a, input');
    if (first && screen !== 'home') first.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    try { history.replaceState(null, '', '#' + screen); } catch (e) { /* file:// may refuse */ }
  }

  function html(s) {
    view.insertAdjacentHTML('beforeend', s);
  }

  const STAGES = [
    { name: 'PLAN', c: '#c77dff', hint: 'Sort it before it happens', items: [['plan', "Tonight's plan", 'Meeting point, home-by time, group chat', 'clip']] },
    { name: 'SPOT', c: '#ffd166', hint: 'Notice the warning signs', items: [['taxi', 'Check my taxi', 'Match the plate before you get in', 'car']] },
    { name: 'ACT', c: '#3ddc84', hint: 'Do the safe thing, fast', items: [
      ['escape', 'Escape call', 'Your phone rings, and a voice talks', 'bell'],
      ['share', 'Share where I am', 'Send a friend a map pin', 'pin'],
      ['dial', 'Quick dial', '999 · 101 · 111 · your people', 'phone'],
      ['safe', 'Safe places', 'Open, lit and staffed, near you', 'shop'],
    ] },
    { name: 'REPORT', c: '#4cc9f0', hint: 'Tell someone who can act', items: [['report', 'Report it', 'Police, anonymous line, Rape Crisis', 'mega']] },
  ];
  const SCREEN_META = {
    plan: ['PLAN', '#c77dff', 'clip'], sent: ['PLAN', '#c77dff', 'clip'],
    taxi: ['SPOT', '#ffd166', 'car'], check: ['SPOT', '#ffd166', 'car'],
    escape: ['ACT', '#3ddc84', 'bell'], share: ['ACT', '#3ddc84', 'pin'], dial: ['ACT', '#3ddc84', 'phone'], safe: ['ACT', '#3ddc84', 'shop'],
    report: ['REPORT', '#4cc9f0', 'mega'],
  };

  // 10x10 pixel-art icons, drawn as crisp SVG so they match the game
  const ICONS = {
    pin: ['...####...', '..######..', '.###..###.', '.##....##.', '.###..###.', '..######..', '...####...', '....##....', '....##....', '..........'],
    car: ['..........', '...####...', '..#....#..', '.########.', '##########', '#.######.#', '##########', '.##....##.', '..........', '..........'],
    bell: ['....##....', '...####...', '..######..', '..######..', '..######..', '.########.', '##########', '..........', '....##....', '..........'],
    phone: ['..######..', '..#....#..', '..#....#..', '..#....#..', '..#....#..', '..#....#..', '..######..', '..##..##..', '..######..', '..........'],
    shop: ['....##....', '...####...', '..######..', '.########.', '##########', '.#......#.', '.#.##.#.#.', '.#.##.#.#.', '.#.##...#.', '.########.'],
    clip: ['...####...', '.##....##.', '.#.####.#.', '.#......#.', '.#.####.#.', '.#......#.', '.#.###..#.', '.#......#.', '.########.', '..........'],
    mega: ['........#.', '......###.', '....#####.', '##.######.', '##########', '##########', '##.######.', '....#####.', '......###.', '........#.'],
    lock: ['...####...', '..#....#..', '..#....#..', '.########.', '.########.', '.####.###.', '.####.###.', '.########.', '.########.', '..........'],
  };
  function pixelIcon(name) {
    const g = ICONS[name] || ICONS.pin;
    let rects = '';
    g.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`; }));
    return `<svg class="pix" viewBox="0 0 10 10" aria-hidden="true" shape-rendering="crispEdges" fill="currentColor">${rects}</svg>`;
  }
  function duration(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
  }

  /* ---------- screens ---------- */
  const SCREENS = {
    home() {
      const plan = store.get('plan', null);

      // Tonight card: countdown to home-by, or a nudge to set a plan
      if (plan && !plan.done) {
        const left = plan.homeBy - Date.now();
        const span = plan.homeBy - (plan.savedAt || plan.homeBy - 4 * 3600000);
        const pct = Math.max(0, Math.min(100, 100 - (left / span) * 100));
        html(`<section class="hero-card">
          <p class="hc-kicker">TONIGHT</p>
          <p class="hc-big">Home by ${esc(fmtTime(plan.homeBy))}</p>
          <p class="hc-sub">${left > 0 ? 'in ' + duration(left) : 'Time to check in'}${plan.meet ? ` · meet at ${esc(plan.meet)}` : ''}</p>
          <div class="hc-bar"><i style="width:${pct}%"></i></div>
        </section>`);
        view.lastElementChild.append(button("I'm home safe", 'r-btn green', () => { store.set('plan', Object.assign(plan, { done: true })); toast('Glad you’re home. Night!'); go('home'); }));
      }

      // The two tools people will actually use: no app to open at 3am
      html(`<section class="hero-card">
        <p class="hc-kicker">GOING OUT TONIGHT?</p>
        <p class="hc-big">Put your plan on your lock screen</p>
        <p class="hc-sub">Meeting point, taxi plate and who to call, right where you, a friend or a bouncer will see it. No app to open at 3am.</p>
      </section>`);
      view.lastElementChild.append(button('Make my lock screen', 'r-btn pink', () => go('lock')));
      html(`<section class="hero-card alt">
        <p class="hc-kicker">NEED TO GET AWAY?</p>
        <p class="hc-big">Escape Call</p>
        <p class="hc-sub">Your phone rings with a fake call, and a voice talks when you answer.</p>
      </section>`);
      view.lastElementChild.append(button('Set up a call', 'r-btn', () => go('escape')));

      const sos = button('', 'sos', () => go('dial'));
      sos.innerHTML = `<span class="sos-num">999</span><span><b>In danger? Get help now</b><small>Can't speak? On a mobile, press 55 when asked</small></span><span class="chev">›</span>`;
      view.append(sos);

      // The framework from the game: PLAN -> SPOT -> ACT -> REPORT
      html(`<h2 class="more">More tools</h2>`);
      html(`<div class="stepper">${STAGES.map((s) => `<span style="--c:${s.c}">${s.name}</span>`).join('<i>→</i>')}</div>`);
      STAGES.forEach((stage, n) => {
        html(`<h2 class="stage" style="--c:${stage.c}"><span>${n + 1}</span>${stage.name}<small>${stage.hint}</small></h2>`);
        const list = document.createElement('div');
        list.className = 'rows';
        stage.items.forEach(([id, label, sub, icon]) => {
          const row = document.createElement('button');
          row.type = 'button';
          row.className = 'tile row';
          row.style.setProperty('--c', stage.c);
          row.innerHTML = `<span class="ic">${pixelIcon(icon)}</span><span class="rt"><b>${esc(label)}</b><small>${esc(sub)}</small></span><span class="chev">›</span>`;
          row.addEventListener('click', () => go(id));
          list.append(row);
        });
        view.append(list);
      });
      html(`<p class="r-foot">${pixelIcon('lock')} No account. Nothing leaves this phone. Works offline once opened.</p>`);
    },

    share() {
      html(`<p class="r-lede">Send a friend a map pin of exactly where you are.</p>`);
      const status = document.createElement('div');
      status.className = 'r-stack';
      const get = button('Get my location', 'r-btn pink big', () => {
        if (!navigator.geolocation) {
          status.innerHTML = '<div class="card bad">This browser can’t get your location. Use Google Maps or WhatsApp location sharing instead.</div>';
          return;
        }
        get.textContent = 'Finding you…';
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            get.textContent = 'Update my location';
            const { latitude: la, longitude: lo, accuracy } = pos.coords;
            const link = `https://maps.google.com/?q=${la.toFixed(6)},${lo.toFixed(6)}`;
            const msg = `I'm here: ${link} (sent from Night Out at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })})`;
            status.innerHTML = `<div class="card good">Found you, accurate to about ${Math.round(accuracy)} m.</div>`;
            if (navigator.share) status.append(button('Share…', 'r-btn green', () => navigator.share({ title: 'Where I am', text: msg }).catch(() => {})));
            status.append(link_('Send by WhatsApp', 'https://wa.me/?text=' + encodeURIComponent(msg), 'r-btn'));
            const first = store.get('contacts', [])[0];
            status.append(link_(first ? `Text ${first.name}` : 'Send by text', smsHref(first ? first.num : '', msg), 'r-btn'));
            status.append(button('Copy link', 'r-btn', () => copy(msg)));
          },
          (err) => {
            get.textContent = 'Try again';
            status.innerHTML = `<div class="card bad">${err.code === 1 ? 'Location permission was blocked. Allow location for this page in your browser settings.' : 'Couldn’t get your location. Step outside or try again.'}</div>`;
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      });
      view.append(get, status);
      html(`<div class="card">For <b>live</b> tracking all the way home, use Live location in WhatsApp or Location sharing in Google Maps. They keep updating even when this page is closed.</div>`);
      view.append(link_('Open Google Maps', 'https://www.google.com/maps', 'r-btn'));
    },

    taxi() {
      const b = store.get('booking', null);
      if (!b) {
        html(`<p class="r-lede">Booked a cab? Save its details now, while you’re thinking clearly.</p>`);
        const form = document.createElement('form');
        form.className = 'r-stack';
        form.innerHTML = `
          <div class="field"><label for="plate">Number plate</label><input id="plate" required autocomplete="off" placeholder="BD21 XKM" maxlength="10"></div>
          <div class="row">
            <div class="field"><label for="car">Car</label><input id="car" placeholder="Silver Toyota"></div>
            <div class="field"><label for="driver">Driver</label><input id="driver" placeholder="Amir"></div>
          </div>
          <div class="field"><label for="firm">Taxi firm phone (optional)</label><input id="firm" type="tel" placeholder="01484 000000"></div>
          <button class="r-btn pink" type="submit">Save my booking</button>`;
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          store.set('booking', {
            plate: form.plate.value.trim().toUpperCase(),
            car: form.car.value.trim(),
            driver: form.driver.value.trim(),
            firm: form.firm.value.trim(),
            at: Date.now(),
          });
          toast('Booking saved');
          go('taxi');
        });
        view.append(form);
        html(`<p class="r-small">Never get into a car that pulls up and offers you a ride. Only use one you booked, or a licensed taxi from a rank.</p>`);
        return;
      }
      html(`<div class="card">Your booking<br><span class="plate-big">${esc(b.plate)}</span>${esc([b.car, b.driver].filter(Boolean).join(' · ')) || ''}</div>`);
      view.append(button("A car's here: check it", 'r-btn pink big', () => go('check')));
      html(`<p class="r-small">Tip: ask the driver “Who are you here for?” Make them say your name. Don’t give it to them.</p>`);
      view.append(button('Clear this booking', 'r-btn', () => { store.set('booking', null); go('taxi'); }));
    },

    check() {
      const b = store.get('booking', null);
      if (!b) return go('taxi');
      html(`<p class="r-lede">Look at the car’s number plate. Does it match exactly?</p>`);
      html(`<span class="plate-big">${esc(b.plate)}</span>`);
      if (b.car || b.driver) html(`<p class="r-small" style="text-align:center">${esc([b.car, b.driver && 'driver ' + b.driver].filter(Boolean).join(', '))}</p>`);
      const out = document.createElement('div');
      out.className = 'r-stack';
      const yes = button('Yes, it matches', 'r-btn green big', () => {
        out.innerHTML = `<div class="verdict-screen go"><h3>MATCHES</h3><p>Check the driver looks like their photo too. Then share your trip so someone knows you’re on your way.</p></div>`;
        out.append(button('Share where I am', 'r-btn', () => go('share')));
      });
      const no = button("No, it doesn't", 'r-btn red big', () => {
        out.innerHTML = `<div class="verdict-screen stop"><h3>DON'T GET IN</h3><p>Step back somewhere busy and well lit. Tell your taxi firm. If the driver won't leave you alone, call 999.</p></div>`;
        if (b.firm) out.append(link_('Call my taxi firm', telHref(b.firm), 'r-btn'));
        out.append(link_('Call 999', 'tel:999', 'r-btn red'));
      });
      view.append(yes, no, out);
    },

    dial() {
      [
        ['999', 'Emergency', 'Police, ambulance, fire', 'red'],
        ['101', 'Police non-emergency', 'Report spiking or a crime after it happened', ''],
        ['111', 'NHS 111', 'Unwell but not an emergency', ''],
      ].forEach(([num, label, sub, cls]) => {
        const a = link_('', telHref(num), 'r-btn dial ' + cls);
        a.innerHTML = `<span class="num">${num}</span><span>${esc(label)}<small>${esc(sub)}</small></span>`;
        view.append(a);
      });
      html(`<p class="r-small">Can't speak on a 999 call from a mobile? Stay on the line and press 55 when asked. It doesn't send your location.</p>`);
      html(`<h2>Your people</h2>`);
      const list = document.createElement('div');
      list.className = 'r-stack';
      const contacts = store.get('contacts', []);
      if (!contacts.length) html(`<p class="r-small">Add the people you'd call at 3am.</p>`);
      contacts.forEach((c, i) => {
        const row = document.createElement('div');
        row.className = 'contact';
        const call = link_('', telHref(c.num), 'r-btn green');
        call.textContent = 'Call ' + c.name;
        const del = button('✕', 'r-btn x', () => { contacts.splice(i, 1); store.set('contacts', contacts); go('dial'); });
        del.setAttribute('aria-label', 'Remove ' + c.name);
        row.append(call, del);
        list.append(row);
      });
      view.append(list);
      const form = document.createElement('form');
      form.className = 'r-stack';
      form.innerHTML = `
        <div class="row">
          <div class="field"><label for="cname">Name</label><input id="cname" required placeholder="Mum"></div>
          <div class="field"><label for="cnum">Number</label><input id="cnum" type="tel" required placeholder="07..."></div>
        </div>
        <button class="r-btn pink" type="submit">Add contact</button>`;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        contacts.push({ name: form.cname.value.trim(), num: form.cnum.value.trim() });
        store.set('contacts', contacts);
        toast('Contact saved on this phone');
        go('dial');
      });
      view.append(form);
    },

    safe() {
      html(`<p class="r-lede">Feel unsafe? Head for somewhere open, busy and well lit, with staff and CCTV.</p>`);
      [
        ['24-hour shops near me', '24 hour shop'],
        ['Petrol stations', 'petrol station'],
        ['Takeaways open now', 'takeaway open now'],
        ['Taxi ranks', 'taxi rank'],
        ['Police stations', 'police station'],
        ['A&E', 'accident and emergency hospital'],
      ].forEach(([label, q]) => view.append(link_(label, mapsSearch(q), 'r-btn')));
      html(`<div class="card"><b>Ask for Angela.</b> In many UK bars and clubs, asking staff for “Angela” tells them you feel unsafe. They’ll quietly help you, for example by calling you a taxi or getting you away from someone.</div>`);
    },

    plan() {
      const p = store.get('plan', null) || {};
      const contacts = store.get('contacts', []);
      html(`<p class="r-lede">Two minutes before you go out. Send it to your group chat so real people know when to chase you. If this page is open at your home-by time, it'll also ask if you're OK, but it can't contact anyone for you.</p>`);
      const form = document.createElement('form');
      form.className = 'r-stack';
      form.innerHTML = `
        <div class="field"><label for="with">Who I'm out with</label><input id="with" placeholder="Jess, Priya" value="${esc(p.with || '')}"></div>
        <div class="field"><label for="meet">Meeting point if we get split up</label><input id="meet" placeholder="Outside the kebab shop" value="${esc(p.meet || '')}"></div>
        <div class="row">
          <div class="field"><label for="homeBy">Home by</label><input id="homeBy" type="time" required value="${p.homeBy ? toTimeInput(p.homeBy) : '02:30'}"></div>
          <div class="field"><label for="who">Text who? (you send)</label><input id="who" type="tel" placeholder="07..." value="${esc(p.alert || (contacts[0] ? contacts[0].num : ''))}"></div>
        </div>
        <button class="r-btn pink" type="submit">Save tonight's plan</button>`;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const [h, m] = form.homeBy.value.split(':').map(Number);
        const due = new Date();
        due.setHours(h, m, 0, 0);
        if (due.getTime() < Date.now() - 60000) due.setDate(due.getDate() + 1); // e.g. 02:30 means tonight
        store.set('plan', { with: form.with.value.trim(), meet: form.meet.value.trim(), homeBy: due.getTime(), alert: form.who.value.trim(), done: false, alerted: false, savedAt: Date.now() });
        if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
        go('sent');
      });
      view.append(form);
      html(`<p class="r-small">Keep this page open in a tab. Phones pause web pages in the background, so for live tracking also share your location in WhatsApp or Google Maps.</p>`);
    },
  };

  SCREENS.sent = function () {
    const p = store.get('plan', null);
    if (!p) return go('plan');
    const msg = `Night Out plan: out with ${p.with || 'friends'}. ${p.meet ? `Meeting point if we split up: ${p.meet}. ` : ''}Home by ${fmtTime(p.homeBy)}. Chase me if I haven't said I'm home!`;
    html(`<div class="card good">Plan saved on this phone.</div>`);
    html(`<p class="r-lede">Now send it to your group chat. That's what actually works: real people who know when to check on you, even if your phone is locked.</p>`);
    html(`<div class="card">${esc(msg)}</div>`);
    view.append(link_('Send to WhatsApp', 'https://wa.me/?text=' + encodeURIComponent(msg), 'r-btn green big'));
    view.append(link_(p.alert ? 'Text it to your contact' : 'Send as a text', smsHref(p.alert, msg), 'r-btn'));
    if (navigator.share) view.append(button('Share another way…', 'r-btn', () => navigator.share({ text: msg }).catch(() => {})));
    view.append(button('Done', 'r-btn pink', () => go('home')));
  };
  TITLES.sent = 'PLAN SAVED';

  SCREENS.report = function () {
    html(`<p class="r-lede">Reporting helps police and venues spot patterns and stop it happening to someone else. You can report even days later.</p>`);
    [
      ['999', 'In danger right now', 'Police, ambulance', 'red'],
      ['101', 'Report to police', 'Spiking, harassment, being followed', ''],
      ['0800 555 111', 'Crimestoppers', '100% anonymous', ''],
      ['0808 500 2222', 'Rape Crisis', '24/7 support line (England & Wales)', 'green'],
    ].forEach(([num, label, sub, cls]) => {
      const a = link_('', telHref(num), 'r-btn dial ' + cls);
      a.innerHTML = `<span class="num">${num.length > 4 ? '☎' : num}</span><span>${esc(label)}<small>${esc(num.length > 4 ? num + ' · ' + sub : sub)}</small></span>`;
      view.append(a);
    });
    html(`<div class="card"><b>Spiked?</b> Report it quickly so the police can arrange a test. Some drugs leave the body within hours. Tell the venue too.</div>`);
    html(`<div class="card"><b>Sexual assault?</b> Sexual assault referral centres (SARCs) give free medical care and can store evidence while you decide whether to report. It's never your fault.</div>`);
  };
  TITLES.report = 'REPORT IT';

  /* ---------- Escape call: a fake incoming call with a ringtone, vibration and a real voice ---------- */
  let ac = null;
  let ringTimer = null;
  let callTimer = null;
  let pendingCall = null;
  function audio() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ac = new AC();
    }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  function ringOnce() {
    const a = audio();
    if (!a) return;
    const t = a.currentTime;
    // UK-style double ring: 400 + 450 Hz, on 0.4s, off 0.2s, on 0.4s
    [[0, 0.4], [0.6, 0.4]].forEach(([s, d]) => [400, 450].forEach((f) => {
      const o = a.createOscillator();
      const g = a.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + s);
      g.gain.exponentialRampToValueAtTime(0.22, t + s + 0.02);
      g.gain.setValueAtTime(0.22, t + s + d - 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + s + d);
      o.connect(g);
      g.connect(a.destination);
      o.start(t + s);
      o.stop(t + s + d + 0.05);
    }));
  }
  function startRing() {
    ringOnce();
    ringTimer = setInterval(ringOnce, 3000);
    try { if (navigator.vibrate) navigator.vibrate([400, 200, 400, 2000, 400, 200, 400, 2000, 400, 200, 400, 2000, 400, 200, 400]); } catch (e) { /* none */ }
  }
  function stopRing() {
    clearInterval(ringTimer);
    try { if (navigator.vibrate) navigator.vibrate(0); } catch (e) { /* none */ }
  }
  function speakLine(text) {
    try {
      const s = window.speechSynthesis;
      if (!s) return;
      s.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voices = s.getVoices();
      const v = voices.find((x) => /en-GB/i.test(x.lang) && /female|libby|sonia|kate|serena|hazel|susan/i.test(x.name)) || voices.find((x) => /en-GB/i.test(x.lang)) || voices.find((x) => /^en/i.test(x.lang));
      if (v) u.voice = v;
      u.rate = 1.02;
      u.pitch = 1.05;
      s.speak(u);
    } catch (e) { /* speech not available */ }
  }
  function showIncoming(name, line) {
    pendingCall = null;
    const cs = $('#callscreen');
    $('#csLabel').textContent = 'incoming call';
    $('#csAvatar').textContent = (name.trim()[0] || '?').toUpperCase();
    $('#csAvatar').className = 'cs-avatar';
    $('#csName').textContent = name;
    $('#csSub').textContent = 'mobile';
    const actions = $('#csActions');
    actions.innerHTML = '';
    const decline = button('Decline', 'cs-btn decline', endCall);
    const answer = button('Answer', 'cs-btn answer', () => {
      stopRing();
      let secs = 0;
      $('#csLabel').textContent = '00:00';
      $('#csAvatar').className = 'cs-avatar on';
      $('#csSub').textContent = '“' + line + '”';
      callTimer = setInterval(() => {
        secs++;
        $('#csLabel').textContent = String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0');
      }, 1000);
      speakLine(line);
      actions.innerHTML = '';
      actions.append(button('End call', 'cs-btn decline wide', endCall));
      actions.firstChild.focus();
    });
    actions.append(decline, answer);
    cs.hidden = false;
    startRing();
    answer.focus();
  }
  function endCall() {
    stopRing();
    clearInterval(callTimer);
    try { window.speechSynthesis.cancel(); } catch (e) { /* none */ }
    $('#callscreen').hidden = true;
    if (location.hash === '#escape') go('escape');
  }

  SCREENS.escape = function () {
    const saved = store.get('escape', { name: 'Mum', line: "Where are you? I'm outside in the car. Come out now, I need you." });
    html(`<p class="r-lede">Need a reason to leave? Your phone will ring with a fake call. When you answer, a voice talks, so it sounds real to anyone nearby.</p>`);
    if (pendingCall) {
      html(`<div class="card good">${esc(saved.name)} will call in about ${esc(pendingCall.label)}. Keep this page open and your phone unlocked.</div>`);
      view.append(button('Cancel the call', 'r-btn', () => { clearTimeout(pendingCall.t); pendingCall = null; toast('Call cancelled'); go('escape'); }));
      return;
    }
    const form = document.createElement('form');
    form.className = 'r-stack';
    form.innerHTML = `
      <div class="field"><label for="ename">Who's calling</label><input id="ename" required maxlength="24" value="${esc(saved.name)}"></div>
      <div class="field"><label for="eline">What they say</label><input id="eline" required maxlength="140" value="${esc(saved.line)}"></div>
      <div class="field"><label>Ring in</label><div class="delays">
        <button type="button" class="delay on" data-s="3">3 sec</button>
        <button type="button" class="delay" data-s="30">30 sec</button>
        <button type="button" class="delay" data-s="60">1 min</button>
        <button type="button" class="delay" data-s="300">5 min</button>
      </div></div>
      <button class="r-btn pink big" type="submit">Schedule the call</button>`;
    let delay = 3;
    form.querySelectorAll('.delay').forEach((b) => b.addEventListener('click', () => {
      form.querySelectorAll('.delay').forEach((x) => x.classList.toggle('on', x === b));
      delay = +b.dataset.s;
    }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      audio(); // unlock sound now, while we have the tap
      try { window.speechSynthesis && window.speechSynthesis.getVoices(); } catch (err) { /* none */ }
      const name = form.ename.value.trim() || 'Mum';
      const line = form.eline.value.trim();
      store.set('escape', { name, line });
      const label = delay < 60 ? delay + ' seconds' : delay / 60 + ' minute' + (delay > 60 ? 's' : '');
      pendingCall = { label, t: setTimeout(() => showIncoming(name, line), delay * 1000) };
      toast(`${name} will call in ${label}`);
      go('escape');
    });
    view.append(form);
    html(`<p class="r-small">Tip: put your phone face down, and when it rings, answer it and walk away while you're "on the phone". Keep this page open: phones pause web pages in the background.</p>`);
  };
  TITLES.escape = 'ESCAPE CALL';

  /* ---------- Lock-screen card: tonight's plan as a phone wallpaper ---------- */
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function wrapText(g, text, x, y, maxW, lh) {
    const words = String(text).split(/\s+/).filter(Boolean);
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (g.measureText(test).width > maxW && line) {
        g.fillText(line, x, y);
        y += lh;
        line = w;
      } else line = test;
    }
    if (line) {
      g.fillText(line, x, y);
      y += lh;
    }
    return y;
  }
  // 1170 x 2532 (iPhone size; Android crops the sides a little). Top ~38% is left clear for the phone's clock.
  function lockCanvas(d) {
    const W = 1170;
    const H = 2532;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1d2357');
    bg.addColorStop(0.5, '#120a1f');
    bg.addColorStop(1, '#0b0716');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    let s = 7;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 90; i++) {
      const z = rnd() < 0.2 ? 5 : 3;
      g.fillRect(rnd() * W, rnd() * 880, z, z);
    }
    const sans = '"Segoe UI", -apple-system, Roboto, Helvetica, Arial, sans-serif';
    const X = 80;
    const CW = W - 160;
    const top = 960;
    // measure-then-draw: lay the rows out first to size the card
    const rows = [];
    if (d.meet) rows.push(['If we get split up, meet at', d.meet, true]);
    if (d.with) rows.push(['Out with', d.with]);
    if (d.home) rows.push(['Home by', d.home]);
    if (d.plate) rows.push(['My taxi', d.plate, false, 'plate']);
    if (d.cname || d.cnum) rows.push(['If I need help, call', [d.cname, d.cnum].filter(Boolean).join('  ')]);
    const drawRows = (dry) => {
      let y = top + 110;
      g.font = `700 40px ${sans}`;
      if (!dry) { g.fillStyle = '#ff4fa3'; g.fillText('TONIGHT', X + 64, y); }
      y += 30;
      rows.forEach(([label, value, big, kind]) => {
        y += 56;
        g.font = `500 36px ${sans}`;
        if (!dry) { g.fillStyle = '#b8b0d8'; g.fillText(label, X + 64, y); }
        y += 70;
        if (kind === 'plate') {
          g.font = `800 64px Consolas, "Courier New", monospace`;
          const tw = g.measureText(value).width + 64;
          if (!dry) {
            g.fillStyle = '#ffd83d';
            roundRect(g, X + 64, y - 62, tw, 88, 14);
            g.fill();
            g.fillStyle = '#0b0716';
            g.fillText(value, X + 96, y + 2);
          }
          y += 40;
        } else {
          const size = big ? 66 : 54;
          g.font = `700 ${size}px ${sans}`;
          if (!dry) g.fillStyle = '#f5f3ff';
          if (dry) {
            const words = String(value).split(/\s+/);
            let line = '';
            let n = 1;
            for (const w of words) {
              const t = line ? line + ' ' + w : w;
              if (g.measureText(t).width > CW - 128 && line) { n++; line = w; } else line = t;
            }
            y += (n - 1) * (size + 10);
          } else {
            y = wrapText(g, value, X + 64, y, CW - 128, size + 10) - (size + 10);
          }
        }
      });
      return y + 80;
    };
    const bottom = Math.min(2140, drawRows(true));
    g.fillStyle = 'rgba(23,15,46,0.9)';
    roundRect(g, X, top, CW, bottom - top, 56);
    g.fill();
    g.strokeStyle = 'rgba(255,79,163,0.65)';
    g.lineWidth = 4;
    g.stroke();
    drawRows(false);
    // emergency strip
    const sy = Math.max(bottom + 40, 2100);
    g.fillStyle = '#e5484d';
    roundRect(g, X, sy, CW, 120, 40);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = `700 46px ${sans}`;
    g.textAlign = 'center';
    g.fillText("999  ·  Can't speak? Press 55", W / 2, sy + 76);
    g.font = `600 30px ${sans}`;
    g.fillStyle = 'rgba(255,79,163,0.9)';
    g.fillText('Night Out', W / 2, sy + 200);
    g.textAlign = 'left';
    return c;
  }

  SCREENS.lock = function () {
    const plan = store.get('plan', null) || {};
    const booking = store.get('booking', null) || {};
    const contacts = store.get('contacts', []);
    const d = store.get('lock', null) || {
      with: plan.with || '',
      meet: plan.meet || '',
      home: plan.homeBy ? toTimeInput(plan.homeBy) : '02:30',
      plate: booking.plate || '',
      cname: contacts[0] ? contacts[0].name : '',
      cnum: contacts[0] ? contacts[0].num : '',
    };
    html(`<p class="r-lede">Put tonight's plan where you'll actually see it. Set this as your lock screen: no app to open at 3am, and a friend or a bouncer can read it too.</p>`);
    const form = document.createElement('form');
    form.className = 'r-stack';
    form.innerHTML = `
      <div class="field"><label for="lmeet">Meeting point if we split up</label><input id="lmeet" maxlength="48" placeholder="Outside the kebab shop" value="${esc(d.meet)}"></div>
      <div class="field"><label for="lwith">Who I'm out with</label><input id="lwith" maxlength="40" placeholder="Jess, Priya" value="${esc(d.with)}"></div>
      <div class="row">
        <div class="field"><label for="lhome">Home by</label><input id="lhome" type="time" value="${esc(d.home)}"></div>
        <div class="field"><label for="lplate">Taxi plate</label><input id="lplate" maxlength="10" placeholder="BD21 XKM" value="${esc(d.plate)}"></div>
      </div>
      <div class="row">
        <div class="field"><label for="lcname">Call (name)</label><input id="lcname" maxlength="20" placeholder="Mum" value="${esc(d.cname)}"></div>
        <div class="field"><label for="lcnum">Number</label><input id="lcnum" type="tel" maxlength="16" placeholder="07..." value="${esc(d.cnum)}"></div>
      </div>`;
    view.append(form);
    const prev = document.createElement('div');
    prev.className = 'lock-preview';
    prev.innerHTML = '<img id="lockImg" alt="Preview of your lock screen">';
    view.append(prev);
    const actions = document.createElement('div');
    actions.className = 'r-stack';
    view.append(actions);
    html(`<div class="card"><b>Set it as your wallpaper:</b> save the image, then on iPhone open it in Photos › Share › Use as Wallpaper. On Android, open it in Gallery › Set as wallpaper › Lock screen.</div>`);

    let url = null;
    let blob = null;
    let queued = false;
    const read = () => ({
      meet: form.lmeet.value.trim(),
      with: form.lwith.value.trim(),
      home: form.lhome.value,
      plate: form.lplate.value.trim().toUpperCase(),
      cname: form.lcname.value.trim(),
      cnum: form.lcnum.value.trim(),
    });
    const render = () => {
      queued = false;
      const data = read();
      store.set('lock', data);
      lockCanvas(data).toBlob((b) => {
        blob = b;
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(b);
        const img = $('#lockImg');
        if (!img) return; // left the screen before the image was ready
        img.src = url;
        dl.href = url;
      }, 'image/png');
    };
    const dl = link_('Save the image', '#', 'r-btn pink big');
    dl.removeAttribute('target');
    dl.setAttribute('download', 'night-out-lock-screen.png');
    actions.append(dl);
    if (navigator.canShare) {
      actions.append(button('Share to Photos…', 'r-btn', () => {
        if (!blob) return;
        const file = new File([blob], 'night-out-lock-screen.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: 'Night Out lock screen' }).catch(() => {});
        else toast('Use Save the image instead');
      }));
    }
    form.addEventListener('input', () => { if (!queued) { queued = true; requestAnimationFrame(render); } });
    form.addEventListener('submit', (e) => e.preventDefault());
    render();
  };
  TITLES.lock = 'LOCK SCREEN';
  SCREEN_META.lock = ['PLAN', '#c77dff', 'lock'];

  /* ---------- home-by check-in ---------- */
  function checkPlan() {
    const p = store.get('plan', null);
    if (!p || p.done || p.alerted || Date.now() < p.homeBy) return;
    store.set('plan', Object.assign(p, { alerted: true }));
    const body = `I'm not home yet and haven't checked in on Night Out. ${p.meet ? `Our meeting point was ${p.meet}. ` : ''}${p.with ? `I was with ${p.with}. ` : ''}Can you call me?`;
    $('#alertText').textContent = `It's past ${fmtTime(p.homeBy)}, the time you said you'd be home.`;
    const actions = $('#alertActions');
    actions.innerHTML = '';
    actions.append(
      button("Yes, I'm home", 'r-btn green', () => { store.set('plan', Object.assign(p, { done: true })); $('#alert').hidden = true; go('home'); }),
      link_(p.alert ? 'No: text my contact' : 'No: text someone', smsHref(p.alert, body), 'r-btn red'),
      button('Not yet, remind me in 15 min', 'r-btn', () => { store.set('plan', Object.assign(p, { alerted: false, homeBy: Date.now() + 15 * 60000 })); $('#alert').hidden = true; })
    );
    $('#alert').hidden = false;
    actions.firstChild.focus();
    try {
      if ('Notification' in window && Notification.permission === 'granted') new Notification('Are you home safe?', { body: 'Tap to check in on Night Out.' });
    } catch (e) { /* notifications unavailable */ }
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  }

  /* ---------- helpers ---------- */
  function button(label, cls, fn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }
  function link_(label, href, cls) {
    const a = document.createElement('a');
    a.className = cls;
    a.href = href;
    a.textContent = label;
    if (/^https?:/.test(href)) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    return a;
  }
  function copy(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Copied'), () => toast(text));
    else toast(text);
  }
  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  function toTimeInput(ts) {
    const d = new Date(ts);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /* ---------- start ---------- */
  const start = (location.hash || '#home').slice(1);
  go(SCREENS[start] ? start : 'home');
  function tick() {
    $('#clock').textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  tick();
  setInterval(tick, 30000);
  checkPlan();
  setInterval(checkPlan, 20000);
  // Check on every visibility change: coming back to the tab, or the phone locking (notification still fires)
  document.addEventListener('visibilitychange', checkPlan);
  window.addEventListener('focus', checkPlan);

  // Offline + add-to-home-screen when served over https (service workers don't run from file://)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
