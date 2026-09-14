const goalSelect = document.getElementById('goal');
const levelSelect = document.getElementById('level');
const sessionInput = document.getElementById('sessions');
const planOutput = document.getElementById('plan-output');

const goalMap = {
  perdre: {
    title: 'Pèrdua de greix i millora de la definició',
    detail: 'Treball de cardio, resistència i tonificació amb un volum moderat.',
  },
  tonificar: {
    title: 'Tonificació i modelat corporal',
    detail: 'Combinació d’entrenament de força i treball de core amb recuperació activa.',
  },
  força: {
    title: 'Força i hipertrofia',
    detail: 'Sessió enfocada en patrons de força, progressió de càrrega i nutrició per a guanyar massa muscular.',
  },
  resistencia: {
    title: 'Resistència i energia',
    detail: 'Cardio controlat, intervals i millora de la capacitat aeròbica i la recuperació.',
  },
};

const levelMap = {
  principiant: 'Fase d’adaptació i tècnica. Prioritza la correcta execució i la consistència.',
  intermedi: 'Fase de progressió. Incrementa la càrrega i la intensitat de manera gradual.',
  avançat: 'Fase de rendiment. Combina volum, intensitat i recuperació específica.',
};

function generatePlan(event) {
  event.preventDefault();

  const goal = goalSelect.value;
  const level = levelSelect.value;
  const sessions = Number(sessionInput.value) || 3;

  const recommended = goalMap[goal];
  const summary = `
    <p><strong>Objectiu:</strong> ${recommended.title}</p>
    <p><strong>Sessions setmanals:</strong> ${sessions}</p>
    <p><strong>Nivell:</strong> ${levelMap[level]}</p>
    <p><strong>Enfocament:</strong> ${recommended.detail}</p>
    <p><strong>Recomanació:</strong> Realitza ${Math.min(sessions, 3)} sessions de força + ${Math.max(1, sessions - 3)} sessions de cardio o mobilitat.</p>
  `;

  planOutput.innerHTML = summary;
}

document.getElementById('plan-form').addEventListener('submit', generatePlan);

document.getElementById('contact-form').addEventListener('submit', function (event) {
  event.preventDefault();

  const button = event.target.querySelector('button');
  const originalText = button.textContent;
  button.textContent = 'Consulta enviada';
  button.disabled = true;

  setTimeout(() => {
    button.textContent = originalText;
    button.disabled = false;
    event.target.reset();
  }, 2200);
});
