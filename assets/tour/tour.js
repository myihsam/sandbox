document.querySelectorAll('[data-switch]').forEach(group => {
  const buttons = group.querySelectorAll('[data-panel-id]');
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      buttons.forEach(option => {
        const selected = option === button;
        option.setAttribute('aria-pressed', String(selected));
        document.getElementById(option.dataset.panelId).hidden = !selected;
      });
    });
  });
});

const questions = document.querySelector('.tourQuestions');
function countAnswers() {
  const pending = [...questions.querySelectorAll('fieldset')].filter(group =>
    !group.querySelector(':checked') && !group.querySelector('textarea')?.value.trim()).length;
  const counter = document.getElementById('qCount');
  counter.textContent = pending + ' remaining';
  counter.setAttribute('role','status');
}
questions.addEventListener('input',countAnswers);
countAnswers();

document.querySelectorAll('[data-hazard]').forEach(button => {
  button.addEventListener('click', () => {
    document.getElementById('hazSel').value = button.dataset.hazard;
    hazChange();
    document.getElementById('valIn').value = button.dataset.value;
    logResult();
  });
});

function tourDialog(title) {
  const dialog = document.createElement('dialog');
  dialog.className = 'sampleWindow';
  dialog.setAttribute('aria-label', title);
  const header = document.createElement('div');
  header.className = 'sampleBar';
  const heading = document.createElement('strong');
  heading.textContent = title;
  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close ' + title);
  close.textContent = '×';
  close.onclick = () => dialog.close();
  header.append(heading, close);
  const body = document.createElement('div');
  body.className = 'sampleWindowBody';
  dialog.append(header, body);
  document.getElementById('sandbox').append(dialog);
  dialog.addEventListener('close', () => dialog.remove(), {once:true});
  return {dialog, body};
}

let endTime = '10:00';
const timeDisplay = document.getElementById('pickTime');
function formatTime(value) {
  const [hour, minute] = value.split(':');
  return (Number(hour) % 12 || 12) + ':' + minute + (Number(hour) < 12 ? ' AM' : ' PM');
}
timeDisplay.onclick = () => {
  const {dialog, body} = tourDialog('Select time');
  dialog.classList.add('clockWindow');
  body.innerHTML = '<label>End time <input required type="time"></label><div class="clockDial" aria-label="Choose time on clock"></div><div class="clockActions"><button type="button">Cancel</button><button class="btn" type="button">OK</button></div>';
  const field = body.querySelector('input');
  const dial = body.querySelector('.clockDial');
  field.value = endTime;
  let selectingHour = true;
  function draw() {
    const [hour, minute] = (field.value || endTime).split(':').map(Number);
    dial.replaceChildren();
    for(let i=0;i<12;i++){
      const button = document.createElement('button');
      const number = selectingHour ? (i || 12) : i*5;
      button.textContent = selectingHour ? number : String(number).padStart(2,'0');
      button.setAttribute('aria-label', number + (selectingHour ? ' hours' : ' minutes'));
      const active = selectingHour ? i === hour%12 : number === minute;
      button.setAttribute('aria-pressed', String(active));
      button.style.left = (50 + 39*Math.sin(i*Math.PI/6)) + '%';
      button.style.top = (50 - 39*Math.cos(i*Math.PI/6)) + '%';
      button.onclick = () => {
        const h = selectingHour ? i+(hour>=12?12:0) : hour;
        field.value = String(h).padStart(2,'0') + ':' + String(selectingHour ? minute : number).padStart(2,'0');
        selectingHour = !selectingHour;
        draw();
        dial.querySelector('[aria-pressed=true]')?.focus();
      };
      dial.append(button);
    }
  }
  field.oninput = draw;
  body.querySelector('.clockActions button').onclick = () => dialog.close();
  body.querySelector('.clockActions .btn').onclick = () => {
    if (!field.reportValidity()) return;
    endTime = field.value;
    timeDisplay.textContent = formatTime(endTime);
    dialog.close();
  };
  draw();
  dialog.showModal();
};

function showRecord(record) {
  const {dialog, body} = tourDialog(record.id);
  const title = document.createElement('h2');
  title.textContent = record.id;
  body.append(title);
  function section(label, lines) {
    const area = document.createElement('section');
    if (label) {
      const h = document.createElement('h3');
      h.textContent = label;
      area.append(h);
    }
    lines.forEach(line => {
      const p=document.createElement('p');
      p.textContent=line;
      area.append(p);
    });
    body.append(area);
  }
  section('', ['Sample type: ' + record.type, 'Sampler: ' + record.sampler]);
  section(record.instrument, record.equipment);
  section('Hazards', [record.hazard]);
  section('Current status: ' + record.status, []);
  section('Sample times', []);
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Start</th><th>End</th><th>Duration</th></tr></thead>';
  const row = table.createTBody().insertRow();
  [record.start, record.end || '—', record.duration ? record.duration+' min' : '—'].forEach(value => row.insertCell().textContent=value);
  body.append(table);
  section('Last check', [record.lastCheck || 'Has not been checked']);
  if (record.flow) section('Flow rate',record.flow);
  if (record.twa) section('TWA method',[record.twa]);
  section('Sample results', record.results);
  dialog.showModal();
}

document.getElementById('finishDemo').onsubmit = event => {
  event.preventDefault();
  const [h,m] = endTime.split(':').map(Number);
  const overnight = document.getElementById('overnight').checked;
  const duration = h*60+m-480+(overnight?1440:0);
  const status = document.getElementById('finishStatus');
  if (duration <= 0 || duration > 1440) {
    status.textContent = 'Choose an end time within 24 hours after the 8:00 AM start. Select Overnight for a finish on the next day.';
    timeDisplay.focus();
    return;
  }
  const final = Number(document.getElementById('finalFlow').value);
  const average = (0.05+final)/2;
  status.textContent = 'Sample finished · '+duration+' min · '+(duration*average).toFixed(3)+' L';
  showRecord({id:'#BR-062124-001', type:'personal task sample', sampler:'Sam Garrison', instrument:'SKC Pocket Pump TOUCH',
    equipment:['Serial: P-014','Calibrated using: SKC chek-mate FC-02','Sample media: charcoal tube · lot CT-2406'],
    hazard:'Toluene and o-xylene', status:'Finished', start:'8:00 AM', end:formatTime(endTime)+(overnight?' (+1 day)':''), duration,
    lastCheck:'Post-sample flow check at '+formatTime(endTime), twa:event.target.elements.twa.value,
    flow:['Initial: 0.050 L/min','Final: '+final.toFixed(3)+' L/min','Average: '+average.toFixed(3)+' L/min','Volume: '+(average*duration).toFixed(3)+' L'],
    results:duration===120 && final===0.05 ? ['Toluene · 8.0 ppm','o-Xylene · 3.0 ppm','Method: NIOSH 1501'] : ['No laboratory results for this edited example.']});
};

document.addEventListener('click', event => {
  const button = event.target.closest('[data-open-record]');
  if (!button) return;
  const card = button.closest('.sampleCard');
  const lines = card.querySelector('.sampleLines').innerText.split('\n').map(s=>s.trim());
  const field = prefix => (lines.find(line=>line.startsWith(prefix)) || '').split(': ').slice(1).join(': ').replace(/,$/,'');
  const id = card.querySelector('.sampleTop b').textContent;
  const completed = id === '#SG-050224-01';
  const instrument = card.querySelector('.skc').textContent;
  const manganese = field('Hazards').startsWith('Manganese');
  showRecord({id, type:field('Sample type'), sampler:'Sam Davidson', instrument,
    equipment:manganese ? ['Sample media: filter cassette','Calibration: pump flow verified'] : [field('Sample type')],
    hazard:field('Hazards') || field('Hazard'), status:completed?'Finished':lines.at(-1).replace(/\.$/,''),
    start:(field('Start time')||field('Collected')||field('Logged')).split(' (')[0],
    end:completed?'2:55 PM':null,duration:completed?480:null,lastCheck:field('Last check'),
    flow:manganese?['Initial: 2.000 L/min'].concat(completed?['Final: 2.000 L/min','Average: 2.000 L/min','Volume: 960.000 L']:[]):null,
    results:completed?['Manganese · 0.014 mg/m³ (example result)']:['No laboratory result entered.']});
});
