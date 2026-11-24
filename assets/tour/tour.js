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

const promptChoice = document.getElementById('promptChoice');
const prompts = Array.from(document.querySelectorAll('.tourQuestions > fieldset'));
function showFieldPrompt() {
  prompts.forEach((prompt, index) => {
    const hidden = index !== promptChoice.selectedIndex;
    prompt.hidden = hidden;
    document.getElementById('qf' + index).hidden = hidden;
  });
}
const promptNames = ['Hose drips', 'Monitoring activity', 'Engineering controls',
  'Respiratory protection', 'Worker position', 'Interruptions'];
prompts.forEach((prompt, index) => {
  promptChoice.add(new Option((index + 1) + ' / ' + prompts.length + ' · ' + promptNames[index], String(index)));
});
promptChoice.addEventListener('change', showFieldPrompt);
showFieldPrompt();

document.querySelectorAll('[data-hazard]').forEach(button => {
  button.addEventListener('click', () => {
    document.getElementById('hazSel').value = button.dataset.hazard;
    hazChange();
    document.getElementById('valIn').value = button.dataset.value;
    logResult();
  });
});
