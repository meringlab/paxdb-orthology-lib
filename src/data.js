const fs = require('fs');
const path = require("path");

const ORTHOLOGY_SPECIES_MAP = path.join(__dirname, '../', 'data/ontology/ontology_2_species.tsv');

exports = module.exports = {}; //eslint-disable-line no-multi-assign

exports.orthgroups = {
    1: 'LUCA',
    2: 'BACTERIA',
    543: 'ENTEROBACTERIACEAE',
    1117: 'CYANOBACTERIA',
    1224: 'PROTEOBACTERIA',
    1236: 'GAMMAPROTEOBACTERIA',
    1239: 'FIRMICUTES',
    1385: 'BACILLALES',
    2157: 'ARCHAEA',
    2759: 'EUKARYOTES',
    4447: 'LILIOPSIDA',
    4751: 'FUNGI',
    4890: 'ASCOMYCETES',
    5653: 'KINETOPLASTS',
    6656: 'ARTHROPODS',
    7147: 'DIPTERA',
    7711: 'CHORDATES',
    8287: 'SARCOPTERYGII',
    9443: 'PRIMATES',
    9989: 'RODENTS',
    29547: 'EPSILONPROTEOBACTERIA',
    32524: 'AMNIOTES',
    33090: 'GREENPLANTS',
    33154: 'OPISTHOKONTS',
    33208: 'METAZOA',
    33316: 'COELOMATA',
    35493: 'STREPTOPHYTA',
    40674: 'MAMMALS',
    68525: 'DEPROTEOBACTERIA',
    91561: 'CETARTIODACTYLA',
    186817: 'BACILLACEAE',
    186826: 'LACTOBACILLALES',
    314145: 'LAURASIATHERIA',
    314146: 'EUARCHONTOGLIRES',
    716545: 'SACCHAROMYCETA'
};

function loadSpeciesTissuesMap() {
    const contents = fs.readFileSync(ORTHOLOGY_SPECIES_MAP, { encoding: 'utf8' });
    const map = {};
    contents.split('\n').forEach((line) => {
        const rec = line.split('\t');
        if (rec.length < 2) {
            return;
        }
        if (!(rec[0] in map)) {
            map[rec[0]] = [];
        }
        map[rec[0]].push(rec[1]);
    });
    return map;
}

exports.speciesTissuesMap = loadSpeciesTissuesMap();
