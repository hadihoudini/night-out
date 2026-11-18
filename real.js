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
    $('#back').hidden = screen === 'home';
    $('#back').onclick = () => go(screen === 'check' ? 'taxi' : 'home');
    view.innerHTML = '';
    SCREENS[screen]();
    const first = view.querySelector('button, a, input');
    if (first && screen !== 'home') first.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    try { history.replaceState(null, '', '#' + screen); } catch (e) { /* file:// may refuse */ }
  }

  function html(s) {
    view.insertAdjacentHTML('beforeend', s);
  }

  /* ---------- screens ---------- */
  const SCREENS = {
    home() {
      const plan = store.get('plan', null);
      html(`<p class="r-lede">Your toolkit for tonight. You practised all of this in the game. Nothing leaves this phone.</p>`);
      if (plan && !plan.done) {
        html(`<div class="card">Home by <b>${esc(fmtTime(plan.homeBy))}</b>${plan.meet ? ` · Meeting point: <b>${esc(plan.meet)}</b>` : ''}</div>`);
        const b = button("I'm home safe", 'r-btn green', () => { store.set('plan', Object.assign(plan, { done: true })); toast('Glad you’re home. Night!'); go('home'); });
        view.append(b);
      }
      const tiles = document.createElement('div');
      tiles.className = 'tiles';
      [
        ['share', 'Share where I am', '#3fa7d6', '◉'],
        ['taxi', 'My taxi', '#ffd166', '▣'],
        ['dial', 'Quick dial', '#ff5a5a', '999'],
        ['safe', 'Safe places', '#3ddc84', '✚'],
        ['plan', "Tonight's plan", '#c77dff', '✎', true],
      ].forEach(([id, label, col, icon, wide]) => {
        const t = document.createElement('button');
        t.type = 'button';
        t.className = 'tile' + (wide ? ' wide' : '');
        t.innerHTML = `<span class="ic${icon.length > 1 ? ' txt' : ''}" style="background:${col}">${icon}</span><span>${esc(label)}</span>`;
        t.addEventListener('click', () => go(id));
        tiles.append(t);
      });
      view.append(tiles);
      html(`<p class="r-small">In danger? Call 999. Can't speak? On a mobile, call 999 and press 55 when asked so the police know it's a real emergency. It doesn't send your location, so whisper where you are if you can.</p>`);
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
          <div class="field"><label for="who">Who to text (you send it)</label><input id="who" type="tel" placeholder="07..." value="${esc(p.alert || (contacts[0] ? contacts[0].num : ''))}"></div>
        </div>
        <button class="r-btn pink" type="submit">Save tonight's plan</button>`;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const [h, m] = form.homeBy.value.split(':').map(Number);
        const due = new Date();
        due.setHours(h, m, 0, 0);
        if (due.getTime() < Date.now() - 60000) due.setDate(due.getDate() + 1); // e.g. 02:30 means tonight
        store.set('plan', { with: form.with.value.trim(), meet: form.meet.value.trim(), homeBy: due.getTime(), alert: form.who.value.trim(), done: false, alerted: false });
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
  checkPlan();
  setInterval(checkPlan, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkPlan(); });

  // Offline + add-to-home-screen when served over https (service workers don't run from file://)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
