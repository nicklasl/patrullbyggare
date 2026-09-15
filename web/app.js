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
    statistics.replaceChildren(
        createStatistic('Scouter', result.statistics.scoutCount),
        createStatistic('Patruller', patrols.length),
        createStatistic('Önskemål uppfyllda', `${result.statistics.satisfiedPercentage}%`)
    );
    patrolGrid.replaceChildren();

    patrols.forEach((patrol, index) => {
        const card = document.createElement('article');
        card.className = 'patrol-card';
        const heading = document.createElement('h3');
        heading.textContent = `Patrull ${index + 1}`;
        const list = document.createElement('ul');

        result.records
            .filter(record => record.patrol === heading.textContent)
            .forEach(record => {
                const item = document.createElement('li');
                const name = document.createElement('span');
                const status = document.createElement('span');
                name.textContent = record.scout;
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
                item.append(name, status);
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
    const content = activeMode === 'upload' ? uploadedCsv : csvText.value;
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
        const patrols = core.buildPatrols(scouts, targetSize);
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
