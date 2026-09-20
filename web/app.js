const core = window.Patrullbyggare;
const csvLintApi = window.PatrullbyggareCsvLint;
const visualizationApi = window.PatrullbyggareVisualizations;
const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
const fileInput = document.querySelector('#csv-file');
const dropZone = document.querySelector('#drop-zone');
const selectedFile = document.querySelector('#selected-file');
const csvText = document.querySelector('#csv-text');
const targetSizeInput = document.querySelector('#target-size');
const messages = document.querySelector('#messages');
const resultsSection = document.querySelector('#results');
const statistics = document.querySelector('#statistics');
const patrolGrid = document.querySelector('#patrol-grid');
const resultGraph = document.querySelector('#result-graph');
const relationDiagram = document.querySelector('.visualization');
const csvFormatDialog = document.querySelector('#csv-format-dialog');
const showCsvFormat = document.querySelector('#show-csv-format');
const closeCsvFormat = document.querySelector('#close-csv-format');

const basePatrolsSection = document.querySelector('#base-patrols-section');
const basePatrolsSummaryText = document.querySelector('#base-patrols-summary-text');
const labelNewPatrolsTarget = document.querySelector('#label-new-patrols-target');
const descNewPatrolsTarget = document.querySelector('#desc-new-patrols-target');
const descNewPatrolsFill = document.querySelector('#desc-new-patrols-fill');

let activeMode = 'upload';
let uploadedCsv = '';
let graphUrl;
let downloads = {};

function selectTab(tab) {
    activeMode = tab.dataset.tab;
    tabs.forEach(candidate => {
        const selected = candidate === tab;
        candidate.setAttribute('aria-selected', String(selected));
        candidate.tabIndex = selected ? 0 : -1;
        document.querySelector(`#${candidate.getAttribute('aria-controls')}`).hidden = !selected;
    });
    updateBasePatrolsVisibility();
}

tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        const offset = event.key === 'ArrowRight' ? 1 : -1;
        const nextTab = tabs[(index + offset + tabs.length) % tabs.length];
        selectTab(nextTab);
        nextTab.focus();
    });
});

showCsvFormat.addEventListener('click', () => csvFormatDialog.showModal());
closeCsvFormat.addEventListener('click', () => csvFormatDialog.close());
csvFormatDialog.addEventListener('click', event => {
    if (event.target === csvFormatDialog) csvFormatDialog.close();
});

function showMessages(items) {
    messages.replaceChildren();
    messages.hidden = items.length === 0;
    if (items.length === 0) return;

    const heading = document.createElement('strong');
    heading.textContent = items.length === 1
        ? 'Kontrollera följande:'
        : `Kontrollera följande ${items.length} saker:`;
    messages.append(heading);

    const list = document.createElement('ul');
    items.forEach(item => {
        const listItem = document.createElement('li');
        listItem.textContent = item;
        list.append(listItem);
    });
    messages.append(list);
}

function updateDynamicTargetText() {
    const targetSize = parseInt(targetSizeInput ? targetSizeInput.value : 5, 10) || 5;
    const minSize = Math.max(2, targetSize - 1);
    const maxSize = targetSize + 1;

    if (labelNewPatrolsTarget) {
        labelNewPatrolsTarget.textContent = `Håll patrullerna nära ${targetSize} scouter`;
    }
    if (descNewPatrolsTarget) {
        descNewPatrolsTarget.textContent = `Patrullerna får innehålla ${minSize}–${maxSize} scouter. Nya patruller kan skapas även om befintliga patruller fortfarande har plats.`;
    }
    if (descNewPatrolsFill) {
        descNewPatrolsFill.textContent = `Befintliga patruller fylls upp till ${maxSize} scouter innan en ny skapas.`;
    }
}

if (targetSizeInput) {
    targetSizeInput.addEventListener('input', updateDynamicTargetText);
}

function getActiveCsvContent() {
    const val = activeMode === 'upload' ? uploadedCsv : (csvText ? csvText.value : '');
    return val || '';
}

function resetBasePatrolsControls() {
    const lockedRadio = document.querySelector('input[name="base-patrols-mode"][value="locked"]');
    if (lockedRadio) lockedRadio.checked = true;

    const targetRadio = document.querySelector('input[name="new-patrols-mode"][value="target-size"]');
    if (targetRadio) targetRadio.checked = true;
}

function updateBasePatrolsVisibility() {
    if (!basePatrolsSection) return;
    const content = getActiveCsvContent();
    if (!content.trim()) {
        basePatrolsSection.hidden = true;
        resetBasePatrolsControls();
        return;
    }

    try {
        const scouts = core.parseCsv(content);
        const basePatrols = scouts.basePatrols || new Map();
        if (basePatrols.size > 0) {
            const uniquePatrols = new Set(basePatrols.values());
            const patrolCount = uniquePatrols.size;
            const scoutCount = basePatrols.size;
            const patrolWord = patrolCount === 1 ? 'befintlig patrull' : 'befintliga patruller';
            const scoutWord = scoutCount === 1 ? 'placerad scout' : 'placerade scouter';

            if (basePatrolsSummaryText) {
                basePatrolsSummaryText.textContent = `Vi hittade ${patrolCount} ${patrolWord} med ${scoutCount} ${scoutWord}. Välj hur de ska användas när resten av gruppen delas in.`;
            }
            basePatrolsSection.hidden = false;
        } else {
            basePatrolsSection.hidden = true;
            resetBasePatrolsControls();
        }
    } catch {
        basePatrolsSection.hidden = true;
        resetBasePatrolsControls();
    }
}

csvText.addEventListener('input', updateBasePatrolsVisibility);

async function useFile(file) {
    if (!file) return;
    if (!file.name.toLocaleLowerCase('sv-SE').endsWith('.csv')) {
        showMessages(['Välj en fil som slutar på .csv.']);
        return;
    }

    try {
        uploadedCsv = await file.text();
        selectedFile.textContent = `${file.name} är redo`;
        showMessages([]);
        updateBasePatrolsVisibility();
    } catch (error) {
        showMessages([`Filen kunde inte läsas: ${error.message}`]);
    }
}

fileInput.addEventListener('change', () => useFile(fileInput.files[0]));

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, event => {
        event.preventDefault();
        dropZone.classList.add('is-dragging');
    });
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, event => {
        event.preventDefault();
        dropZone.classList.remove('is-dragging');
    });
});

dropZone.addEventListener('drop', event => useFile(event.dataTransfer.files[0]));

function createStatistic(label, value) {
    const wrapper = document.createElement('div');
    wrapper.className = 'statistic';
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    wrapper.append(term, description);
    return wrapper;
}

function renderPatrols(patrols, result) {
    const statsList = [
        createStatistic('Scouter', result.statistics.scoutCount),
        createStatistic('Patruller', patrols.length),
        createStatistic('Önskemål uppfyllda', `${result.statistics.satisfiedPercentage}%`),
    ];

    if (result.statistics.totalBaseMembers > 0) {
        statsList.push(createStatistic(
            'Behållna i grundpatrull',
            `${result.statistics.retainedBaseMembers} / ${result.statistics.totalBaseMembers}`
        ));
    }

    statistics.replaceChildren(...statsList);
    patrolGrid.replaceChildren();

    patrols.forEach((patrol, index) => {
        const card = document.createElement('article');
        card.className = 'patrol-card';
        const heading = document.createElement('h3');
        const patrolName = patrol.name || `Patrull ${index + 1}`;
        heading.textContent = patrolName;
        const list = document.createElement('ul');

        result.records
            .filter(record => record.patrol === patrolName)
            .forEach(record => {
                const item = document.createElement('li');
                const nameWrapper = document.createElement('div');
                nameWrapper.style.display = 'flex';
                nameWrapper.style.flexDirection = 'column';

                const name = document.createElement('span');
                name.textContent = record.scout;
                nameWrapper.append(name);

                if (record.memberStatus && record.memberStatus !== 'Fri scout') {
                    const note = document.createElement('small');
                    note.textContent = record.memberStatus;
                    note.style.color = 'var(--muted)';
                    note.style.fontSize = '0.78rem';
                    nameWrapper.append(note);
                }

                const status = document.createElement('span');
                status.textContent = record.status;
                const statusClass = record.status === 'JA'
                    ? 'yes'
                    : (record.status === 'NEJ' ? 'no' : 'neutral');
                const statusDescription = record.status === 'JA'
                    ? 'Minst ett kompisönskemål finns i samma patrull.'
                    : (record.status === 'NEJ'
                        ? 'Inget kompisönskemål finns i samma patrull.'
                        : 'Scouten lämnade inga kompisönskemål.');
                status.className = `status status--${statusClass}`;
                status.title = statusDescription;
                status.setAttribute('aria-label', `${record.status}: ${statusDescription}`);
                item.append(nameWrapper, status);
                list.append(item);
            });

        card.append(heading, list);
        patrolGrid.append(card);
    });
}

function makeDownload(content, type, filename) {
    return { content, type, filename };
}

function updateDownloads(patrols, scouts, result) {
    const svg = visualizationApi.createSvgGraph(patrols, scouts);
    downloads = {
        csv: makeDownload(core.createResultCsv(result), 'text/csv;charset=utf-8', 'patruller_resultat.csv'),
        svg: makeDownload(svg, 'image/svg+xml;charset=utf-8', 'patruller_resultat.svg'),
        mermaid: makeDownload(
            visualizationApi.createMermaidGraph(patrols, scouts),
            'text/plain;charset=utf-8',
            'patruller_resultat.mmd'
        ),
    };

    if (graphUrl) URL.revokeObjectURL(graphUrl);
    graphUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    resultGraph.src = graphUrl;
}

document.querySelector('#build-button').addEventListener('click', () => {
    const content = getActiveCsvContent();
    if (!content.trim()) {
        showMessages([
            activeMode === 'upload'
                ? 'Välj eller släpp en CSV-fil först.'
                : 'Klistra in CSV-data först.',
        ]);
        resultsSection.hidden = true;
        return;
    }

    const diagnostics = csvLintApi.lintCsv(content);
    if (diagnostics.length > 0) {
        showMessages(diagnostics.map(diagnostic =>
            `Rad ${diagnostic.row}, kolumn ${diagnostic.column}: ${diagnostic.message}`
        ));
        resultsSection.hidden = true;
        return;
    }

    try {
        const targetSize = core.parseTargetSize(targetSizeInput.value);
        const scouts = core.parseCsv(content);
        core.validateRosterSize(scouts.size, targetSize);

        const basePatrolsModeRadio = document.querySelector('input[name="base-patrols-mode"]:checked');
        const newPatrolsModeRadio = document.querySelector('input[name="new-patrols-mode"]:checked');

        const options = {
            basePatrolsMode: basePatrolsModeRadio ? basePatrolsModeRadio.value : 'locked',
            newPatrolsMode: newPatrolsModeRadio ? newPatrolsModeRadio.value : 'target-size',
        };

        const patrols = core.buildPatrols(scouts, targetSize, options);
        const result = core.createPatrolResult(patrols, scouts);

        renderPatrols(patrols, result);
        updateDownloads(patrols, scouts, result);
        relationDiagram.open = true;
        showMessages([]);
        resultsSection.hidden = false;
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        showMessages([error.message]);
        resultsSection.hidden = true;
    }
});

document.querySelectorAll('[data-download]').forEach(button => {
    button.addEventListener('click', () => {
        const download = downloads[button.dataset.download];
        if (!download) return;

        const url = URL.createObjectURL(new Blob([download.content], { type: download.type }));
        const link = document.createElement('a');
        link.href = url;
        link.download = download.filename;
        link.click();
        URL.revokeObjectURL(url);
    });
});

updateDynamicTargetText();

const toggleFeedback = document.querySelector('#toggle-feedback');
const feedbackContainer = document.querySelector('#feedback-container');
const feedbackForm = document.querySelector('#feedback-form');
const feedbackSubmit = document.querySelector('#feedback-submit');
const feedbackStatus = document.querySelector('#feedback-status');

if (toggleFeedback && feedbackContainer) {
    toggleFeedback.addEventListener('click', () => {
        const isHidden = feedbackContainer.hidden;
        feedbackContainer.hidden = !isHidden;
        toggleFeedback.setAttribute('aria-expanded', String(isHidden));
        if (isHidden) {
            const firstInput = feedbackContainer.querySelector('input[type="text"]');
            if (firstInput) firstInput.focus();
        }
    });
}

if (feedbackForm) {
    feedbackForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (feedbackSubmit) feedbackSubmit.disabled = true;
        if (feedbackStatus) {
            feedbackStatus.textContent = 'Skickar...';
            feedbackStatus.className = 'feedback-status';
        }

        const formData = new FormData(feedbackForm);
        const object = Object.fromEntries(formData);
        const json = JSON.stringify(object);

        try {
            const response = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: json
            });

            const result = await response.json();

            if (response.status === 200) {
                if (feedbackStatus) {
                    feedbackStatus.textContent = 'Tack för din feedback!';
                    feedbackStatus.classList.add('feedback-status--success');
                }
                feedbackForm.reset();
            } else {
                if (feedbackStatus) {
                    feedbackStatus.textContent = result.message || 'Något gick fel. Försök igen.';
                    feedbackStatus.classList.add('feedback-status--error');
                }
            }
        } catch (error) {
            if (feedbackStatus) {
                feedbackStatus.textContent = 'Kunde inte skicka. Kontrollera din anslutning.';
                feedbackStatus.classList.add('feedback-status--error');
            }
        } finally {
            if (feedbackSubmit) feedbackSubmit.disabled = false;
        }
    });
}

